/**
 * Data-rights service — pilot-facing GDPR Art. 15/17/20 controls.
 *
 * P2 Feature Module: orchestrates `fleetRepository` (IndexedDB) and the
 * browser's `localStorage` / `sessionStorage` to implement
 *  - REQ-SYS-014: Repository-Wide Wipe (Delete-All-Data)
 *  - REQ-SYS-015: Bulk JSON Export of all aircraft profiles
 *  - REQ-SYS-016: Age-Based Retention Purge (default 12 months)
 *
 * The service is intentionally framework-free so it can be unit-tested
 * in Node with `fake-indexeddb` and so the UI layer can call it from
 * a confirmed action handler without any extra wiring.
 *
 * @see docs/requirements/system.md REQ-SYS-014 / REQ-SYS-015 / REQ-SYS-016
 * @see PRIVACY.md § 5 (Storage & Retention) / § 6 (Data Subject Rights)
 */

import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { fleetRepository } from './fleet.repository'

// @IMP-SYS-STORE-013@ (FROM: @REQ-SYS-014@, @REQ-SYS-015@, @REQ-SYS-016@)

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

/** Default retention window for REQ-SYS-016: 12 months (≈365 days). */
export const DEFAULT_RETENTION_DAYS = 365

const MS_PER_DAY = 24 * 60 * 60 * 1000

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

/** A profile that is eligible for age-based purging. */
export interface PurgeCandidate {
  readonly id: string
  readonly registration: string
  readonly status: AircraftProfile['status']
  /** ISO date of the most recent weighing report's `validFrom` field. */
  readonly mostRecentValidFromIso: string
  /** Whole days elapsed between the most recent `validFrom` and `now`. */
  readonly ageDays: number
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

// ─── Age-Based Retention Purge (REQ-SYS-016) ──────────────────────────────

/**
 * Return the latest `validFrom` ISO date across a profile's weighing reports.
 * The AircraftProfileSchema guarantees at least one weighing report, so the
 * fallback path is defensive: a malformed profile from a future schema would
 * return `null` and be excluded from the purge candidate list.
 */
function mostRecentValidFrom(profile: AircraftProfile): string | null {
  const reports = profile.weighingReports
  if (!reports || reports.length === 0) return null
  let latest: string | null = null
  for (const r of reports) {
    if (typeof r.validFrom !== 'string') continue
    if (latest === null || r.validFrom > latest) latest = r.validFrom
  }
  return latest
}

/**
 * List every profile whose most-recent weighing-report `validFrom` is older
 * than the retention window. Does NOT delete anything — pure preview.
 *
 * @param retentionDays - inclusive retention window in whole days
 *                        (defaults to {@link DEFAULT_RETENTION_DAYS}).
 * @param now           - clock value (defaults to `new Date()`). Tests inject
 *                        a deterministic value here.
 */
export async function listPurgeCandidates(
  retentionDays: number = DEFAULT_RETENTION_DAYS,
  now: Date = new Date(),
): Promise<PurgeCandidate[]> {
  if (!Number.isFinite(retentionDays) || retentionDays < 0) {
    throw new RangeError(
      `retentionDays must be a non-negative finite number; received ${retentionDays}.`,
    )
  }

  const { profiles } = await fleetRepository.findAllWithDiagnostics()
  const candidates: PurgeCandidate[] = []
  const nowMs = now.getTime()

  for (const profile of profiles) {
    const latestIso = mostRecentValidFrom(profile)
    if (latestIso === null) continue
    const latestMs = Date.parse(latestIso)
    if (!Number.isFinite(latestMs)) continue
    const ageDays = Math.floor((nowMs - latestMs) / MS_PER_DAY)
    if (ageDays > retentionDays) {
      candidates.push({
        id: profile.id,
        registration: profile.registration,
        status: profile.status,
        mostRecentValidFromIso: latestIso,
        ageDays,
      })
    }
  }

  // Oldest first so the UI preview reads naturally top-to-bottom.
  candidates.sort((a, b) => b.ageDays - a.ageDays)
  return candidates
}

/**
 * Delete every profile returned by {@link listPurgeCandidates} for the same
 * retention window. Returns the records that were actually deleted (in the
 * same order as the preview) so the UI can surface a "deleted N records"
 * confirmation alongside the list.
 *
 * This is an explicit pilot-triggered action — not an `onMounted` startup
 * hook — because aircraft profiles can legitimately rely on multi-year-old
 * weighing reports (a BEM measured at the last annual inspection may still
 * be the source of truth). Silently deleting them on app start would be a
 * regression worse than the storage they consume.
 */
export async function purgeProfilesOlderThan(
  retentionDays: number = DEFAULT_RETENTION_DAYS,
  now: Date = new Date(),
): Promise<PurgeCandidate[]> {
  const candidates = await listPurgeCandidates(retentionDays, now)
  for (const c of candidates) {
    await fleetRepository.deleteById(c.id)
  }
  return candidates
}
