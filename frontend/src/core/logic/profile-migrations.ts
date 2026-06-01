/**
 * Aircraft Profile schemaVersion Migration Registry.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * Resilience model for stored `AircraftProfile` documents.
 *
 * Background:
 *  - The `aerodash-fleet` IndexedDB store writes a `schemaVersion: 1` field on
 *    every document but, until this module shipped, never *read* it back on
 *    load. Documents were rehydrated through `AircraftProfileSchema.parse`
 *    only — which silently absorbs unknown fields from a *newer* schema and
 *    throws on the rare structural mismatch, with no way to distinguish a
 *    future downgrade from an actually corrupt document.
 *  - This is the registry that closes that gap.
 *
 * Contract — every document read through the fleet repository is first routed
 * through {@link migrateProfileDocument}, which:
 *
 *  1. Extracts the stored `schemaVersion` (defaulting to 0 when the field is
 *     missing or non-numeric — historic legacy state).
 *  2. Walks the registry up to {@link CURRENT_PROFILE_SCHEMA_VERSION}, applying
 *     each `n → n+1` up-function in order. Every up-function is a pure
 *     `Record<string, unknown> → Record<string, unknown>` transform; failures
 *     are caught and the document is reported as `corrupt` rather than
 *     escaping as an unhandled exception.
 *  3. Validates the migrated document against `AircraftProfileSchema`. Any
 *     Zod failure surfaces as `corrupt` with the issue summary attached.
 *  4. When the stored version is strictly greater than
 *     `CURRENT_PROFILE_SCHEMA_VERSION` — a PWA-cache rollback after a forward
 *     migration — the document is reported as `unsupported-future-version` so
 *     the caller can drop it (rather than truncating fields silently).
 *
 * @see docs/architecture/aircraft_data_model.md
 * @see docs/architecture/adr/006-indexeddb-fleet-persistence.md
 */

// @IMP-AC-CORE-003@ (FROM: @REQ-AC-001@, @REQ-SYS-013@)

import { AircraftProfileSchema, type AircraftProfile } from '../adapters/aircraft.schema'

/**
 * Current `AircraftProfile` schema version.
 *
 * Bump in lockstep with the schema's `schemaVersion` default. Adding a new
 * up-function below MUST raise this constant by exactly one so the migration
 * walker has a target to converge on.
 */
export const CURRENT_PROFILE_SCHEMA_VERSION = 1 as const

/** Up-function: transform a document from version `fromVersion` to `fromVersion + 1`. */
export type ProfileMigration = (doc: Record<string, unknown>) => Record<string, unknown>

/**
 * Registry of per-version up-functions.
 *
 * Keyed by the *source* version. Adding migration `n → n+1` is done by:
 *   1. Bumping {@link CURRENT_PROFILE_SCHEMA_VERSION} from `n` to `n + 1`.
 *   2. Registering `n` here with the pure transform.
 *   3. Updating `AircraftProfileSchema.schemaVersion` default to `n + 1`.
 *
 * The current registry only contains the `0 → 1` stamping migration: documents
 * written by builds that predate the `schemaVersion` field are treated as
 * implicit v0 and forward-stamped to v1 without structural changes.
 */
const migrations: ReadonlyMap<number, ProfileMigration> = new Map<number, ProfileMigration>([
  [
    0,
    /**
     * v0 → v1: stamp the `schemaVersion` field on legacy documents persisted
     * before the field shipped. No structural transformation is applied; v0
     * documents are structurally identical to v1 documents (the field was the
     * only thing missing) and the schema's defaults reinstate any other field
     * that was nullable-by-omission.
     *
     * IMPORTANT — this `0 → 1` entry must be kept indefinitely (or replaced
     * with an equivalent default-stamping step at the lowest registered
     * version). The on-read walker does NOT write the migrated document back
     * to IndexedDB, so a v0 document on disk is re-migrated on every load.
     * Removing this entry — even after long soak time — would brick every
     * legacy document that never went through a verify/edit write cycle. Any
     * future ADR that proposes pruning legacy migrations MUST first migrate
     * stored documents to the new floor version on write.
     */
    (doc) => ({ ...doc, schemaVersion: 1 }),
  ],
])

