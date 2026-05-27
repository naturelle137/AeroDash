/**
 * App Version Store — P3 App Shell.
 * Exposes the running build's version, build date, and the
 * minimum-safe-version enforcement gate (REQ-SYS-006, H-019).
 *
 * ## Effective `minSafeVersion` resolution (issue #271)
 *
 * The gate must hold even when the cockpit tablet is offline — the audit
 * (CS-011 / TECH-023) found that a prior `if (!navigator.onLine) return`
 * short-circuit let an explicitly kill-switched bundle keep running in
 * exactly the unreliable-network case `REQ-SYS-006` exists to mitigate.
 *
 * The resolution algorithm is now:
 *
 * 1. **Read the IndexedDB cache** (`appVersionCache.loadCachedMinSafeVersion`)
 *    — works fully offline. The cache stores the highest `minSafeVersion`
 *    observed during any previous online run.
 * 2. **Pick `effectiveMin = max(buildTimeConstant, cachedValue)`**. Using the
 *    cached value as the lower bound is what makes the offline enforcement
 *    work: an older bundle resurrected via Service Worker rollback can never
 *    see a build-time constant lower than the cached one it left behind
 *    during its predecessor's online run.
 * 3. **If online, fetch `/version.json`** via {@link fetchRemoteMinSafeVersion}.
 *    On success, recompute `effectiveMin = max(effectiveMin, remoteValue)`
 *    and persist the new floor to IndexedDB. On failure (4xx / 5xx / network
 *    / parse / timeout) keep the prior floor — the remote endpoint is a
 *    soft override, not the authoritative source.
 * 4. **Evaluate**: `versionBlocked = (currentVersion < effectiveMin)`.
 *
 * ## First-install bypass — the only exempt path
 *
 * `loadCachedMinSafeVersion()` returns `null` when the IndexedDB record is
 * absent (truly first-time install) OR when IndexedDB itself is unavailable
 * (Safari private mode, sandboxed iframe). In that case the floor is the
 * build-time constant only — exactly the prior, pre-cache behaviour. The
 * caller logs an INFO so the operator can correlate a missing-cache event
 * with a fresh install or a known-degraded storage backend.
 *
 * ## Stale-cache warning
 *
 * If the cached record is older than {@link CACHE_TTL_MS} (24 h by default)
 * the store still enforces the cached value but logs a WARN. We never *bypass*
 * an expired cache — bypassing it would let a flaky CDN re-create the
 * original CS-011 / TECH-023 hazard via attrition.
 *
 * ## Refresh triggers
 *
 * - On mount via `App.vue` → `checkMinSafeVersion()` (always).
 * - On `window.online` event via `attachConnectivityRefresh()` so a return
 *   to connectivity refreshes the floor without waiting for the next cold
 *   start. (REQ-SYS-009 is Deferred, so this is the only connectivity
 *   surface in the app today.)
 */

// @IMP-SYS-STORE-006@ (FROM: @REQ-SYS-006@, @REQ-UI-013@)

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createLogger } from '@/shared/utils/logger'
import {
  loadCachedMinSafeVersion,
  persistCachedMinSafeVersion,
} from '@/stores/app-version.cache'
import { fetchRemoteMinSafeVersion } from '@/stores/app-version.remote'

const logger = createLogger('AppVersion')

