/**
 * App Version Cache — IndexedDB persistence for the last-known `minSafeVersion`.
 * P3 App Shell — uses browser APIs (IndexedDB) only; no Vue/Pinia framework imports.
 *
 * ## REQ-SYS-006 — Offline enforcement
 *
 * Originally `useAppVersionStore.checkMinSafeVersion()` returned early when
 * `!navigator.onLine`, which means an explicitly-blocked old bundle kept
 * running offline — defeating H-019 / REQ-SYS-006 in exactly the cockpit
 * (unreliable-network) case the requirement is supposed to mitigate.
 *
 * This cache is the offline-safe substrate for the enforcement gate. Each
 * successful evaluation (online or offline) persists the highest seen
 * `minSafeVersion` to IndexedDB. On every subsequent bootstrap — including
 * offline — the store reads the cached value and uses it as the lower bound
 * for the enforcement floor (alongside the build-time constant). An older
 * bundle resurrected by Service Worker rollback therefore sees the newer
 * minimum that was observed during a prior online run and is blocked.
 *
 * ## Failure modes (documented)
 *
 * The reader exposes two surfaces:
 *
 * - {@link inspectCachedMinSafeVersion} returns a discriminated union that
 *   distinguishes (a) `absent` (first-time install), (b) `corrupt` (record
 *   present but fails the shape guard), (c) `unavailable` (IndexedDB itself
 *   threw — Safari private mode, sandboxed iframe), and (d) `hit` (valid).
 *   The store uses this to emit the correct log level per case so an
 *   operator can triage a missing-cache field report.
 * - {@link loadCachedMinSafeVersion} is the legacy convenience that returns
 *   the hit payload or `null` for any of `absent | corrupt | unavailable`.
 *   Kept for callers that do not care about the distinction (integration
 *   tests, future delete-all-data flow).
 *
 * | Mode | Behaviour | Pilot impact |
 * | :--- | :-------- | :----------- |
 * | First-time install (no record) | `inspect → { kind: 'absent' }`. Store falls back to the build-time constant only. | None on a fresh install. |
 * | IndexedDB unavailable (Safari private mode, sandboxed iframe, storage disabled) | `inspect → { kind: 'unavailable' }`. Store emits WARN and falls back to the build-time constant. | Identical to first-install bypass — operator should not deploy known-unsafe bundles. |
 * | Corrupted record (unexpected shape) | `inspect → { kind: 'corrupt' }`. Store emits WARN and falls back to the build-time constant. | Same as first-install. |
 * | Cache stale (older than TTL) | `inspect → { kind: 'hit', … }`; store still enforces but emits a separate WARN advising a connectivity check. | Pilot keeps flying with the last-known minimum — fail-safe. |
 *
 * Database: `aerodash-app-version`, version 1.
 * Object store: `version_policy`, keyPath: `id`.
 * Single record key: `'minSafeVersion'`.
 *
 * ## Write durability (Major review finding #3)
 *
 * `readwrite` operations resolve on `tx.oncomplete` (post-commit), not the
 * inner `request.onsuccess` (post-queue). The latter fires when the request
 * is acknowledged but before the transaction has committed, so a tab kill
 * between resolve and commit would silently lose the new floor — exactly
 * the offline-enforcement guarantee this module is supposed to provide.
 *
 * ## Handle hygiene (Minor review finding #7)
 *
 * The `IDBDatabase` is closed on every completion path — `tx.oncomplete`,
 * `request.onerror`, and `tx.onerror` — so an iPad left running an
 * AeroDash tab through a long flight cannot accumulate dangling handles
 * that would later trip the `onblocked` path on a schema upgrade.
 */

// @IMP-SYS-STORE-013@ (FROM: @REQ-SYS-006@, @H-019@)

import { SEMVER_RE, isValidSemVer } from '@/stores/app-version.semver'

const DB_NAME = 'aerodash-app-version'
const DB_VERSION = 1
const STORE_NAME = 'version_policy'

/** Single record key — the cache currently holds at most one entry. */
export const MIN_SAFE_VERSION_KEY = 'minSafeVersion'

