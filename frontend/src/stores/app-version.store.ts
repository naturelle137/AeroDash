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
 * 1. **Read the IndexedDB cache** (`inspectCachedMinSafeVersion`) — works
 *    fully offline. The cache stores the highest `minSafeVersion` observed
 *    during any previous online run. The discriminated outcome lets us
 *    differentiate first-install (INFO), corrupt record (WARN) and storage
 *    unavailable (WARN) so a field-report triage can separate the cohorts.
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
 * `inspect → { kind: 'absent' }` denotes a truly fresh install — the floor
 * is the build-time constant only, exactly the prior pre-cache behaviour.
 * The store logs an INFO so the operator can correlate the event with a
 * fresh installation in the field.
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
 *   surface in the app today.) The handler re-acquires the store via
 *   `useAppVersionStore()` so the call goes through the Pinia action
 *   wrapper (devtools timeline, `$onAction`, `vi.spyOn` all see it).
 *
 * ## Single-flight check
 *
 * `checkMinSafeVersion()` is serialised by a module-level promise latch: a
 * second invocation arriving before the first resolves returns the same
 * in-flight promise. This stops a fast `online` event from racing the
 * onMounted call and overwriting a newer remote value with an older one.
 */

// @IMP-SYS-STORE-006@ (FROM: @REQ-SYS-006@, @REQ-UI-013@)

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createLogger } from '@/shared/utils/logger'
import {
  inspectCachedMinSafeVersion,
  persistCachedMinSafeVersion,
} from '@/stores/app-version.cache'
import { fetchRemoteMinSafeVersion } from '@/stores/app-version.remote'
import {
  isValidSemVer,
  isVersionBelow as semverIsVersionBelow,
  pickHigherVersion,
} from '@/stores/app-version.semver'

const logger = createLogger('AppVersion')

/** Cache freshness threshold — 24 hours. Past this, an online check has not
 * succeeded in over a day; we still enforce but emit a WARN. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Validate the build-time constant once on module load. The Vite define
 * pipeline already substitutes `__MIN_SAFE_VERSION__` from a literal, so a
 * shape failure here means something is structurally wrong with the build —
 * surface it loudly. We do **not** swap in a sentinel that would weaken the
 * floor; we keep the value as-is so callers can still see what was deployed,
 * and `pickHigherVersion` is now defensive enough to prefer a valid
 * cached/remote operand over an invalid build-time one.
 */
