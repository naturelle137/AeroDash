/**
 * P1 unit tests for the AircraftProfile schemaVersion migration registry.
 *
 * Covers:
 *  - Legacy (no schemaVersion) → v1 stamping
 *  - Current v1 documents pass through unchanged
 *  - Unsupported future schemaVersion (PWA-cache downgrade scenario, #259)
 *  - Corrupt / non-object inputs
 *  - Zod failure surfacing without escape
 *  - Throwing up-function isolation (mid-migration crash recovery, #259)
 *
 * @see frontend/src/core/logic/profile-migrations.ts
 */

// @UT-AC-CORE-101@ (FROM: @IMP-AC-CORE-003@)

import { describe, it, expect } from 'vitest'
import {
  CURRENT_PROFILE_SCHEMA_VERSION,
  migrateProfileDocument,
  runProfileMigrationWalker,
  type ProfileMigration,
} from './profile-migrations'
import type { AircraftProfile } from '../adapters/aircraft.schema'

/** Build a minimal valid AircraftProfile-shaped document for migration. */
function buildV1Document(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    ownerId: 'user-test',
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'draft',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 110,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 650,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.841, mass: 432 },
          { armOrMoment: 1.841, mass: 650 },
          { armOrMoment: 1.978, mass: 650 },
          { armOrMoment: 1.978, mass: 432 },
        ],
      },
    ],
    ...overrides,
  }
}

describe('migrateProfileDocument — current-version pass-through', () => {
  it('returns a parsed profile when the stored version is current', () => {
    const result = migrateProfileDocument(buildV1Document())
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.profile.schemaVersion).toBe(CURRENT_PROFILE_SCHEMA_VERSION)
    expect(result.versionsApplied).toEqual([])
  })

  it('keeps the stored registration intact through the walker', () => {
    const result = migrateProfileDocument(buildV1Document({ registration: 'G-ABCD' }))
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.profile.registration).toBe('G-ABCD')
  })
})

describe('migrateProfileDocument — legacy v0 → v1 stamping', () => {
  it('stamps schemaVersion when the field is absent', () => {
    const doc = buildV1Document()
    delete (doc as { schemaVersion?: number }).schemaVersion
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.profile.schemaVersion).toBe(1)
    expect(result.versionsApplied).toEqual([0])
  })

  it('stamps schemaVersion when the field is the wrong type (string)', () => {
    const doc = buildV1Document({ schemaVersion: 'one' as unknown as number })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.profile.schemaVersion).toBe(1)
    expect(result.versionsApplied).toEqual([0])
  })

  it('stamps schemaVersion when stored value is NaN (corrupt numeric)', () => {
    const doc = buildV1Document({ schemaVersion: Number.NaN })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.profile.schemaVersion).toBe(1)
  })

  it('stamps schemaVersion when stored value is Infinity', () => {
    const doc = buildV1Document({ schemaVersion: Number.POSITIVE_INFINITY })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.profile.schemaVersion).toBe(1)
  })

  it('stamps schemaVersion when stored value is non-integer (1.5)', () => {
    const doc = buildV1Document({ schemaVersion: 1.5 })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.profile.schemaVersion).toBe(1)
  })

  it('stamps schemaVersion when stored value is negative', () => {
    const doc = buildV1Document({ schemaVersion: -2 })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.profile.schemaVersion).toBe(1)
  })
})

describe('migrateProfileDocument — unsupported future version (downgrade scenario)', () => {
  it('reports unsupported-future-version when stored version > current', () => {
    const doc = buildV1Document({ schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION + 1 })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('unsupported-future-version')
    if (result.kind !== 'unsupported-future-version') return
    expect(result.storedVersion).toBe(CURRENT_PROFILE_SCHEMA_VERSION + 1)
  })

  it('reports unsupported-future-version even when other fields are valid', () => {
    const doc = buildV1Document({ schemaVersion: 99, registration: 'G-FUTR' })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('unsupported-future-version')
  })

  it('does not attempt to parse the document when version is in the future', () => {
    // A future doc may carry fields that fail today's Zod schema. The walker
    // must report unsupported-future-version BEFORE Zod ever sees them so
    // diagnostics are unambiguous (rollback signal, not schema corruption).
    const doc = buildV1Document({
      schemaVersion: 5,
      // unknown future field that does not exist in current schema
      futureField: { nested: 'data' } as unknown,
    })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('unsupported-future-version')
  })
})

