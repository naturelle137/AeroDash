/**
 * Integration tests for fleet.repository.ts using fake-indexeddb.
 *
 * @see frontend/src/modules/aircraft/services/fleet.repository.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { create, findById, findAll, update, deleteById } from '../services/fleet.repository'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

/** Reset IndexedDB between tests by replacing the global with a fresh instance. */
beforeEach(() => {
  // Replace global IndexedDB with a fresh fake for test isolation
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
})

/** Build a minimal valid AircraftProfile for test use. */
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
    status: 'Draft',
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

describe('fleetRepository — CRUD lifecycle', () => {
  // @IT-AC-STORE-001@ (FROM: @IMP-AC-STORE-001@)
  it('CRUD lifecycle: create, findById, update, delete', async () => {
    const profile = buildProfile()

    // Create
    await create(profile)

    // FindById
    const found = await findById(profile.id)
    expect(found).toBeDefined()
    expect(found!.registration).toBe('D-EBPN')
    expect(found!.status).toBe('Draft')

    // Update
    const updated: AircraftProfile = { ...profile, registration: 'D-ECSM', status: 'Verified' }
    await update(updated)

    const afterUpdate = await findById(profile.id)
    expect(afterUpdate!.registration).toBe('D-ECSM')
    expect(afterUpdate!.status).toBe('Verified')

    // Delete
    await deleteById(profile.id)
    const afterDelete = await findById(profile.id)
    expect(afterDelete).toBeUndefined()
  })

  // @IT-AC-STORE-002@ (FROM: @IMP-AC-STORE-001@)
  it('findAll returns all profiles', async () => {
    const p1 = buildProfile({ id: '00000000-0000-4000-a000-000000000001', registration: 'D-EBPN' })
    const p2 = buildProfile({ id: '00000000-0000-4000-a000-000000000002', registration: 'D-ECSM' })
    const p3 = buildProfile({ id: '00000000-0000-4000-a000-000000000003', registration: 'G-ABCD' })

    await create(p1)
    await create(p2)
    await create(p3)

    const all = await findAll()
    expect(all).toHaveLength(3)
    const regs = all.map((p) => p.registration).sort()
    expect(regs).toEqual(['D-EBPN', 'D-ECSM', 'G-ABCD'])
  })

  // @IT-AC-STORE-003@ (FROM: @IMP-AC-STORE-001@)
  it('findById returns undefined for a non-existent id', async () => {
    const result = await findById('00000000-0000-4000-a000-000000000099')
    expect(result).toBeUndefined()
  })

  // @IT-AC-STORE-004@ (FROM: @IMP-AC-STORE-001@)
  it('findAll returns empty array when store is empty', async () => {
    const all = await findAll()
    expect(all).toEqual([])
  })
})
