/**
 * Unit tests for fleet.repository.ts
 * Uses fake-indexeddb to simulate the browser IndexedDB environment
 * at the unit level (no network, no disk, single module under test).
 *
 * @see frontend/src/modules/aircraft/services/fleet.repository.ts
 */

// @UT-AC-STORE-034@ (FROM: @IMP-AC-STORE-001@)

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { fleetRepository } from '../services/fleet.repository'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

/** Reset IndexedDB between tests to guarantee isolation. */
beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
})

/** Build a minimal valid AircraftProfile for test use. */
function buildProfile(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
  return {
    id: '11111111-0000-4000-a000-000000000001',
    ownerId: 'user-unit-test',
    registration: 'D-UNIT',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'draft',
    schemaVersion: 1,
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

describe('fleetRepository.create', () => {
  // @UT-AC-STORE-034@ (FROM: @IMP-AC-STORE-001@)
  it('stores a profile and allows retrieval by id', async () => {
    const profile = buildProfile()
    await fleetRepository.create(profile)
    const found = await fleetRepository.findById(profile.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(profile.id)
    expect(found!.registration).toBe('D-UNIT')
    expect(found!.status).toBe('draft')
    expect(found!.schemaVersion).toBe(1)
  })

  // @UT-AC-STORE-035@ (FROM: @IMP-AC-STORE-001@)
  it('preserves all fields including passengerProfiles', async () => {
    const profile = buildProfile({
      passengerProfiles: [{ name: 'Standard Adult', standardWeight: 86, unit: 'kg' }],
    })
    await fleetRepository.create(profile)
    const found = await fleetRepository.findById(profile.id)
    expect(found!.passengerProfiles).toHaveLength(1)
    expect(found!.passengerProfiles[0]!.name).toBe('Standard Adult')
    expect(found!.passengerProfiles[0]!.standardWeight).toBe(86)
  })

  // @UT-AC-STORE-036@ (FROM: @IMP-AC-STORE-001@)
  it('rejects duplicate id (IDBRequest error propagated)', async () => {
    const profile = buildProfile()
    await fleetRepository.create(profile)
    await expect(fleetRepository.create(profile)).rejects.toThrow(Error)
  })
})

describe('fleetRepository.findById', () => {
  // @UT-AC-STORE-037@ (FROM: @IMP-AC-STORE-001@)
  it('returns undefined for a non-existent id', async () => {
    const result = await fleetRepository.findById('00000000-0000-4000-a000-999999999999')
    expect(result).toBeUndefined()
  })

  // @UT-AC-STORE-038@ (FROM: @IMP-AC-STORE-001@)
  it('returns the correct profile when multiple exist', async () => {
    const p1 = buildProfile({ id: '11111111-0000-4000-a000-000000000001', registration: 'D-AAA' })
    const p2 = buildProfile({ id: '11111111-0000-4000-a000-000000000002', registration: 'D-BBB' })
    await fleetRepository.create(p1)
    await fleetRepository.create(p2)

    const found = await fleetRepository.findById(p2.id)
    expect(found!.registration).toBe('D-BBB')
  })
})

describe('fleetRepository.findAll', () => {
  // @UT-AC-STORE-039@ (FROM: @IMP-AC-STORE-001@)
  it('returns empty array when the store is empty', async () => {
    const all = await fleetRepository.findAll()
    expect(all).toEqual([])
  })

  // @UT-AC-STORE-040@ (FROM: @IMP-AC-STORE-001@)
  it('returns all stored profiles', async () => {
    const p1 = buildProfile({ id: '11111111-0000-4000-a000-000000000001', registration: 'D-AAA' })
    const p2 = buildProfile({ id: '11111111-0000-4000-a000-000000000002', registration: 'D-BBB' })
    const p3 = buildProfile({ id: '11111111-0000-4000-a000-000000000003', registration: 'G-XYZ' })
    await fleetRepository.create(p1)
    await fleetRepository.create(p2)
    await fleetRepository.create(p3)

    const all = await fleetRepository.findAll()
    expect(all).toHaveLength(3)
    const registrations = all.map((p) => p.registration).sort()
    expect(registrations).toEqual(['D-AAA', 'D-BBB', 'G-XYZ'])
  })
})

describe('fleetRepository.update', () => {
  // @UT-AC-STORE-041@ (FROM: @IMP-AC-STORE-001@)
  it('replaces a profile document in the store', async () => {
    const profile = buildProfile()
    await fleetRepository.create(profile)

    const updated: AircraftProfile = { ...profile, registration: 'D-UPDT', status: 'verified' }
    await fleetRepository.update(updated)

    const found = await fleetRepository.findById(profile.id)
    expect(found!.registration).toBe('D-UPDT')
    expect(found!.status).toBe('verified')
  })

  // @UT-AC-STORE-042@ (FROM: @IMP-AC-STORE-001@)
  it('update does not affect other profiles', async () => {
    const p1 = buildProfile({ id: '11111111-0000-4000-a000-000000000001', registration: 'D-AAA' })
    const p2 = buildProfile({ id: '11111111-0000-4000-a000-000000000002', registration: 'D-BBB' })
    await fleetRepository.create(p1)
    await fleetRepository.create(p2)

    const updated: AircraftProfile = { ...p1, registration: 'D-MOD' }
    await fleetRepository.update(updated)

    const p2AfterUpdate = await fleetRepository.findById(p2.id)
    expect(p2AfterUpdate!.registration).toBe('D-BBB')
  })
})

describe('fleetRepository.deleteById', () => {
  // @UT-AC-STORE-043@ (FROM: @IMP-AC-STORE-001@)
  it('removes a profile so findById returns undefined', async () => {
    const profile = buildProfile()
    await fleetRepository.create(profile)
    await fleetRepository.deleteById(profile.id)
    const found = await fleetRepository.findById(profile.id)
    expect(found).toBeUndefined()
  })

  // @UT-AC-STORE-044@ (FROM: @IMP-AC-STORE-001@)
  it('deleteById is idempotent — no error when deleting a non-existent id', async () => {
    await expect(
      fleetRepository.deleteById('00000000-0000-4000-a000-999999999999'),
    ).resolves.toBeUndefined()
  })

  // @UT-AC-STORE-045@ (FROM: @IMP-AC-STORE-001@)
  it('does not remove other profiles when deleting one', async () => {
    const p1 = buildProfile({ id: '11111111-0000-4000-a000-000000000001', registration: 'D-AAA' })
    const p2 = buildProfile({ id: '11111111-0000-4000-a000-000000000002', registration: 'D-BBB' })
    await fleetRepository.create(p1)
    await fleetRepository.create(p2)

    await fleetRepository.deleteById(p1.id)

    const all = await fleetRepository.findAll()
    expect(all).toHaveLength(1)
    expect(all[0]!.registration).toBe('D-BBB')
  })
})

describe('fleetRepository CRUD round-trip', () => {
  // @UT-AC-STORE-046@ (FROM: @IMP-AC-STORE-001@)
  it('full lifecycle: create → findById → update → findAll → deleteById → empty', async () => {
    const profile = buildProfile({ status: 'draft' })

    // Create
    await fleetRepository.create(profile)
    const created = await fleetRepository.findById(profile.id)
    expect(created!.status).toBe('draft')

    // Update
    const updated: AircraftProfile = { ...profile, status: 'verified', registration: 'D-DONE' }
    await fleetRepository.update(updated)
    const afterUpdate = await fleetRepository.findById(profile.id)
    expect(afterUpdate!.status).toBe('verified')
    expect(afterUpdate!.registration).toBe('D-DONE')

    // findAll
    const all = await fleetRepository.findAll()
    expect(all).toHaveLength(1)

    // Delete
    await fleetRepository.deleteById(profile.id)
    const all2 = await fleetRepository.findAll()
    expect(all2).toHaveLength(0)
  })

  // @UT-AC-STORE-047@ (FROM: @IMP-AC-STORE-001@)
  it('preserves Verified status and passengerProfiles through round-trip', async () => {
    const profile = buildProfile({
      status: 'verified',
      passengerProfiles: [
        { name: 'Standard Adult', standardWeight: 86, unit: 'kg' },
        { name: 'Child', standardWeight: 35, unit: 'kg' },
      ],
    })
    await fleetRepository.create(profile)
    const retrieved = await fleetRepository.findById(profile.id)
    expect(retrieved!.status).toBe('verified')
    expect(retrieved!.passengerProfiles).toHaveLength(2)
    expect(retrieved!.passengerProfiles[0]!.standardWeight).toBe(86)
    expect(retrieved!.passengerProfiles[1]!.name).toBe('Child')
  })
})
