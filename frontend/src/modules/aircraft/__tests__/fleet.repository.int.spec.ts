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

  // @IT-AC-STORE-005@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-002@)
  it('round-trip: costPerHour persists and retrieves with full fidelity', async () => {
    const profile = buildProfile({
      id: '00000000-0000-4000-a000-000000000010',
      costPerHour: 185.5,
    })
    await create(profile)
    const found = await findById(profile.id)
    expect(found).toBeDefined()
    expect(found.costPerHour).toBe(185.5)
  })

  // @IT-AC-STORE-006@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-002@)
  it('round-trip: referenceDatumDescription persists and retrieves with full fidelity', async () => {
    const profile = buildProfile({
      id: '00000000-0000-4000-a000-000000000011',
      referenceDatumDescription: 'Firewall forward face',
    })
    await create(profile)
    const found = await findById(profile.id)
    expect(found).toBeDefined()
    expect(found.referenceDatumDescription).toBe('Firewall forward face')
  })

  // @IT-AC-STORE-007@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-002@)
  it('round-trip: checklistScaffold persists and retrieves with full fidelity', async () => {
    const profile = buildProfile({
      id: '00000000-0000-4000-a000-000000000012',
      checklistScaffold: [
        { title: 'Pre-flight', items: ['Check fuel', 'Check oil', 'Check control surfaces'] },
        { title: 'Engine start', items: ['Master switch ON', 'Throttle idle', 'Mixture rich'] },
      ],
    })
    await create(profile)
    const found = await findById(profile.id)
    expect(found).toBeDefined()
    expect(found.checklistScaffold).toHaveLength(2)
    expect(found.checklistScaffold[0].title).toBe('Pre-flight')
    expect(found.checklistScaffold[0].items).toEqual([
      'Check fuel',
      'Check oil',
      'Check control surfaces',
    ])
    expect(found.checklistScaffold[1].title).toBe('Engine start')
  })

  // @IT-AC-STORE-008@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-002@)
  it('round-trip: all three supplementary fields persist together with full fidelity', async () => {
    const profile = buildProfile({
      id: '00000000-0000-4000-a000-000000000013',
      costPerHour: 220.0,
      referenceDatumDescription: 'Leading edge of wing root',
      checklistScaffold: [
        { title: 'Normal procedures', items: ['Item A', 'Item B'] },
      ],
    })
    await create(profile)
    const found = await findById(profile.id)
    expect(found).toBeDefined()
    expect(found.costPerHour).toBe(220.0)
    expect(found.referenceDatumDescription).toBe('Leading edge of wing root')
    expect(found.checklistScaffold).toHaveLength(1)
    expect(found.checklistScaffold[0].title).toBe('Normal procedures')
  })

  // @IT-AC-STORE-009@ (FROM: @IMP-AC-STORE-001@, @IMP-AC-CORE-002@)
  it('round-trip: supplementary fields survive an update() cycle', async () => {
    const profile = buildProfile({
      id: '00000000-0000-4000-a000-000000000014',
      costPerHour: 100.0,
      checklistScaffold: [{ title: 'Before landing', items: ['Gear down'] }],
    })
    await create(profile)

    const updatedProfile = { ...profile, costPerHour: 150.0 }
    await update(updatedProfile)

    const found = await findById(profile.id)
    expect(found.costPerHour).toBe(150.0)
    expect(found.checklistScaffold).toHaveLength(1)
    expect(found.checklistScaffold[0].title).toBe('Before landing')
  })
})

describe('fleetRepository — schemaVersion persistence (refs #166)', () => {
  // @IT-AC-STORE-010@ (FROM: @IMP-AC-CORE-002@)
  it('schemaVersion field is persisted and retrieved correctly on create', async () => {
    const profile = buildProfile({
      id: '00000000-0000-4000-a000-000000000020',
      schemaVersion: 1,
    })
    await create(profile)

    const found = await findById(profile.id)
    expect(found).toBeDefined()
    expect(found!.schemaVersion).toBe(1)
  })

  // @IT-AC-STORE-011@ (FROM: @IMP-AC-CORE-002@)
  it('schemaVersion is preserved across update operations', async () => {
    const profile = buildProfile({
      id: '00000000-0000-4000-a000-000000000021',
      schemaVersion: 1,
    })
    await create(profile)

    const updated = { ...profile, registration: 'G-UPDT', schemaVersion: 2 }
    await update(updated)

    const found = await findById(profile.id)
    expect(found).toBeDefined()
    expect(found!.schemaVersion).toBe(2)
    expect(found!.registration).toBe('G-UPDT')
  })

  // @IT-AC-STORE-012@ (FROM: @IMP-AC-CORE-002@)
  it('all profiles returned by findAll carry a positive integer schemaVersion field', async () => {
    const p1 = buildProfile({
      id: '00000000-0000-4000-a000-000000000022',
      registration: 'D-SV01',
      schemaVersion: 1,
    })
    const p2 = buildProfile({
      id: '00000000-0000-4000-a000-000000000023',
      registration: 'D-SV02',
      schemaVersion: 1,
    })
    await create(p1)
    await create(p2)

    const all = await findAll()
    expect(all).toHaveLength(2)
    for (const p of all) {
      expect(typeof p.schemaVersion).toBe('number')
      expect(Number.isInteger(p.schemaVersion)).toBe(true)
      expect(p.schemaVersion).toBeGreaterThan(0)
    }
  })
})