/** Cache freshness threshold — 24 hours. Past this, an online check has not
 * succeeded in over a day; we still enforce but emit a WARN. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export const useAppVersionStore = defineStore('appVersion', () => {
  const currentVersion = ref(__APP_VERSION__)
  const buildDate = ref(__BUILD_DATE__)
  /**
   * Effective minimum safe version. Initialised to the build-time constant
   * and replaced by `max(buildTimeConstant, cachedValue, remoteValue)` on
   * each call to {@link checkMinSafeVersion}.
   */
  const minSafeVersion = ref(__MIN_SAFE_VERSION__)
  const versionBlocked = ref(false)
  /** `true` once `checkMinSafeVersion()` has been awaited at least once. */
  const lastCheckCompleted = ref(false)
  /** Epoch ms of the cache record the most-recent check resolved against,
   * or `null` when no cache existed (first install). Exposed for diagnostics. */
  const cacheFetchedAt = ref<number | null>(null)

  // @IMP-SYS-STORE-007@ (FROM: @REQ-SYS-006@)
  function isVersionBelow(current: string, minimum: string): boolean {
    const parse = (v: string) =>
      v.replace(/-.*$/, '').split('.').map(Number) as [number, number, number]
    const [cMaj, cMin, cPat] = parse(current)
    const [mMaj, mMin, mPat] = parse(minimum)
    if (cMaj !== mMaj) return cMaj < mMaj
    if (cMin !== mMin) return cMin < mMin
    return cPat < mPat
  }

  /**
   * Return the higher of two SemVer strings using {@link isVersionBelow}.
   * Treats invalid input by preferring the other operand — defensive, not
   * authoritative (the cache and remote modules already filter non-SemVer).
   */
  function pickHigherVersion(a: string, b: string): string {
    try {
      return isVersionBelow(a, b) ? b : a
    } catch {
      return a
    }
  }

  // @IMP-SYS-STORE-008@ (FROM: @REQ-SYS-006@, @H-019@)
  /**
   * Resolve the effective `minSafeVersion` and update the blocked-gate flag.
   *
   * Always runs the cache read + enforcement step (works offline). Only the
   * remote refresh step is gated on `navigator.onLine` — and even there, a
   * network failure is non-fatal: the cached floor stays in force.
   */
  async function checkMinSafeVersion(now: () => number = Date.now): Promise<void> {
    const buildTimeMin = __MIN_SAFE_VERSION__

    // ── Step 1 — load offline cache ────────────────────────────────────────
    const cached = await loadCachedMinSafeVersion()
    let effectiveMin = buildTimeMin

    if (cached) {
      effectiveMin = pickHigherVersion(effectiveMin, cached.value)
      cacheFetchedAt.value = cached.fetchedAt
      const ageMs = now() - cached.fetchedAt
      if (ageMs > CACHE_TTL_MS) {
        logger.warn('minSafeVersion cache stale; enforcement still applies', {
          code: 'MIN_SAFE_VERSION_CACHE_STALE',
          durationMs: ageMs,
        })
      }
    } else {
      cacheFetchedAt.value = null
      // First-time install OR IndexedDB unavailable. Log INFO so an operator
      // investigating a missing-cache event can correlate it with either case.
      logger.info('minSafeVersion cache absent; first-install bypass active', {
        code: 'MIN_SAFE_VERSION_CACHE_ABSENT',
        version: buildTimeMin,
      })
    }

    // ── Step 2 — best-effort online refresh ────────────────────────────────
    const online = typeof navigator !== 'undefined' && navigator.onLine === true
    if (online) {
      const remoteValue = await fetchRemoteMinSafeVersion()
      if (remoteValue) {
        effectiveMin = pickHigherVersion(effectiveMin, remoteValue)
      } else {
        logger.warn('minSafeVersion remote refresh failed; cached/built-in floor kept', {
          code: 'MIN_SAFE_VERSION_REMOTE_REFRESH_FAILED',
        })
      }
      // Persist the (possibly new) highest floor so a later offline run sees
      // it. We persist even when the value did not move so the fetchedAt
      // timestamp gets refreshed, keeping the cache out of the stale path.
      const persisted = await persistCachedMinSafeVersion(effectiveMin, now)
      if (persisted) cacheFetchedAt.value = now()
    }

    // ── Step 3 — apply ─────────────────────────────────────────────────────
    minSafeVersion.value = effectiveMin
    versionBlocked.value = isVersionBelow(currentVersion.value, effectiveMin)
    lastCheckCompleted.value = true
  }

  // @IMP-SYS-STORE-018@ (FROM: @REQ-SYS-006@, @H-019@)
  /**
   * Wire `window.online` to re-run {@link checkMinSafeVersion}. Returns an
   * unbind function so callers (e.g. `App.vue`'s `onBeforeUnmount`) can
   * detach the listener cleanly during teardown / tests.
   *
   * Safely no-ops in non-DOM test environments where `window` is undefined.
   */
  function attachConnectivityRefresh(): () => void {
    if (typeof window === 'undefined') return () => undefined
    const handler = (): void => {
      void checkMinSafeVersion()
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }

  return {
    currentVersion,
    buildDate,
    minSafeVersion,
    versionBlocked,
    lastCheckCompleted,
    cacheFetchedAt,
    checkMinSafeVersion,
    isVersionBelow,
    attachConnectivityRefresh,
  }
})