/** Outcome of a single migration attempt. */
export type ProfileMigrationOutcome =
  | {
      readonly kind: 'migrated'
      readonly profile: AircraftProfile
      /** Source version → target version steps actually applied. */
      readonly versionsApplied: readonly number[]
    }
  | {
      readonly kind: 'unsupported-future-version'
      readonly storedVersion: number
    }
  | {
      readonly kind: 'corrupt'
      readonly storedVersion: number
      readonly reason: string
    }

/**
 * Extract the stored schema version from a raw document.
 *
 * Returns `0` for any document that does not have a numeric, finite, positive
 * integer `schemaVersion` field. Treating "missing or invalid" as v0 routes
 * legacy documents through the v0 → v1 stamping migration and gives genuinely
 * corrupt documents a stable entry point into the migration walker.
 */
function readStoredVersion(doc: Record<string, unknown>): number {
  const raw = doc['schemaVersion']
  if (typeof raw !== 'number') return 0
  if (!Number.isFinite(raw)) return 0
  if (!Number.isInteger(raw)) return 0
  if (raw < 0) return 0
  return raw
}

/**
 * Walk a raw document through a supplied migration registry up to
 * `currentVersion`. Pure, parameterised version of {@link migrateProfileDocument}
 * — extracted so the defensive branches (missing-step and throwing-up-function)
 * are reachable from tests with a synthetic registry without forcing the
 * production caller to know about any of those knobs.
 *
 * The default-bound wrapper {@link migrateProfileDocument} passes the
 * module-private registry and {@link CURRENT_PROFILE_SCHEMA_VERSION}; callers
 * MUST keep using the wrapper so the on-read walker stays consistent.
 */
export function runProfileMigrationWalker(
  raw: unknown,
  registry: ReadonlyMap<number, ProfileMigration>,
  currentVersion: number,
): ProfileMigrationOutcome {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'corrupt', storedVersion: 0, reason: 'document is not an object' }
  }

  const doc = raw as Record<string, unknown>
  const storedVersion = readStoredVersion(doc)

  if (storedVersion > currentVersion) {
    return { kind: 'unsupported-future-version', storedVersion }
  }

  let working: Record<string, unknown> = { ...doc }
  const versionsApplied: number[] = []

  for (let v = storedVersion; v < currentVersion; v++) {
    const step = registry.get(v)
    if (!step) {
      return {
        kind: 'corrupt',
        storedVersion,
        reason: `no migration registered for source version ${v}`,
      }
    }
    try {
      working = step(working)
    } catch (err) {
      return {
        kind: 'corrupt',
        storedVersion,
        reason: `migration ${v} → ${v + 1} threw: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
    versionsApplied.push(v)
  }

  // Final structural validation. Zod's `.default()` clauses replace any field
  // an older document may have legitimately omitted (e.g. `passengerProfiles`,
  // `powertrain`) without requiring a dedicated up-function for each one.
  const parsed = AircraftProfileSchema.safeParse(working)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    return { kind: 'corrupt', storedVersion, reason: `schema validation failed: ${issues}` }
  }

  return { kind: 'migrated', profile: parsed.data, versionsApplied }
}

/**
 * Migrate a raw, IndexedDB-shaped document up to the current schema version.
 *
 * `raw` is treated defensively — any non-object input is reported as `corrupt`
 * rather than crashing the caller. Each step is wrapped in a try/catch so a
 * single throwing up-function cannot poison the whole fleet load (the
 * partial-migration crash recovery guarantee).
 */
export function migrateProfileDocument(raw: unknown): ProfileMigrationOutcome {
  return runProfileMigrationWalker(raw, migrations, CURRENT_PROFILE_SCHEMA_VERSION)
}
