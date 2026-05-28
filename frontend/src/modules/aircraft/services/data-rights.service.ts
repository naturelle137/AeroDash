/**
 * Data-rights service — pilot-facing GDPR Art. 15/17/20 controls.
 *
 * P2 Feature Module: orchestrates `fleetRepository` (IndexedDB) and the
 * browser's `localStorage` / `sessionStorage` to implement
 *  - REQ-SYS-014: Erasure of all personal data the app holds (Delete-All-Data)
 *  - REQ-SYS-015: Export of all personal data the app holds
 *
 * The service is intentionally framework-free so it can be unit-tested
 * in Node with `fake-indexeddb` and so the UI layer can call it from
 * a confirmed action handler without any extra wiring.
 *
 * @see docs/requirements/system.md REQ-SYS-014 / REQ-SYS-015
 * @see PRIVACY.md § 5 (Storage & Retention) / § 6 (Data Subject Rights)
 */

import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { fleetRepository, DB_NAME, type MigrationDiagnostic } from './fleet.repository'

// @IMP-SYS-STORE-013@ (FROM: @REQ-SYS-014@, @REQ-SYS-015@)

// ─── Storage keys cleared by Delete-All-Data ──────────────────────────────
// These three live keys cover all known AeroDash persistence at v0.4.0-alpha:
//   • IndexedDB    `aerodash-fleet`             — pilot's saved aircraft
//   • localStorage `aerodash:session:payload`   — auto-saved M&B session
//   • sessionStorage `aerodash.session.active`  — PWA cold-start marker
//
// The localStorage iteration below also removes any other key whose name
// begins with `aerodash` (e.g. `aerodash-theme`) so a future component that
// adds a new key cannot silently survive a Delete-All-Data action.

/**
 * Identifier of the IndexedDB database holding the fleet. Re-exported from
 * {@link fleetRepository}'s {@link DB_NAME} so there is a single source of
 * truth — the wipe always targets whatever the repository actually opens.
 */
export const INDEXED_DB_FLEET_NAME = DB_NAME

/** A storage location that could not be cleared during a Delete-All-Data run. */
export interface WipeFailure {
  /** Which storage facility the failure occurred in. */
  readonly store: 'indexeddb' | 'localStorage' | 'sessionStorage'
  /**
   * The specific key that could not be removed, or `null` for a whole-store
   * failure (e.g. the IndexedDB `clear()` transaction rejecting).
   */
  readonly key: string | null
  /** Human-readable reason, for surfacing to the pilot. */
  readonly detail: string
}

/** Outcome of a single Delete-All-Data run. */
export interface WipeReport {
  /**
   * Number of stored aircraft records removed (readable + dropped/corrupt), or
   * `null` when the pre-deletion count could not be read — reporting a false
   * `0` would be a misleading erasure receipt.
   */
  readonly profilesDeleted: number | null
  /** localStorage keys removed (sorted, including the session payload). */
  readonly localStorageKeysCleared: readonly string[]
  /** sessionStorage keys removed (sorted, including the cold-start marker). */
  readonly sessionStorageKeysCleared: readonly string[]
  /** `true` once the IndexedDB object store has been emptied. */
  readonly indexedDbCleared: boolean
  /**
   * Storage locations that could **not** be cleared. Empty on a complete wipe.
   * REQ-SYS-014 forbids signalling success while any of these remain, so the
   * UI must surface a CRITICAL notice (not the success notice) when non-empty.
   */
  readonly failures: readonly WipeFailure[]
  /** `true` only when every store was cleared with no residual data. */
  readonly complete: boolean
  /** ISO timestamp of the wipe (for surfacing to the pilot). */
  readonly clearedAt: string
}

/**
 * Result of {@link exportAllProfiles}: the portable envelope plus any records
 * that could **not** be included so the caller can warn the user.
 */
export interface BulkExportResult {
  /** The serialisable envelope (only records this build can rehydrate). */
  readonly envelope: BulkExportEnvelope
  /**
   * Stored records omitted from the envelope because they could not be read
   * (future schema version / corrupt). Empty when the export is complete.
   * REQ-SYS-015 requires a *complete* copy, so a non-empty list must be
   * surfaced to the user rather than silently dropped — these same records
   * are also destroyed by a subsequent Delete-All-Data wipe.
   */
  readonly omitted: readonly MigrationDiagnostic[]
}

/** Top-level envelope for a bulk export-all JSON file. */
export interface BulkExportEnvelope {
  /**
   * Envelope schema version. Increment when the envelope shape changes;
   * the *profile* schema is versioned independently via `AircraftProfile.schemaVersion`.
   */
  readonly exportSchemaVersion: 1
  /** ISO timestamp at which the export was generated. */
  readonly exportedAt: string
  /** Convenience count to verify importers consume every record. */
  readonly profileCount: number
  /** The full set of aircraft profiles, verbatim from IndexedDB. */
  readonly profiles: readonly AircraftProfile[]
}

// ─── Repository-Wide Wipe (REQ-SYS-014) ───────────────────────────────────