describe('migrateProfileDocument — corrupt input handling', () => {
  it('reports corrupt when input is null', () => {
    const result = migrateProfileDocument(null)
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt when input is undefined', () => {
    const result = migrateProfileDocument(undefined)
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt when input is a string', () => {
    const result = migrateProfileDocument('not-an-object')
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt when input is an array', () => {
    const result = migrateProfileDocument([1, 2, 3])
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt when input is a number', () => {
    const result = migrateProfileDocument(42)
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt with Zod issue summary when fields are structurally invalid', () => {
    const doc = buildV1Document({ registration: '' })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('corrupt')
    if (result.kind !== 'corrupt') return
    expect(result.reason).toContain('schema validation failed')
    expect(result.reason).toContain('registration')
  })

  it('reports corrupt when certificationCategories is missing', () => {
    const doc = buildV1Document()
    delete (doc as { certificationCategories?: unknown[] }).certificationCategories
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt when weighingReports is empty (min(1) constraint)', () => {
    const doc = buildV1Document({ weighingReports: [] })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('corrupt')
  })

  it('reports corrupt when id is not a valid UUID', () => {
    const doc = buildV1Document({ id: 'not-a-uuid' })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('corrupt')
  })
})

describe('runProfileMigrationWalker — registry-injection branches', () => {
  // Exercises the defensive branches that the production registry cannot reach
  // today: a missing up-function for a version in [storedVersion, currentVersion)
  // and an up-function that throws mid-walk. The corresponding fleet-store
  // contract — "no partial migration ever escapes the boundary" — only holds if
  // these branches behave exactly like the corrupt-input path.
  it('reports corrupt when an up-function is missing for an intermediate version', () => {
    const emptyRegistry: ReadonlyMap<number, ProfileMigration> = new Map()
    const doc = buildV1Document()
    // Treat the document as v0 so the walker must look up step 0.
    delete (doc as { schemaVersion?: number }).schemaVersion
    const result = runProfileMigrationWalker(doc, emptyRegistry, 1)
    expect(result.kind).toBe('corrupt')
    if (result.kind !== 'corrupt') return
    expect(result.reason).toContain('no migration registered for source version 0')
    expect(result.storedVersion).toBe(0)
  })

  it('reports corrupt and includes the thrown error message when an up-function throws', () => {
    const throwingRegistry: ReadonlyMap<number, ProfileMigration> = new Map([
      [
        0,
        (() => {
          throw new Error('synthetic up-function failure')
        }) as ProfileMigration,
      ],
    ])
    const doc = buildV1Document()
    delete (doc as { schemaVersion?: number }).schemaVersion
    const result = runProfileMigrationWalker(doc, throwingRegistry, 1)
    expect(result.kind).toBe('corrupt')
    if (result.kind !== 'corrupt') return
    expect(result.reason).toContain('migration 0 → 1 threw')
    expect(result.reason).toContain('synthetic up-function failure')
  })

  it('reports corrupt when a throwing up-function rejects with a non-Error value', () => {
    const throwingRegistry: ReadonlyMap<number, ProfileMigration> = new Map([
      [
        0,
        (() => {
          throw 'string-rejection'
        }) as ProfileMigration,
      ],
    ])
    const doc = buildV1Document()
    delete (doc as { schemaVersion?: number }).schemaVersion
    const result = runProfileMigrationWalker(doc, throwingRegistry, 1)
    expect(result.kind).toBe('corrupt')
    if (result.kind !== 'corrupt') return
    expect(result.reason).toContain('string-rejection')
  })

  it('still parses successfully when given the production registry (default-bound wrapper invariant)', () => {
    // Smoke check that the wrapper-vs-walker split has not subtly broken the
    // module-private binding used by migrateProfileDocument.
    const a = migrateProfileDocument(buildV1Document())
    expect(a.kind).toBe('migrated')
  })
})

