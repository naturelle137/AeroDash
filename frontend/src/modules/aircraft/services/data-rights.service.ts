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
import { fleetRepository } from './fleet.repository'

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

/** Identifier of the IndexedDB database holding the fleet. */
export const INDEXED_DB_FLEET_NAME = 'aerodash-fleet'

/** Outcome of a single Delete-All-Data run. */
export interface WipeReport {
  /** Number of aircraft profiles removed from IndexedDB. */
  readonly profilesDeleted: number
  /** localStorage keys removed (sorted, including the session payload). */
  readonly localStorageKeysCleared: readonly string[]
  /** sessionStorage keys removed (sorted, including the cold-start marker). */
  readonly sessionStorageKeysCleared: readonly string[]
  /** `true` once the IndexedDB object store has been emptied. */
  readonly indexedDbCleared: boolean
  /** ISO timestamp of the wipe (for surfacing to the pilot). */
  readonly clearedAt: string
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
 * Steps, in order:
 *   1. Empty the IndexedDB fleet store via {@link fleetRepository.deleteAll}.
 *   2. Remove every `aerodash`-prefixed key from `localStorage`.
 *   3. Remove every `aerodash`-prefixed key from `sessionStorage`.
 *
 * The function never throws on missing storage backends (private mode,
 * sandboxed iframe): if a storage facility raises, that step's cleared-key
 * list is empty in the returned {@link WipeReport} and the other steps
 * still run. The IndexedDB step **does** propagate errors so the calling
 * UI can surface a CRITICAL notification if the wipe could not be
 * completed — partial wipes that leave the fleet data behind silently
 * are the worst possible outcome for a privacy action.
 */
export async function wipeAllLocalData(): Promise<WipeReport> {
  // 1. Count profiles before clearing so the UI can report "Deleted N profiles".
  let profilesDeleted = 0
  try {
    const existing = await fleetRepository.findAllWithDiagnostics()
    profilesDeleted = existing.profiles.length
  } catch {
    profilesDeleted = 0
  }

  await fleetRepository.deleteAll()

  const localCleared = clearPrefixedKeys('local')
  const sessionCleared = clearPrefixedKeys('session')

  return {
    profilesDeleted,
    indexedDbCleared: true,
    localStorageKeysCleared: localCleared,
    sessionStorageKeysCleared: sessionCleared,
    clearedAt: new Date().toISOString(),
  }
}

/**
 * Remove every `aerodash`-prefixed key from the chosen Web Storage backend.
 * Returns the sorted list of cleared keys; on storage failure returns `[]`.
 */
function clearPrefixedKeys(kind: 'local' | 'session'): string[] {
  const storage = kind === 'local' ? safeLocalStorage() : safeSessionStorage()
  if (storage === null) return []
  const cleared: string[] = []
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
      // best-effort — surface a degraded clear, never throw
    }
  }
  cleared.sort()
  return cleared
}

function isAerodashKey(key: string): boolean {
  // Match `aerodash-`, `aerodash:`, `aerodash.`, or bare `aerodash`.
  return /^aerodash([-:.]|$)/i.test(key)
}

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
 * Profiles dropped by the schemaVersion migration registry (future version
 * / corrupt) are **omitted** from the export. The envelope is therefore an
 * accurate snapshot of the data the current build can actually rehydrate,
 * not a wishful list. Callers wanting the diagnostics for those drops can
 * use {@link fleetRepository.findAllWithDiagnostics} directly.
 */
export async function exportAllProfiles(now: Date = new Date()): Promise<BulkExportEnvelope> {
  const { profiles } = await fleetRepository.findAllWithDiagnostics()
  // Sort by registration so the file is diff-friendly across re-exports.
  const sorted = [...profiles].sort((a, b) => a.registration.localeCompare(b.registration))
  return {
    exportSchemaVersion: 1,
    exportedAt: now.toISOString(),
    profileCount: sorted.length,
    profiles: sorted,
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
