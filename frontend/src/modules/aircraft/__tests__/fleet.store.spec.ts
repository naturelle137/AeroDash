/**
 * Unit tests for fleet.store.ts
 * Mocks IndexedDB via fake-indexeddb.
 *
 * @see frontend/src/modules/aircraft/stores/fleet.store.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFleetStore, VerifiedMutationError } from '../stores/fleet.store'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// Mock the fleet repository so we don't need real IndexedDB in unit tests
vi.mock('../services/fleet.repository', () => ({
  fleetRepository: {
    findAll: vi.fn<() => Promise<AircraftProfile[]>>().mockResolvedValue([]),
    create: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    update: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteById: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    findById: vi.fn<() => Promise<AircraftProfile | undefined>>().mockResolvedValue(undefined),
    openDB: vi.fn<() => Promise<IDBDatabase>>().mockResolvedValue({} as IDBDatabase),
  },
}))

/** Minimal valid profile data (omitting id/status/schemaVersion). */
function minimalProfileData(): Omit<AircraftProfile, 'id' | 'status' | 'schemaVersion'> {
  return {
    ownerId: 'user-test',
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
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
  }
}

describe('useFleetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @UT-AC-STORE-025@ (FROM: @IMP-AC-STORE-005@)
  it('creates Draft profile by default', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    expect(profile.status).toBe('draft')
    expect(profile.schemaVersion).toBe(1)
    expect(store.profiles).toHaveLength(1)
    expect(store.profiles[0]!.status).toBe('draft')
  })

  // @UT-AC-STORE-026@ (FROM: @IMP-AC-STORE-005@)
  it('verifyProfile creates new immutable snapshot with Verified status', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const draftId = draft.id

    const verified = await store.verifyProfile(draftId)

    expect(verified.status).toBe('verified')
    // New UUID must have been assigned
    expect(verified.id).not.toBe(draftId)
    // Original Draft is removed
    expect(store.profiles.find((p) => p.id === draftId)).toBeUndefined()
    // Verified snapshot is in the fleet
    expect(store.profiles.find((p) => p.id === verified.id)).toBeDefined()
  })

  // @UT-AC-STORE-027@ (FROM: @IMP-AC-STORE-005@)
  it('prior Verified version is unmodified after subsequent editVerifiedProfile', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id)
    const verifiedId = verified.id

    // Create a draft copy from the Verified
    const newDraft = await store.editVerifiedProfile(verifiedId, { registration: 'D-ECSM' })

    // Original Verified must still exist and be unchanged
    const stillVerified = store.profiles.find((p) => p.id === verifiedId)
    expect(stillVerified).toBeDefined()
    expect(stillVerified!.status).toBe('verified')
    expect(stillVerified!.registration).toBe('D-EBPN') // unchanged

    // New draft has the modified registration
    expect(newDraft.status).toBe('draft')
    expect(newDraft.registration).toBe('D-ECSM')
  })

  // @UT-AC-STORE-028@ (FROM: @IMP-AC-STORE-005@)
  it('editVerifiedProfile creates new Draft, does not mutate Verified', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id)

    const newDraft = await store.editVerifiedProfile(verified.id, { model: 'P2010' })

    expect(newDraft.status).toBe('draft')
    expect(newDraft.id).not.toBe(verified.id)
    expect(newDraft.model).toBe('P2010')

    // Verified is untouched
    const verifiedInFleet = store.profiles.find((p) => p.id === verified.id)
    expect(verifiedInFleet!.model).toBe('P2008 JC')
    expect(verifiedInFleet!.status).toBe('verified')
  })

  // @UT-AC-STORE-029@ (FROM: @IMP-AC-STORE-005@)
  it('blocks direct in-place mutation of Verified profile via updateProfile', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id)

    await expect(
      store.updateProfile(verified.id, { registration: 'D-MUTATED' }),
    ).rejects.toThrow(VerifiedMutationError)

    // Verified profile is unchanged
    const stillVerified = store.profiles.find((p) => p.id === verified.id)
    expect(stillVerified!.registration).toBe('D-EBPN')
  })

  // @UT-AC-STORE-030@ (FROM: @IMP-AC-STORE-005@)
  it('emits a duplicate warning when creating profile with existing registration', async () => {
    const store = useFleetStore()
    await store.createProfile(minimalProfileData())
    // Add a second with the same registration
    await store.createProfile({ ...minimalProfileData(), registration: 'D-EBPN' })

    expect(store.notifications.some((n) => n.code === 'WARN-AC-001')).toBe(true)
  })

  // @UT-AC-STORE-031@ (FROM: @IMP-AC-STORE-005@)
  it('emits draft warning when checkDraftWarning is called with Draft profile', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    store.checkDraftWarning(profile)
    expect(store.notifications.some((n) => n.code === 'WARN-AC-002')).toBe(true)
  })

  // @UT-AC-STORE-032@ (FROM: @IMP-AC-STORE-005@)
  it('does not emit draft warning when profile is Verified', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id)
    store.clearNotifications()
    store.checkDraftWarning(verified)
    expect(store.notifications.some((n) => n.code === 'WARN-AC-002')).toBe(false)
  })

  // @UT-AC-STORE-033@ (FROM: @IMP-AC-STORE-005@)
  it('deleteProfile removes the profile from the store', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    await store.deleteProfile(profile.id)
    expect(store.profiles).toHaveLength(0)
  })

  // @UT-AC-STORE-036@ (FROM: @IMP-AC-STORE-005@, @REQ-AC-005@)
  it('prior verified snapshot JSON is byte-identical after editVerifiedProfile', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id)
    const verifiedId = verified.id
    const verifiedJson = JSON.stringify(store.profiles.find((p) => p.id === verifiedId))

    await store.editVerifiedProfile(verifiedId, { registration: 'D-ECSM' })

    const stillVerified = store.profiles.find((p) => p.id === verifiedId)
    expect(JSON.stringify(stillVerified)).toBe(verifiedJson)
  })
})