describe('migrateProfileDocument — purity and determinism', () => {
  it('does not mutate the input document', () => {
    const doc = buildV1Document()
    delete (doc as { schemaVersion?: number }).schemaVersion
    const before = JSON.stringify(doc)
    migrateProfileDocument(doc)
    const after = JSON.stringify(doc)
    expect(after).toBe(before)
  })

  it('two invocations on the same input produce structurally equal outputs', () => {
    const doc = buildV1Document()
    const a = migrateProfileDocument(doc)
    const b = migrateProfileDocument(doc)
    expect(a.kind).toBe('migrated')
    expect(b.kind).toBe('migrated')
    if (a.kind !== 'migrated' || b.kind !== 'migrated') return
    expect(a.profile).toEqual(b.profile)
  })

  it('legacy stamping leaves all non-schemaVersion fields untouched', () => {
    const doc = buildV1Document({ costPerHour: 220 })
    delete (doc as { schemaVersion?: number }).schemaVersion
    const result = migrateProfileDocument(doc)
    if (result.kind !== 'migrated') throw new Error('expected migrated')
    const p: AircraftProfile = result.profile
    expect(p.costPerHour).toBe(220)
    expect(p.registration).toBe('D-EBPN')
  })
})

// ─── M4 round-trip: performance + surface + OSF + wind limits ────────────────

describe('migrateProfileDocument — M4 round-trip (REQ-AD-008/009/015/016/017)', () => {
  // @UT-AC-CORE-103@ (FROM: @IMP-AC-CORE-003@)
  // The performance-profile / surface-condition / OSF / wind-limit fields
  // shipped together in the v0.4.0 (M4) schema bump. Each is optional on the
  // Zod schema and therefore must survive the migration walker unchanged on
  // both the "current pass-through" path and the "legacy v0 stamping" path —
  // i.e. the walker treats them as opaque payload, never coerces them, never
  // drops them.
  const M4_FIELDS = {
    performanceProfiles: [
      {
        flightPhase: 'TakeoffRoll' as const,
        dataPoints: [
          { distance: 210, mass: 850, pressureAltitude: 0, temperature: 15 },
          { distance: 340, mass: 1157, pressureAltitude: 0, temperature: 15 },
        ],
      },
      {
        flightPhase: 'TakeoffDistance50ft' as const,
        dataPoints: [
          { distance: 340, mass: 850, pressureAltitude: 0, temperature: 15 },
          { distance: 545, mass: 1157, pressureAltitude: 0, temperature: 15 },
        ],
      },
    ],
    surfaceConditions: [
      { name: 'Dry Paved', takeoffFactor: 1.0, landingFactor: 1.0 },
      { name: 'Wet Grass', takeoffFactor: 1.3, landingFactor: 1.4 },
    ],
    safetyFactors: { takeoff: 1.25, landing: 1.43 },
    windLimits: [
      { component: 'MaxCrosswind' as const, value: 15, classification: 'Demonstrated' as const },
      { component: 'MaxTailwind' as const, value: 10, classification: 'Limit' as const },
    ],
  }

  it('preserves performance/surface/OSF/wind-limit payloads on a current-version document', () => {
    const result = migrateProfileDocument(buildV1Document(M4_FIELDS))
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    const p: AircraftProfile = result.profile
    expect(p.performanceProfiles).toEqual(M4_FIELDS.performanceProfiles)
    expect(p.surfaceConditions).toEqual(M4_FIELDS.surfaceConditions)
    expect(p.safetyFactors).toEqual(M4_FIELDS.safetyFactors)
    expect(p.windLimits).toEqual(M4_FIELDS.windLimits)
  })

  it('preserves the same payloads when the document is stamped from v0 to v1', () => {
    const doc = buildV1Document(M4_FIELDS)
    delete (doc as { schemaVersion?: number }).schemaVersion
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    const p: AircraftProfile = result.profile
    expect(p.schemaVersion).toBe(1)
    expect(p.performanceProfiles).toEqual(M4_FIELDS.performanceProfiles)
    expect(p.surfaceConditions).toEqual(M4_FIELDS.surfaceConditions)
    expect(p.safetyFactors).toEqual(M4_FIELDS.safetyFactors)
    expect(p.windLimits).toEqual(M4_FIELDS.windLimits)
  })

  it('rejects an M4 document that exceeds the 1000 data-point cap (REQ-AD-009)', () => {
    const dataPoints = Array.from({ length: 1001 }, (_, i) => ({
      distance: 100 + i,
      mass: 850,
      pressureAltitude: i,
      temperature: 15,
    }))
    const doc = buildV1Document({
      performanceProfiles: [{ flightPhase: 'TakeoffRoll', dataPoints }],
    })
    const result = migrateProfileDocument(doc)
    expect(result.kind).toBe('corrupt')
  })
})
