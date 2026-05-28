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
 * contents fail to migrate are *dropped* from the in-memory fleet. The
 * drop reason is returned to the caller alongside the data via the
 * {@link findAllWithDiagnostics} / {@link findByIdWithDiagnostics} variants
 * so the UI / store layer can surface an INFO notification per dropped
 * record (refs #259).
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

/** Canonical IndexedDB database name — the single source of truth for the fleet store. */
export const DB_NAME = 'aerodash-fleet'
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

// ─── Migration diagnostics (refs #259) ─────────────────────────────────────────
// Each load call carries its own diagnostics list back to the caller. We do not
// keep a module-level buffer: callers that interleave `findAll` and `findById`
// across `await` boundaries would otherwise see each other's diagnostics. The
// per-call return value is the only authoritative drain (#353 review feedback).

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

function toDiagnostic(rawId: unknown, outcome: ProfileMigrationOutcome): MigrationDiagnostic | null {
  if (outcome.kind === 'migrated') return null
  const id = typeof rawId === 'string' ? rawId : undefined
  if (outcome.kind === 'unsupported-future-version') {
    return {
      id,
      reason: 'unsupported-future-version',
      storedVersion: outcome.storedVersion,
      detail:
        `Aircraft profile dropped: stored schemaVersion ${outcome.storedVersion} ` +
        `is newer than this build can read. Update the app to restore the profile.`,
    }
  }
  return {
    id,
    reason: 'corrupt',
    storedVersion: outcome.storedVersion,
    detail: `Aircraft profile dropped: corrupt at storage layer — ${outcome.reason}`,
  }
}

/**
 * Apply the schemaVersion migration registry to a single IndexedDB document.
 *
 * Returns the migrated profile when the document is accepted, or `undefined`
 * when the document is dropped (future version / corrupt). When dropped, a
 * diagnostic is appended to the caller-supplied `diagnostics` buffer.
 */
function applyMigration(raw: unknown, diagnostics: MigrationDiagnostic[]): AircraftProfile | undefined {
  const outcome = migrateProfileDocument(raw)
  if (outcome.kind === 'migrated') {
    return outcome.profile
  }
  const rawId = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>).id : undefined
  const diag = toDiagnostic(rawId, outcome)
  if (diag !== null) diagnostics.push(diag)
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
 * Retrieve a single AircraftProfile by id alongside any migration diagnostic.
 *
 * Returns `{ profile: undefined, diagnostics: [...] }` when the stored
 * document fails the schemaVersion migration (future version / corrupt) so
 * the caller can surface an INFO notification. `profile` is `undefined` if
 * the key is absent and `diagnostics` is empty in that case.
 *
 * Prefer this race-free variant over the back-compat {@link findById}, which
 * silently discards diagnostics.
 */
export function findByIdWithDiagnostics(
  id: string,
): Promise<{ profile: AircraftProfile | undefined; diagnostics: readonly MigrationDiagnostic[] }> {
  return withStore<AircraftProfile | undefined>('readonly', (store) => store.get(id)).then((doc) => {
    const diagnostics: MigrationDiagnostic[] = []
    const profile = doc ? applyMigration(doc, diagnostics) : undefined
    return { profile, diagnostics }
  })
}

/**
 * Retrieve a single AircraftProfile by id.
 *
 * Back-compat shim: returns the migrated profile (or `undefined` when the
 * document is absent / dropped) and silently discards any drop diagnostic.
 * For new code that needs to surface drop notifications, call
 * {@link findByIdWithDiagnostics} instead.
 */
export function findById(id: string): Promise<AircraftProfile | undefined> {
  return findByIdWithDiagnostics(id).then((result) => result.profile)
}

/**
 * Retrieve all AircraftProfile documents alongside migration diagnostics.
 *
 * Documents whose stored `schemaVersion` is newer than this build can read
 * (PWA-cache rollback) — or whose contents are otherwise structurally
 * unmigratable — are *omitted* from `profiles` and a `MigrationDiagnostic`
 * is appended to `diagnostics` per dropped record. This is the documented
 * partial-load recovery path: the fleet UI keeps working with the readable
 * subset rather than failing the entire load on a single corrupt record.
 *
 * Prefer this race-free variant over the back-compat {@link findAll}, which
 * silently discards diagnostics.
 */
export function findAllWithDiagnostics(): Promise<{
  profiles: AircraftProfile[]
  diagnostics: readonly MigrationDiagnostic[]
}> {
  return withStore<AircraftProfile[]>('readonly', (store) => store.getAll()).then((docs) => {
    const diagnostics: MigrationDiagnostic[] = []
    const profiles: AircraftProfile[] = []
    for (const doc of docs) {
      const m = applyMigration(doc, diagnostics)
      if (m !== undefined) profiles.push(m)
    }
    return { profiles, diagnostics }
  })
}

/**
 * Retrieve all AircraftProfile documents.
 *
 * Back-compat shim: returns only the migrated profiles and silently discards
 * any drop diagnostics. For new code that needs to surface drop notifications,
 * call {@link findAllWithDiagnostics} instead.
 */
export function findAll(): Promise<AircraftProfile[]> {
  return findAllWithDiagnostics().then((result) => result.profiles)
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

/**
 * Delete every AircraftProfile document in the store in a single transaction.
 *
 * Underpins REQ-SYS-014 (Repository-Wide Wipe / Delete-All-Data). Resolves
 * once the `clear()` request succeeds (matching `create`/`update`/`deleteById`);
 * a subsequent read opens a fresh transaction that IndexedDB serialises after
 * the clear commits. The store itself is left present (only the row contents
 * are cleared) so subsequent writes continue to hit the same object store
 * without a re-`onupgradeneeded`.
 */
// @IMP-AC-STORE-009@ (FROM: @REQ-SYS-014@, @DES-ARCH-011@)
export function deleteAll(): Promise<void> {
  return withStore<undefined>('readwrite', (store) => store.clear()).then(() => undefined)
}

export const fleetRepository = {
  openDB,
  create,
  findById,
  findByIdWithDiagnostics,
  findAll,
  findAllWithDiagnostics,
  update,
  deleteById,
  deleteAll,
}
