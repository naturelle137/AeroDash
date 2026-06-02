/**
 * Integration tests for fleet.repository.ts schemaVersion migration registry.
 *
 * Exercises the on-read migration path documented in
 * `frontend/src/core/logic/profile-migrations.ts` against a real (faked) IndexedDB,
 * specifically the two scenarios called out by the v0.3.0-alpha audit (refs #259):
 *
 *   1. Downgrade after PWA cache rollback — IDB holds a document whose
 *      `schemaVersion` is greater than the running build can read.
 *   2. Mid-migration crash recovery — IDB holds a mix of migrated and
 *      not-yet-migrated documents because a prior load was interrupted.
 *
 * @see frontend/src/modules/aircraft/services/fleet.repository.ts
 * @see frontend/src/core/logic/profile-migrations.ts
 */

// @IT-AC-STORE-101@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import {
  _resetFleetDbHandleForTest,
  create,
  findById,
  findAll,
  findAllWithDiagnostics,
  findByIdWithDiagnostics,
} from '../services/fleet.repository'
import { CURRENT_PROFILE_SCHEMA_VERSION } from '@/core/logic/profile-migrations'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
  _resetFleetDbHandleForTest()
})

/** Minimal valid AircraftProfile fixture. */
function buildProfile(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
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

/**
 * A "raw" document seeded into the fleet store before the production write
 * path's Zod gate runs — used to recreate the partial-corruption and future-
 * version scenarios the repository must recover from. Typed as `object` so
 * callers can pass real `AircraftProfile`s plus arbitrary extra fields without
 * a `as unknown as Record<string, unknown>` ladder (TECH-020).
 */
type RawFleetDoc = object

/**
 * Write a raw document directly into the canonical fleet store, bypassing the
 * repository's `create()` Zod gate. This is the only way to seed test
 * scenarios that the production write path explicitly forbids — namely a
 * `schemaVersion` from the future and a structurally broken record.
 */
async function seedRaw(doc: RawFleetDoc, dbVersion = 2): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('aerodash-fleet', dbVersion)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('aircraft_profiles')) {
        const store = db.createObjectStore('aircraft_profiles', { keyPath: 'id' })
        store.createIndex('ownerId', 'ownerId', { unique: false })
        store.createIndex('registration', 'registration', { unique: false })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('aircraft_profiles', 'readwrite')
      const store = tx.objectStore('aircraft_profiles')
      const putReq = store.put(doc)
      putReq.onsuccess = () => undefined
      putReq.onerror = () => reject(putReq.error)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

// ─── Downgrade scenarios (PWA cache rollback) ─────────────────────────────────

describe('fleetRepository — downgrade after PWA cache rollback (refs #259)', () => {
  // @IT-AC-STORE-102@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)
  it('drops a single document whose schemaVersion is from a future build', async () => {
    const futureId = '00000000-0000-4000-a000-0000000000f0'
    const futureDoc = {
      ...buildProfile({ id: futureId, registration: 'D-FUTR' }),
      // Pretend a future build stamped this profile with v2, plus a field that
      // doesn't exist in today's schema. We must NOT silently drop the field
      // and parse the document as if it were valid.
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION + 1,
      futureField: { nested: 'data' },
    }

    await seedRaw(futureDoc)

    const { profiles, diagnostics } = await findAllWithDiagnostics()
    expect(profiles).toHaveLength(0)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]!.id).toBe(futureId)
    expect(diagnostics[0]!.reason).toBe('unsupported-future-version')
    expect(diagnostics[0]!.storedVersion).toBe(CURRENT_PROFILE_SCHEMA_VERSION + 1)
  })

  // @IT-AC-STORE-103@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)
  it('returns undefined and emits a future-version diagnostic for findByIdWithDiagnostics', async () => {
    const futureId = '00000000-0000-4000-a000-0000000000f1'
    await seedRaw({
      ...buildProfile({ id: futureId, registration: 'D-F1ND' }),
      schemaVersion: 42,
    })

    const { profile, diagnostics } = await findByIdWithDiagnostics(futureId)
    expect(profile).toBeUndefined()

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]!.reason).toBe('unsupported-future-version')
    expect(diagnostics[0]!.storedVersion).toBe(42)
  })

  // @IT-AC-STORE-104@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)
  it('keeps readable v1 profiles when one v-future doc is present (partial load)', async () => {
    const goodId = '00000000-0000-4000-a000-0000000000a0'
    const futureId = '00000000-0000-4000-a000-0000000000f2'

    await create(buildProfile({ id: goodId, registration: 'D-OK01' }))

    await seedRaw({
      ...buildProfile({ id: futureId, registration: 'D-FU02' }),
      schemaVersion: 99,
    })

    const { profiles, diagnostics } = await findAllWithDiagnostics()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]!.registration).toBe('D-OK01')

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]!.reason).toBe('unsupported-future-version')
    expect(diagnostics[0]!.id).toBe(futureId)
  })
})

// ─── Corruption / partial-migration recovery ─────────────────────────────────