if (!isValidSemVer(__MIN_SAFE_VERSION__)) {
  logger.error('Build-time MIN_SAFE_VERSION is not a valid SemVer', {
    code: 'MIN_SAFE_VERSION_BUILD_INVALID',
    version: String(__MIN_SAFE_VERSION__),
  })
}

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
  /**
   * `true` when `current < minimum` per SemVer §11 ordering. Defensive
   * wrapper around the canonical comparator in `app-version.semver.ts`: on
   * invalid input (which should never reach here given upstream shape
   * guards) returns `false` after logging an ERROR — fail-quiet locally so
   * one bad record cannot crash the boot path, but loud enough for an
   * operator to notice.
   */
  function isVersionBelow(current: string, minimum: string): boolean {
    try {
      return semverIsVersionBelow(current, minimum)
    } catch (err) {
      logger.error('isVersionBelow rejected malformed SemVer', {
        code: 'MIN_SAFE_VERSION_PARSE_FAILED',
        current,
        minimum,
        error: err instanceof Error ? err.message : String(err),
      })
      return false
    }
  }

  /**
   * Single-flight latch for {@link checkMinSafeVersion}. A second
   * invocation arriving before the first resolves returns the same
   * in-flight promise, so a fast `online` event cannot race the onMounted
   * call and overwrite a newer remote with an older one.
   */
  let inFlight: Promise<void> | null = null

  // @IMP-SYS-STORE-008@ (FROM: @REQ-SYS-006@, @H-019@)
  /**
   * Resolve the effective `minSafeVersion` and update the blocked-gate flag.
   *
   * Always runs the cache read + enforcement step (works offline). Only the
   * remote refresh step is gated on `navigator.onLine` — and even there, a
   * network failure is non-fatal: the cached floor stays in force.
   */
  async function checkMinSafeVersion(now: () => number = Date.now): Promise<void> {
    if (inFlight !== null) return inFlight
    inFlight = runCheck(now).finally(() => {
      inFlight = null
    })
    return inFlight
  }

  async function runCheck(now: () => number): Promise<void> {
    const buildTimeMin = __MIN_SAFE_VERSION__

    // ── Step 1 — inspect offline cache ─────────────────────────────────────
    const inspected = await inspectCachedMinSafeVersion()
    let effectiveMin = buildTimeMin

    switch (inspected.kind) {
      case 'hit': {
        effectiveMin = pickHigherVersion(effectiveMin, inspected.value)
        cacheFetchedAt.value = inspected.fetchedAt
        const ageMs = now() - inspected.fetchedAt
        if (ageMs > CACHE_TTL_MS) {
          logger.warn('minSafeVersion cache stale; enforcement still applies', {
            code: 'MIN_SAFE_VERSION_CACHE_STALE',
            durationMs: ageMs,
          })
        }
        break
      }
      case 'absent':
        cacheFetchedAt.value = null
        logger.info('minSafeVersion cache absent; first-install bypass active', {
          code: 'MIN_SAFE_VERSION_CACHE_ABSENT',
          version: buildTimeMin,
        })
        break
      case 'corrupt':
        cacheFetchedAt.value = null
        logger.warn('minSafeVersion cache record corrupt; treating as absent', {
          code: 'MIN_SAFE_VERSION_CACHE_CORRUPT',
          version: buildTimeMin,
        })
        break
      case 'unavailable':
        cacheFetchedAt.value = null
        logger.warn('minSafeVersion cache backend unavailable; build-time floor only', {
          code: 'MIN_SAFE_VERSION_CACHE_UNAVAILABLE',
          version: buildTimeMin,
        })
        break
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
      // Capture `ts` once and pass it as a constant clock so the on-disk
      // `fetchedAt` and the in-memory `cacheFetchedAt` cannot drift under an
      // incrementing test clock.
      const ts = now()
      const persisted = await persistCachedMinSafeVersion(effectiveMin, () => ts)
      if (persisted) {
        cacheFetchedAt.value = ts
      } else {
        // Persist failed (best-effort writer swallowed the error). Clear the
        // in-memory diagnostic so it does not falsely advertise a fresher
        // disk state than the one the floor is actually being enforced from.
        cacheFetchedAt.value = null
      }
    }

    // ── Step 3 — apply ─────────────────────────────────────────────────────
    minSafeVersion.value = effectiveMin
    versionBlocked.value = isVersionBelow(currentVersion.value, effectiveMin)
    lastCheckCompleted.value = true
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
  }
})

// @IMP-SYS-STORE-018@ (FROM: @REQ-SYS-006@, @H-019@)
/**
 * Wire `window.online` to re-run `checkMinSafeVersion()` on the active
 * store. Returns an unbind function so callers (e.g. `App.vue`'s
 * `onBeforeUnmount`) can detach the listener cleanly during teardown / tests.
 *
 * The handler re-acquires the store via `useAppVersionStore()` so the call
 * goes through the Pinia action wrapper — `$onAction` subscribers, the
 * devtools timeline, and `vi.spyOn(store, 'checkMinSafeVersion')` all see
 * the connectivity-triggered refresh. (The previous in-setup closure version
 * bypassed the wrapper, which was a real correctness defect for observability
 * — the existing test even worked around it by observing the cache load
 * instead of the action.)
 *
 * Safely no-ops in non-DOM test environments where `window` is undefined.
 */
export function attachConnectivityRefresh(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (): void => {
    void useAppVersionStore().checkMinSafeVersion()
  }
  window.addEventListener('online', handler)
  return () => window.removeEventListener('online', handler)
}
