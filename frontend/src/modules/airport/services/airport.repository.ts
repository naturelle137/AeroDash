/**
 * Airport Repository — native IndexedDB persistence for manual airport entries.
 * P2 Feature Module — may use browser APIs, no Vue/Pinia or P1 imports.
 *
 * Database: aerodash-airports, version 1
 * Object store: manual_airports, keyPath: id
 *
 * Documents are structurally validated on the way in (write) and on the way
 * out (read). A stored row that fails validation — a corrupt or
 * future-schema record after a PWA-cache rollback — is dropped from the
 * in-memory result rather than failing the whole load, mirroring the fleet
 * repository's partial-recovery contract.
 *
 * @see frontend/src/modules/aircraft/services/fleet.repository.ts
 */

import type {
  BaseSurfaceType,
  ManualAirportEntry,
  ManualRunwayOverrides,
} from '../domain/airport.types'

/** Canonical IndexedDB database name — the single source of truth for manual airports. */
export const DB_NAME = 'aerodash-airports'
const DB_VERSION = 1
const STORE_NAME = 'manual_airports'

/** Current persisted manual-airport schema revision. */
export const MANUAL_AIRPORT_SCHEMA_VERSION = 1

// ─── Validation ──────────────────────────────────────────────────────────────
// Zod is reserved for the P1 Safety Core (CLAUDE.md), so the persistence
// boundary is guarded with plain structural predicates instead.

function isNullableFinite(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isBaseSurfaceType(value: unknown): value is BaseSurfaceType {
  return value === 'paved' || value === 'grass'
}

function isRunwayOverrides(value: unknown): value is ManualRunwayOverrides {
  if (value === null || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.designator === 'string' &&
    isNullableFinite(r.magneticHeadingDeg) &&
    isBaseSurfaceType(r.baseSurfaceType) &&
    isNullableFinite(r.slopePercent) &&
    isNullableFinite(r.toraM) &&
    isNullableFinite(r.todaM) &&
    isNullableFinite(r.asdaM) &&
    isNullableFinite(r.ldaM) &&
    (r.surfaceConditionId === null || typeof r.surfaceConditionId === 'string')
  )
}

/** Structural guard for a stored manual airport entry. */
export function isManualAirportEntry(value: unknown): value is ManualAirportEntry {
  if (value === null || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.icao === 'string' &&
    typeof e.name === 'string' &&
    isNullableFinite(e.elevationFt) &&
    typeof e.schemaVersion === 'number' &&
    isRunwayOverrides(e.runway)
  )
}

function assertManualAirportEntry(value: unknown): ManualAirportEntry {
  if (!isManualAirportEntry(value)) {
    throw new Error('Invalid manual airport entry: failed structural validation.')
  }
  return value
}

// ─── Singleton handle ──────────────────────────────────────────────────────────
// Mirror the fleet repository: cache one open handle so a burst of concurrent
// calls share a single connection, and release it on `onversionchange`
// (a sibling tab upgrade must not be blocked) or `onclose` (browser eviction).

let dbHandlePromise: Promise<IDBDatabase> | null = null

function openDBOnce(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      db.onversionchange = (): void => {
        db.close()
        dbHandlePromise = null
      }
      db.onclose = (): void => {
        dbHandlePromise = null
      }
      resolve(db)
    }

    request.onerror = (event) => {
      reject(
        new Error(
          `Failed to open IndexedDB: ${(event.target as IDBOpenDBRequest).error?.message ?? 'unknown'}`,
        ),
      )
    }
  })
}

function openDB(): Promise<IDBDatabase> {
  if (dbHandlePromise === null) {
    dbHandlePromise = openDBOnce().catch((err: unknown) => {
      dbHandlePromise = null
      throw err
    })
  }
  return dbHandlePromise
}

/** Test/teardown hook: drop the cached handle so the next `openDB()` reopens. */
export function _resetAirportDbHandleForTest(): void {
  dbHandlePromise = null
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const store = tx.objectStore(STORE_NAME)
        const request = fn(store)
        request.onsuccess = (event) => {
          resolve((event.target as IDBRequest<T>).result)
        }
        request.onerror = (event) => {
          reject(
            new Error(
              `IndexedDB operation failed: ${(event.target as IDBRequest<T>).error?.message ?? 'unknown'}`,
            ),
          )
        }
        tx.onerror = (event) => {
          reject(
            new Error(
              `IndexedDB transaction failed: ${(event.target as IDBTransaction).error?.message ?? 'unknown'}`,
            ),
          )
        }
      }),
  )
}

// ─── CRUD API ──────────────────────────────────────────────────────────────────

/** Insert a new manual airport entry. Throws if it is structurally invalid. */
// @IMP-AP-STORE-003@ (FROM: @REQ-AP-006@)
export async function create(entry: ManualAirportEntry): Promise<void> {
  const valid = assertManualAirportEntry(entry)
  await withStore<IDBValidKey>('readwrite', (store) => store.add(valid))
}

/** Insert or replace a manual airport entry by id. Throws if invalid. */
export async function update(entry: ManualAirportEntry): Promise<void> {
  const valid = assertManualAirportEntry(entry)
  await withStore<IDBValidKey>('readwrite', (store) => store.put(valid))
}

/** Retrieve one entry by id, or `undefined` when absent or unreadable. */
export function findById(id: string): Promise<ManualAirportEntry | undefined> {
  return withStore<unknown>('readonly', (store) => store.get(id) as IDBRequest<unknown>).then(
    (doc) => (isManualAirportEntry(doc) ? doc : undefined),
  )
}

/** Retrieve every readable entry; structurally invalid rows are skipped. */
export function findAll(): Promise<ManualAirportEntry[]> {
  return withStore<unknown[]>(
    'readonly',
    (store) => store.getAll() as IDBRequest<unknown[]>,
  ).then((docs) => docs.filter(isManualAirportEntry))
}

/** Delete one entry by id. */
export function deleteById(id: string): Promise<void> {
  return withStore<undefined>('readwrite', (store) => store.delete(id)).then(() => undefined)
}

/** Delete every entry in the store. */
export function deleteAll(): Promise<void> {
  return withStore<undefined>('readwrite', (store) => store.clear()).then(() => undefined)
}

export const airportRepository = {
  openDB,
  create,
  update,
  findById,
  findAll,
  deleteById,
  deleteAll,
}
