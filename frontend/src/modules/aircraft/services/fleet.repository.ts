/**
 * Fleet Repository — native IndexedDB persistence layer for AircraftProfile documents.
 * P2 Feature Module — may use browser APIs, no Vue/Pinia framework imports.
 *
 * Database: aerodash-fleet, version 2 (status normalization migration)
 * Object store: aircraft_profiles, keyPath: id
 *
 * @see docs/architecture/adr/006-indexeddb-fleet-persistence.md
 */

import { AircraftProfileSchema } from '@/core/adapters/aircraft.schema'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// @IMP-AC-STORE-001@ (FROM: @REQ-AC-001@, @DES-ARCH-007@)

const DB_NAME = 'aerodash-fleet'
/** Bumped to 2: normalize legacy `Draft`/`Verified` status strings to lowercase (REQ-AC-005). */
const DB_VERSION = 2
const STORE_NAME = 'aircraft_profiles'

function normalizeLegacyProfileStatus(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw
  const doc = raw as Record<string, unknown>
  const s = doc.status
  if (s === 'Draft') doc.status = 'draft'
  else if (s === 'Verified') doc.status = 'verified'
  return doc
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      // Create the object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        // Index by ownerId for efficient owner-scoped queries
        store.createIndex('ownerId', 'ownerId', { unique: false })
        // Index by registration for duplicate detection
        store.createIndex('registration', 'registration', { unique: false })
      }

      // v1 → v2: rewrite status field to canonical lowercase
      if (oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
        const tx = (event.target as IDBOpenDBRequest).transaction!
        const store = tx.objectStore(STORE_NAME)
        const cursorReq = store.openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) return
          const normalized = normalizeLegacyProfileStatus(cursor.value)
          const parsed = AircraftProfileSchema.safeParse(normalized)
          if (parsed.success) {
            cursor.update(parsed.data)
          }
          cursor.continue()
        }
      }
    }

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result)
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

        tx.oncomplete = () => {
          db.close()
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

/**
 * Create a new AircraftProfile document in IndexedDB.
 * Throws if a profile with the same id already exists.
 */
export function create(profile: AircraftProfile): Promise<void> {
  return withStore<IDBValidKey>('readwrite', (store) => store.add(profile)).then(() => undefined)
}

/**
 * Retrieve a single AircraftProfile by id.
 * Returns undefined if not found.
 */
export function findById(id: string): Promise<AircraftProfile | undefined> {
  return withStore<AircraftProfile | undefined>('readonly', (store) => store.get(id))
}

/**
 * Retrieve all AircraftProfile documents.
 */
export function findAll(): Promise<AircraftProfile[]> {
  return withStore<AircraftProfile[]>('readonly', (store) => store.getAll())
}

/**
 * Replace an existing AircraftProfile document.
 * Uses put() which inserts or replaces by keyPath.
 */
export function update(profile: AircraftProfile): Promise<void> {
  return withStore<IDBValidKey>('readwrite', (store) => store.put(profile)).then(() => undefined)
}

/**
 * Delete an AircraftProfile document by id.
 */
export function deleteById(id: string): Promise<void> {
  return withStore<undefined>('readwrite', (store) => store.delete(id)).then(() => undefined)
}

export const fleetRepository = {
  openDB,
  create,
  findById,
  findAll,
  update,
  deleteById,
}