/**
 * Clear every locally persisted AeroDash record.
 *
 * Steps:
 *   1. Empty the IndexedDB fleet store via {@link fleetRepository.deleteAll}.
 *   2. Remove every `aerodash`-prefixed key from `localStorage`.
 *   3. Remove every `aerodash`-prefixed key from `sessionStorage`.
 *
 * All three steps are **best-effort and run unconditionally** — a failure in
 * one store never short-circuits the others, because deleting as much data as
 * possible is the right outcome for an erasure request. Every failure (a
 * rejected IndexedDB `clear()`, or a per-key `removeItem` that throws) is
 * recorded in {@link WipeReport.failures}, and {@link WipeReport.complete} is
 * `false` whenever any failure occurred.
 *
 * This honours REQ-SYS-014 verbatim: "If any part of that data cannot be
 * deleted, then the system shall report the failure and shall not indicate the
 * erasure as complete." The function therefore never throws — the caller
 * inspects `complete` / `failures` and must surface a CRITICAL notice (rather
 * than a success notice) when the wipe was incomplete.
 */
export async function wipeAllLocalData(): Promise<WipeReport> {
  const failures: WipeFailure[] = []

  // Count records before clearing so the UI can report "Deleted N profiles".
  // Includes dropped/corrupt rows (`diagnostics`) because `deleteAll()` clears
  // every row in the store, not just the readable subset — counting only the
  // readable profiles would understate what was actually erased. If the count
  // read fails we report `null` (unknown), never a false `0`, since the wipe
  // below may still succeed and erase rows.
  let profilesDeleted: number | null
  try {
    const existing = await fleetRepository.findAllWithDiagnostics()
    profilesDeleted = existing.profiles.length + existing.diagnostics.length
  } catch {
    profilesDeleted = null
  }

  let indexedDbCleared = false
  try {
    await fleetRepository.deleteAll()
    indexedDbCleared = true
  } catch (err) {
    failures.push({
      store: 'indexeddb',
      key: null,
      detail: err instanceof Error ? err.message : 'IndexedDB clear failed',
    })
  }

  const local = clearPrefixedKeys('local')
  const session = clearPrefixedKeys('session')
  for (const key of local.failedKeys) {
    failures.push({ store: 'localStorage', key, detail: 'removeItem failed' })
  }
  for (const key of session.failedKeys) {
    failures.push({ store: 'sessionStorage', key, detail: 'removeItem failed' })
  }

  return {
    profilesDeleted,
    indexedDbCleared,
    localStorageKeysCleared: local.cleared,
    sessionStorageKeysCleared: session.cleared,
    failures,
    complete: failures.length === 0,
    clearedAt: new Date().toISOString(),
  }
}

/**
 * Remove every `aerodash`-prefixed key from the chosen Web Storage backend.
 *
 * Returns the sorted list of keys actually removed plus any keys whose
 * `removeItem` threw. A missing backend (private mode, sandboxed iframe)
 * yields empty lists and is **not** treated as a failure — there is nothing
 * to erase in that case.
 */
function clearPrefixedKeys(kind: 'local' | 'session'): {
  cleared: string[]
  failedKeys: string[]
} {
  const storage = kind === 'local' ? safeLocalStorage() : safeSessionStorage()
  if (storage === null) return { cleared: [], failedKeys: [] }
  const cleared: string[] = []
  const failedKeys: string[] = []
  // Iterate by index, but read keys into an array first because removeItem
  // shifts the indices of remaining entries (mutation during iteration).
  const keys: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i)
    if (k !== null && isAerodashKey(k)) keys.push(k)
  }
  for (const k of keys) {
    try {
      storage.removeItem(k)
      cleared.push(k)
    } catch {
      // Record the residue so the caller can report an incomplete erasure.
      failedKeys.push(k)
    }
  }
  cleared.sort()
  failedKeys.sort()
  return { cleared, failedKeys }
}

function isAerodashKey(key: string): boolean {
  // Match `aerodash-`, `aerodash:`, `aerodash.`, or bare `aerodash`.
  return /^aerodash([-:.]|$)/i.test(key)
}

// A `null` backend (private mode / sandboxed iframe / throwing accessor) is
// treated as "nothing to erase", not a failure: a storage facility that cannot
// be opened now could never have persisted an `aerodash` key in the first
// place. This invariant must be revisited if a future store can hold personal
// data while being intermittently inaccessible.
function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

// ─── Bulk JSON Export (REQ-SYS-015) ───────────────────────────────────────

/**
 * Collect every persisted aircraft profile into a portable {@link BulkExportEnvelope}.
 *
 * Profiles dropped by the schemaVersion migration registry (future version /
 * corrupt) cannot be serialised into the typed envelope, so they are omitted
 * from `envelope.profiles` — but their diagnostics are returned in
 * {@link BulkExportResult.omitted} so the caller can warn the user that the
 * copy is not complete (REQ-SYS-015). Silently dropping them would be
 * doubly unsafe: the export would understate the data held, and a follow-up
 * Delete-All-Data wipe (`store.clear()`) would then destroy those same rows.
 */
export async function exportAllProfiles(now: Date = new Date()): Promise<BulkExportResult> {
  const { profiles, diagnostics } = await fleetRepository.findAllWithDiagnostics()
  // Sort by registration so the file is diff-friendly across re-exports. Pin
  // the locale so the order is stable regardless of the host machine's locale.
  const sorted = [...profiles].sort((a, b) => a.registration.localeCompare(b.registration, 'en'))
  return {
    envelope: {
      exportSchemaVersion: 1,
      exportedAt: now.toISOString(),
      profileCount: sorted.length,
      profiles: sorted,
    },
    omitted: diagnostics,
  }
}

/**
 * Render a {@link BulkExportEnvelope} to a pretty-printed JSON string suitable
 * for download. Two-space indentation keeps the file readable when a pilot
 * opens it in a text editor without inflating it dramatically.
 */
export function serializeBulkExport(envelope: BulkExportEnvelope): string {
  return JSON.stringify(envelope, null, 2)
}