/** Shape persisted in IndexedDB. */
export interface CachedMinSafeVersion {
  /** Always `'minSafeVersion'` for the single-row schema. */
  readonly id: string
  /** Highest minSafeVersion observed during any prior online run (SemVer). */
  readonly value: string
  /** Epoch milliseconds at which `value` was last written. Drives the TTL warning. */
  readonly fetchedAt: number
}

/**
 * Discriminated outcome of {@link inspectCachedMinSafeVersion}. The store
 * uses the `kind` to choose between INFO (first install) and WARN (corrupt
 * / unavailable) so a field-report triage can separate genuinely-fresh
 * installs from broken storage backends.
 */
export type CachedMinSafeVersionResult =
  | { readonly kind: 'hit'; readonly value: string; readonly fetchedAt: number }
  | { readonly kind: 'absent' }
  | { readonly kind: 'corrupt' }
  | { readonly kind: 'unavailable' }

function isCachedMinSafeVersion(raw: unknown): raw is CachedMinSafeVersion {
  if (raw === null || typeof raw !== 'object') return false
  const doc = raw as Record<string, unknown>
  return (
    doc.id === MIN_SAFE_VERSION_KEY &&
    typeof doc.value === 'string' &&
    SEMVER_RE.test(doc.value) &&
    typeof doc.fetchedAt === 'number' &&
    Number.isFinite(doc.fetchedAt) &&
    doc.fetchedAt >= 0
  )
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(err instanceof Error ? err : new Error('indexedDB.open threw'))
      return
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result)
    }

    request.onerror = (event) => {
      const message = (event.target as IDBOpenDBRequest).error?.message ?? 'unknown'
      reject(new Error(`Failed to open ${DB_NAME}: ${message}`))
    }

    // Reachable only on a future schema upgrade; harmless dead code at
    // DB_VERSION=1 but kept for migration safety.
    request.onblocked = () => {
      reject(new Error(`${DB_NAME} open blocked by another tab`))
    }
  })
}

/**
 * Run `fn` inside a transaction and resolve on **transaction commit**
 * (`tx.oncomplete`) rather than the inner `request.onsuccess`. Closes the
 * `IDBDatabase` on every completion / error path.
 */
function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: T
        let captured = false
        let settled = false

        const settle = (cb: () => void): void => {
          if (settled) return
          settled = true
          try {
            db.close()
          } catch {
            /* swallow — close is best-effort */
          }
          cb()
        }

        let tx: IDBTransaction
        let request: IDBRequest<T>
        try {
          tx = db.transaction(STORE_NAME, mode)
          const store = tx.objectStore(STORE_NAME)
          request = fn(store)
        } catch (err) {
          settle(() => reject(err instanceof Error ? err : new Error('tx setup threw')))
          return
        }

        request.onsuccess = (event) => {
          result = (event.target as IDBRequest<T>).result
          captured = true
        }

        request.onerror = (event) => {
          const message = (event.target as IDBRequest<T>).error?.message ?? 'unknown'
          settle(() => reject(new Error(`IndexedDB op failed: ${message}`))) // closes DB
        }

        tx.oncomplete = () => {
          settle(() =>
            captured
              ? resolve(result)
              : reject(new Error('IndexedDB request did not produce a result')),
          )
        }

        tx.onerror = (event) => {
          const message = (event.target as IDBTransaction).error?.message ?? 'unknown'
          settle(() => reject(new Error(`IndexedDB tx failed: ${message}`)))
        }
      }),
  )
}

// @IMP-SYS-STORE-014@ (FROM: @REQ-SYS-006@, @H-019@)
/**
 * Inspect the cached minimum safe version with a discriminated outcome.
 *
 * Never throws. Returns one of:
 * - `{ kind: 'hit', value, fetchedAt }` — record present and shape-valid;
 * - `{ kind: 'absent' }` — IndexedDB opened cleanly but the record is missing
 *   (first-time install);
 * - `{ kind: 'corrupt' }` — record present but fails the shape guard
 *   (treated as absent for enforcement, but the store will emit a WARN);
 * - `{ kind: 'unavailable' }` — IndexedDB itself threw or `withStore`
 *   rejected (Safari private mode, sandboxed iframe, storage disabled).
 */