describe('fleetRepository — corruption + partial-migration crash recovery (refs #259)', () => {
  // @IT-AC-STORE-105@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)
  it('drops a structurally invalid document and emits a corrupt diagnostic', async () => {
    const badId = '00000000-0000-4000-a000-0000000000b0'
    await seedRaw({
      id: badId,
      schemaVersion: 1,
      // Almost all required fields missing — simulates partial write before crash.
      registration: 'D-CRPT',
    })

    const { profiles, diagnostics } = await findAllWithDiagnostics()
    expect(profiles).toHaveLength(0)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]!.id).toBe(badId)
    expect(diagnostics[0]!.reason).toBe('corrupt')
  })

  // @IT-AC-STORE-106@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)
  it('recovers cleanly from a mid-migration state (mix of v0 legacy + v1 docs)', async () => {
    // Simulates a build that wrote some docs through `create()` (v1) and was
    // interrupted before stamping older legacy records. On the next load the
    // on-read migration walker must repair the v0 records without dropping
    // the already-migrated v1 records.
    const legacyId = '00000000-0000-4000-a000-0000000000c0'
    const v1Id = '00000000-0000-4000-a000-0000000000c1'

    // v1 doc via the normal write path
    await create(buildProfile({ id: v1Id, registration: 'D-V101' }))

    // Legacy v0 doc seeded raw — schemaVersion field is *missing*
    const legacyDoc: Partial<AircraftProfile> & { schemaVersion?: number } = buildProfile({
      id: legacyId,
      registration: 'D-LEG0',
    })
    delete legacyDoc.schemaVersion
    await seedRaw(legacyDoc)

    const { profiles, diagnostics } = await findAllWithDiagnostics()
    expect(profiles).toHaveLength(2)
    const byReg = Object.fromEntries(profiles.map((p) => [p.registration, p]))
    expect(byReg['D-V101']!.schemaVersion).toBe(1)
    expect(byReg['D-LEG0']!.schemaVersion).toBe(1)

    // The legacy doc must have been forward-stamped by the migration walker
    // even though the bytes on disk still carry no version field.
    expect(diagnostics).toHaveLength(0)
  })

  // @IT-AC-STORE-107@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)
  it('handles a fleet with a corrupt doc, a future-version doc, and a healthy doc together', async () => {
    const okId = '00000000-0000-4000-a000-0000000000d0'
    const corruptId = '00000000-0000-4000-a000-0000000000d1'
    const futureId = '00000000-0000-4000-a000-0000000000d2'

    await create(buildProfile({ id: okId, registration: 'D-OK99' }))

    await seedRaw({
      id: corruptId,
      schemaVersion: 1,
      registration: 'D-CR99',
      // missing required structure → Zod fails
    })

    await seedRaw({
      ...buildProfile({ id: futureId, registration: 'D-FU99' }),
      schemaVersion: 7,
    })

    const { profiles, diagnostics } = await findAllWithDiagnostics()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]!.registration).toBe('D-OK99')

    expect(diagnostics).toHaveLength(2)
    const reasons = diagnostics.map((d) => d.reason).sort()
    expect(reasons).toEqual(['corrupt', 'unsupported-future-version'])
  })

  // @IT-AC-STORE-108@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)
  it('diagnostics are per-call — interleaved findAll / findById do not cross-contaminate', async () => {
    // Before the per-call refactor (#353 review feedback), a single module
    // buffer could mix diagnostics from two concurrent loads. With the tuple
    // API each call's diagnostics are returned in its own promise resolution.
    const futureId = '00000000-0000-4000-a000-0000000000e0'
    const corruptId = '00000000-0000-4000-a000-0000000000e1'

    await seedRaw({
      ...buildProfile({ id: futureId, registration: 'D-FU99' }),
      schemaVersion: 50,
    })
    await seedRaw({
      id: corruptId,
      schemaVersion: 1,
      registration: 'D-CR99',
    })

    const [allResult, byIdResult] = await Promise.all([
      findAllWithDiagnostics(),
      findByIdWithDiagnostics(futureId),
    ])

    // findAll sees both dropped docs; findById sees only the future one.
    expect(allResult.diagnostics).toHaveLength(2)
    expect(byIdResult.diagnostics).toHaveLength(1)
    expect(byIdResult.diagnostics[0]!.reason).toBe('unsupported-future-version')
    expect(byIdResult.profile).toBeUndefined()
  })

  // @IT-AC-STORE-110@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-003@)
  it('back-compat findAll / findById silently discard diagnostics for callers that opt out', async () => {
    await seedRaw({
      ...buildProfile({ id: '00000000-0000-4000-a000-0000000000ea', registration: 'D-DR01' }),
      schemaVersion: 50,
    })

    const all = await findAll()
    expect(all).toHaveLength(0)
    const one = await findById('00000000-0000-4000-a000-0000000000ea')
    expect(one).toBeUndefined()
  })
})

// ─── Envelope round-trip with migration (refs #259) ─────────────────────────

describe('fleetRepository — exchange envelope import back-compat', () => {
  // @IT-AC-STORE-109@ (FROM: @IMP-AC-STORE-008@, @IMP-AC-CORE-003@)
  it('a profile imported from a legacy bare-profile JSON persists with schemaVersion=1', async () => {
    // This is the migration story across the export/import surface: a bare-
    // profile JSON file produced by an older build is still imported, and
    // round-trips through the repository as a current-schema document.
    const { importProfileFromJson } = await import('../services/profile.import')
    const legacyJson = JSON.stringify({
      ...buildProfile({ registration: 'D-LEG1' }),
      // Older exports may not have stamped schemaVersion at all.
      schemaVersion: undefined,
    })

    const imported = importProfileFromJson(legacyJson)
    expect(imported.schemaVersion).toBe(1)
    await create(imported)

    const found = await findById(imported.id)
    expect(found).toBeDefined()
    expect(found!.registration).toBe('D-LEG1')
    expect(found!.schemaVersion).toBe(1)
  })
})
