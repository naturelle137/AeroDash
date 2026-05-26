/**
 * Fleet Repository — native IndexedDB persistence layer for AircraftProfile documents.
 * P2 Feature Module — may use browser APIs, no Vue/Pinia framework imports.
 *
 * Database: aerodash-fleet, version 2 (status normalization migration)
 * Object store: aircraft_profiles, keyPath: id
 *
 * Each document read out of IndexedDB is routed through the P1 migration
 * registry (`@/core/logic/profile-migrations`). Documents whose stored
 * `schemaVersion` is from a future build (PWA-cache rollback) or whose
 * contents fail to migrate are *dropped* from the in-memory fleet and the
 * drop reason is reported via {@link consumeMigrationDiagnostics} so the
 * UI / store layer can surface an INFO notification (refs #259).
 *
 * @see docs/architecture/adr/006-indexeddb-fleet-persistence.md
 */

import {
  migrateProfileDocument,
  type ProfileMigrationOutcome,
} from '@/core/logic/profile-migrations'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { AircraftProfileSchema } from '@/core/adapters/aircraft.schema'

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
          // Best-effort write: if the doc is corrupt at this point we skip it;
          // the on-read migration registry will catch and surface it later.
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

// ─── Migration diagnostics buffer (refs #259) ──────────────────────────────────
// The repository accumulates a list of documents that failed migration so the
// store layer can drain it once per load and surface an INFO notification per
// dropped record. The buffer is process-local and intentionally not surfaced
// through any kind of subscription API — `findAll` / `findById` consumers
// drain it via `consumeMigrationDiagnostics()` immediately after their call
// returns.

/** Why a stored document was excluded from the in-memory fleet. */
export type MigrationDropReason = 'unsupported-future-version' | 'corrupt'

export interface MigrationDiagnostic {
  /** IndexedDB key of the dropped document, when retrievable. */
  readonly id: string | undefined
  /** Why the document was dropped. */
  readonly reason: MigrationDropReason
  /** `schemaVersion` actually stored on the document (0 when missing / corrupt). */
  readonly storedVersion: number
  /** Human-readable detail for logging / UI tooltips. */
  readonly detail: string
}

let _migrationBuffer: MigrationDiagnostic[] = []

/**
 * Drain and return the migration diagnostics produced by the most recent
 * `findAll` / `findById` call(s) on this repository.
 *
 * Callers are expected to invoke this immediately after a load operation;
 * subsequent calls return an empty array.
 */
export function consumeMigrationDiagnostics(): readonly MigrationDiagnostic[] {
  const drained = _migrationBuffer
  _migrationBuffer = []
  return drained
}

function recordDiagnostic(rawId: unknown, outcome: ProfileMigrationOutcome): void {
  if (outcome.kind === 'migrated') return
  const id = typeof rawId === 'string' ? rawId : undefined
  if (outcome.kind === 'unsupported-future-version') {
    _migrationBuffer.push({
      id,
      reason: 'unsupported-future-version',
      storedVersion: outcome.storedVersion,
      detail:
        `Aircraft profile dropped: stored schemaVersion ${outcome.storedVersion} ` +
        `is newer than this build can read. Update the app to restore the profile.`,
    })
    return
  }
  _migrationBuffer.push({
    id,
    reason: 'corrupt',
    storedVersion: outcome.storedVersion,
    detail: `Aircraft profile dropped: corrupt at storage layer — ${outcome.reason}`,
  })
}

/**
 * Apply the schemaVersion migration registry to a single IndexedDB document.
 *
 * Returns the migrated profile when the document is accepted, or `undefined`
 * when the document is dropped (future version / corrupt). The drop reason is
 * recorded in the migration diagnostics buffer so consumers can surface a
 * single user-visible INFO notification per load.
 */
function applyMigration(raw: unknown): AircraftProfile | undefined {
  const outcome = migrateProfileDocument(raw)
  if (outcome.kind === 'migrated') {
    return outcome.profile
  }
  const rawId = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>).id : undefined
  recordDiagnostic(rawId, outcome)
  return undefined
}

// ─── CRUD API ──────────────────────────────────────────────────────────────────

/**
 * Create a new AircraftProfile document in IndexedDB.
 * Validates cross-field invariants (powertrain ↔ fuel tank ↔ battery pack)
 * via the Zod schema before writing. Throws if invalid or if a profile with
 * the same id already exists.
 */
export async function create(profile: AircraftProfile): Promise<void> {
  const parsed = AircraftProfileSchema.parse(profile)
  await withStore<IDBValidKey>('readwrite', (store) => store.add(parsed))
}

/**
 * Retrieve a single AircraftProfile by id.
 *
 * Returns `undefined` when the key is absent OR when the stored document
 * fails the schemaVersion migration (future version / corrupt). In the
 * latter case a diagnostic is appended to {@link consumeMigrationDiagnostics}.
 */
export function findById(id: string): Promise<AircraftProfile | undefined> {
  return withStore<AircraftProfile | undefined>('readonly', (store) => store.get(id)).then(
    (doc) => (doc ? applyMigration(doc) : undefined),
  )
}

/**
 * Retrieve all AircraftProfile documents.
 *
 * Documents whose stored `schemaVersion` is newer than this build can read
 * (PWA-cache rollback) — or whose contents are otherwise structurally
 * unmigratable — are *omitted* from the returned array and surfaced via
 * {@link consumeMigrationDiagnostics}. This is the documented partial-load
 * recovery path: the fleet UI keeps working with the readable subset rather
 * than failing the entire load on a single corrupt record.
 */
export function findAll(): Promise<AircraftProfile[]> {
  return withStore<AircraftProfile[]>('readonly', (store) => store.getAll()).then((docs) => {
    const migrated: AircraftProfile[] = []
    for (const doc of docs) {
      const m = applyMigration(doc)
      if (m !== undefined) migrated.push(m)
    }
    return migrated
  })
}

/**
 * Replace an existing AircraftProfile document.
 * Validates cross-field invariants before writing. Uses put() which inserts
 * or replaces by keyPath.
 */
export async function update(profile: AircraftProfile): Promise<void> {
  const parsed = AircraftProfileSchema.parse(profile)
  await withStore<IDBValidKey>('readwrite', (store) => store.put(parsed))
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
  consumeMigrationDiagnostics,
}
