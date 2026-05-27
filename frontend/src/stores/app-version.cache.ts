/**
 * App Version Cache — IndexedDB persistence for the last-known `minSafeVersion`.
 * P3 App Shell — uses browser APIs (IndexedDB) only; no Vue/Pinia framework imports.
 *
 * ## REQ-SYS-006 — Offline enforcement (issue #271)
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
 * | Mode | Behaviour | Pilot impact |
 * | :--- | :-------- | :----------- |
 * | First-time install (no record) | Returns `null`; store falls back to the build-time constant only. | None on a fresh install; the worst case is the user has never run a newer bundle anyway. |
 * | IndexedDB unavailable (Safari private mode, sandboxed iframe, storage disabled) | All operations resolve to `null` / no-op; store logs a WARN and falls back to the build-time constant. | Identical to first-install bypass — operator should not deploy known-unsafe bundles. |
 * | Corrupted record (unexpected shape) | Treated as absent; store logs a WARN and falls back to the build-time constant. | Same as first-install. |
 * | Cache stale (older than TTL) | Returned with the `fetchedAt` timestamp; store still enforces but emits a WARN advising a connectivity check. | Pilot keeps flying with the last-known minimum — fail-safe. |
 *
 * Database: `aerodash-app-version`, version 1.
 * Object store: `version_policy`, keyPath: `id`.
 * Single record key: `'minSafeVersion'`.
 */

// @IMP-SYS-STORE-013@ (FROM: @REQ-SYS-006@, @H-019@)

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

/** Strict SemVer-ish guard — `MAJOR.MINOR.PATCH` with optional pre-release/build suffix. */
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

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

    request.onblocked = () => {
      reject(new Error(`${DB_NAME} open blocked by another tab`))
    }
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const store = tx.objectStore(STORE_NAME)
        const request = fn(store)

        request.onsuccess = (event) => {
          resolve((event.target as IDBRequest<T>).result)
        }

        request.onerror = (event) => {
          const message = (event.target as IDBRequest<T>).error?.message ?? 'unknown'
          reject(new Error(`IndexedDB op failed: ${message}`))
        }

        tx.oncomplete = () => {
          db.close()
        }

        tx.onerror = (event) => {
          const message = (event.target as IDBTransaction).error?.message ?? 'unknown'
          reject(new Error(`IndexedDB tx failed: ${message}`))
        }
      }),
  )
}

// @IMP-SYS-STORE-014@ (FROM: @REQ-SYS-006@, @H-019@)
/**
 * Load the cached minimum safe version.
 *
 * Returns `null` when:
 * - the record is absent (first-time install),
 * - the record fails the shape guard (corrupt — treated as absent),
 * - or IndexedDB itself is unavailable / errors out (Safari private mode,
 *   sandboxed iframe, storage disabled).
 *
 * The caller is expected to interpret `null` as "no enforcement floor from
 * cache — fall back to the build-time constant" and log accordingly. Never
 * throws.
 */
export async function loadCachedMinSafeVersion(): Promise<CachedMinSafeVersion | null> {
  try {
    const raw = await withStore<CachedMinSafeVersion | undefined>('readonly', (store) =>
      store.get(MIN_SAFE_VERSION_KEY),
    )
    if (raw === undefined || raw === null) return null
    if (!isCachedMinSafeVersion(raw)) return null
    return raw
  } catch {
    return null
  }
}

// @IMP-SYS-STORE-015@ (FROM: @REQ-SYS-006@, @H-019@)
/**
 * Persist a new highest-seen `minSafeVersion`. Best-effort: silently swallows
 * storage errors so a transient IndexedDB failure cannot crash the boot path.
 *
 * @param value - SemVer string to persist. Caller is responsible for ensuring
 *                this is the maximum of `(buildTimeConstant, cachedValue, remoteValue)`
 *                — this function does not re-compare against the existing record.
 * @param now   - Injected clock for deterministic tests. Defaults to `Date.now()`.
 *
 * Returns `true` on a successful write, `false` when the input is invalid or
 * the underlying storage threw.
 */
export async function persistCachedMinSafeVersion(
  value: string,
  now: () => number = Date.now,
): Promise<boolean> {
  if (typeof value !== 'string' || !SEMVER_RE.test(value)) return false
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
  persistCachedMinSafeVersion,
  clearCachedMinSafeVersion,
}