export async function inspectCachedMinSafeVersion(): Promise<CachedMinSafeVersionResult> {
  let raw: unknown
  try {
    raw = await withStore<CachedMinSafeVersion | undefined>('readonly', (store) =>
      store.get(MIN_SAFE_VERSION_KEY),
    )
  } catch {
    return { kind: 'unavailable' }
  }
  if (raw === undefined || raw === null) return { kind: 'absent' }
  if (!isCachedMinSafeVersion(raw)) return { kind: 'corrupt' }
  return { kind: 'hit', value: raw.value, fetchedAt: raw.fetchedAt }
}

// @IMP-SYS-STORE-019@ (FROM: @REQ-SYS-006@, @H-019@)
/**
 * Load the cached minimum safe version — legacy convenience that flattens
 * the {@link inspectCachedMinSafeVersion} discriminated outcome to either
 * the hit payload (typed as the persisted `CachedMinSafeVersion`) or `null`
 * for any of `absent | corrupt | unavailable`. Never throws.
 *
 * Prefer {@link inspectCachedMinSafeVersion} when the caller needs to
 * distinguish first-install from a broken storage backend (e.g. the store's
 * log-level selection).
 *
 * Maintenance note: this reconstructs the record from the
 * `hit` payload rather than forwarding a raw row, so if {@link CachedMinSafeVersion}
 * ever grows a field, extend both the `hit` variant of
 * {@link CachedMinSafeVersionResult} and this reconstruction or the new field
 * is silently dropped here.
 */
export async function loadCachedMinSafeVersion(): Promise<CachedMinSafeVersion | null> {
  const result = await inspectCachedMinSafeVersion()
  if (result.kind !== 'hit') return null
  return {
    id: MIN_SAFE_VERSION_KEY,
    value: result.value,
    fetchedAt: result.fetchedAt,
  }
}

// @IMP-SYS-STORE-015@ (FROM: @REQ-SYS-006@, @H-019@)
/**
 * Persist a new highest-seen `minSafeVersion`. Best-effort: silently swallows
 * storage errors so a transient IndexedDB failure cannot crash the boot path.
 *
 * Resolves only after the IndexedDB transaction has actually **committed**
 * (`tx.oncomplete`), not when the inner `IDBRequest` was acknowledged. This
 * is what makes the offline-enforcement guarantee real: a tab kill between
 * "request queued" and "transaction committed" cannot silently drop the
 * newly-learned floor.
 *
 * @param value - SemVer string to persist. Caller is responsible for ensuring
 *                this is the maximum of `(buildTimeConstant, cachedValue, remoteValue)`
 *                — this function does not re-compare against the existing record.
 * @param now   - Injected clock for deterministic tests. Defaults to `Date.now()`.
 *
 * Returns `true` on a successful write (post-commit), `false` when the input
 * is invalid or the underlying storage threw / aborted before commit.
 */
export async function persistCachedMinSafeVersion(
  value: string,
  now: () => number = Date.now,
): Promise<boolean> {
  if (!isValidSemVer(value)) return false
  const record: CachedMinSafeVersion = {
    id: MIN_SAFE_VERSION_KEY,
    value,
    fetchedAt: now(),
  }
  try {
    await withStore<IDBValidKey>('readwrite', (store) => store.put(record))
    return true
  } catch {
    return false
  }
}

// @IMP-SYS-STORE-016@ (FROM: @REQ-SYS-006@, @H-019@)
/**
 * Remove the cached record. Only intended for test fixtures and the future
 * Delete-All-Data operation (#272). Best-effort — silently no-ops on
 * storage error.
 */
export async function clearCachedMinSafeVersion(): Promise<void> {
  try {
    await withStore<undefined>('readwrite', (store) => store.delete(MIN_SAFE_VERSION_KEY))
  } catch {
    /* swallow — clear is best-effort */
  }
}

export const appVersionCache = {
  loadCachedMinSafeVersion,
  inspectCachedMinSafeVersion,
  persistCachedMinSafeVersion,
  clearCachedMinSafeVersion,
}
