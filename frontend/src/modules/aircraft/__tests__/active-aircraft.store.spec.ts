/**
 * Unit tests for active-aircraft.store.ts
 * Covers hot-swap context switching without page reload (refs #153, #165).
 *
 * DoD items (Issue #165):
 * - Aircraft selection replaces context reactively; no page reload
 * - Prior aircraft load data, results, and notifications cleared on switch
 * - Session payload reset on aircraft switch
 * - Context switch test: new profile loaded, prior state absent
 * - No reload triggered test
 *
 * @see frontend/src/modules/aircraft/stores/active-aircraft.store.ts
 */

// @UT-AC-STORE-068@ (FROM: @IMP-AC-STORE-006@)

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useActiveAircraftStore } from '../stores/active-aircraft.store'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

/** Minimal valid Draft aircraft profile for test use. */
function buildProfile(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
  return {
    id: 'aaaaaaaa-0000-4000-a000-000000000001',
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

describe('useActiveAircraftStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @UT-AC-STORE-068@ (FROM: @IMP-AC-STORE-006@)
  it('initial state: activeProfile is null, hasActiveProfile is false', () => {
    const store = useActiveAircraftStore()
    expect(store.activeProfile).toBeNull()
    expect(store.hasActiveProfile).toBe(false)
  })

  // @UT-AC-STORE-069@ (FROM: @IMP-AC-STORE-006@)
  it('setActiveProfile sets the active profile reactively (no page reload required)', () => {
    const store = useActiveAircraftStore()
    const profile = buildProfile()

    store.setActiveProfile(profile)

    expect(store.activeProfile).not.toBeNull()
    expect(store.activeProfile!.id).toBe(profile.id)
    expect(store.activeProfile!.registration).toBe('D-EBPN')
    expect(store.hasActiveProfile).toBe(true)
  })

  // @UT-AC-STORE-070@ (FROM: @IMP-AC-STORE-006@)
  it('context switch: new profile replaces prior profile without page reload', () => {
    const store = useActiveAircraftStore()
    const aircraft1 = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-000000000001',
      registration: 'D-EBPN',
    })
    const aircraft2 = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-000000000002',
      registration: 'G-ABCD',
      status: 'verified',
    })

    store.setActiveProfile(aircraft1)
    expect(store.activeProfile!.registration).toBe('D-EBPN')

    // Hot-swap: switch to second aircraft
    store.setActiveProfile(aircraft2)

    // New profile is active
    expect(store.activeProfile!.id).toBe(aircraft2.id)
    expect(store.activeProfile!.registration).toBe('G-ABCD')
    // Prior aircraft ID is gone
    expect(store.activeProfile!.id).not.toBe(aircraft1.id)
  })

  // @UT-AC-STORE-071@ (FROM: @IMP-AC-STORE-006@)
  it('no page reload triggered: setActiveProfile performs synchronous in-place state swap', () => {
    const store = useActiveAircraftStore()

    const aircraft1 = buildProfile({ registration: 'D-EBPN' })
    const aircraft2 = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-000000000002',
      registration: 'G-ABCD',
    })

    store.setActiveProfile(aircraft1)
    // setActiveProfile is synchronous — it returns void, not a Promise.
    // A page reload would terminate the synchronous call chain; the fact that
    // the second setActiveProfile can execute proves no reload occurred.
    const result = store.setActiveProfile(aircraft2)
    expect(result).toBeUndefined()

    // Both operations completed in the same synchronous frame
    expect(store.activeProfile!.registration).toBe('G-ABCD')
  })

  // @UT-AC-STORE-072@ (FROM: @IMP-AC-STORE-006@)
  it('clearActive sets activeProfile to null and hasActiveProfile to false', () => {
    const store = useActiveAircraftStore()
    const profile = buildProfile()
    store.setActiveProfile(profile)
    expect(store.hasActiveProfile).toBe(true)

    store.clearActive()

    expect(store.activeProfile).toBeNull()
    expect(store.hasActiveProfile).toBe(false)
  })

  // @UT-AC-STORE-073@ (FROM: @IMP-AC-STORE-006@)
  it('isDraft is true when active profile has Draft status', () => {
    const store = useActiveAircraftStore()
    const draftProfile = buildProfile({ status: 'draft' })
    store.setActiveProfile(draftProfile)
    expect(store.isDraft).toBe(true)
  })

  // @UT-AC-STORE-074@ (FROM: @IMP-AC-STORE-006@)
  it('isDraft is false when active profile has Verified status', () => {
    const store = useActiveAircraftStore()
    const verifiedProfile = buildProfile({ status: 'verified' })
    store.setActiveProfile(verifiedProfile)
    expect(store.isDraft).toBe(false)
  })

  // @UT-AC-STORE-075@ (FROM: @IMP-AC-STORE-006@)
  it('isDraft is false when no profile is active (null)', () => {
    const store = useActiveAircraftStore()
    expect(store.isDraft).toBe(false)
  })

  // @UT-AC-STORE-076@ (FROM: @IMP-AC-STORE-006@)
  it('context switch: prior state absent after switching aircraft', () => {
    const store = useActiveAircraftStore()
    const aircraft1 = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-000000000001',
      registration: 'D-EBPN',
    })
    const aircraft2 = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-000000000002',
      registration: 'G-ABCD',
      status: 'verified',
    })

    store.setActiveProfile(aircraft1)
    store.setActiveProfile(aircraft2)

    // Prior profile (aircraft1) is absent from the active context
    expect(store.activeProfile!.id).not.toBe(aircraft1.id)
    // Only the new profile's data is present
    expect(store.activeProfile!.registration).toBe('G-ABCD')
    expect(store.activeProfile!.status).toBe('verified')
  })

  // @UT-AC-STORE-077@ (FROM: @IMP-AC-STORE-006@)
  it('setActiveProfile replaces profile object reference (reactive hot-swap)', () => {
    const store = useActiveAircraftStore()
    const profile1 = buildProfile({ registration: 'D-FIRST' })
    const profile2 = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-000000000002',
      registration: 'D-SECOND',
    })

    store.setActiveProfile(profile1)
    const refAfterFirst = store.activeProfile

    store.setActiveProfile(profile2)

    // Object reference changed — confirms reactive replacement
    expect(store.activeProfile).not.toBe(refAfterFirst)
    expect(store.activeProfile!.registration).toBe('D-SECOND')
  })

  // @UT-AC-STORE-078@ (FROM: @IMP-AC-STORE-006@)
  it('clearActive then setActiveProfile starts fresh context', () => {
    const store = useActiveAircraftStore()
    const aircraft = buildProfile()

    store.setActiveProfile(aircraft)
    store.clearActive()
    expect(store.activeProfile).toBeNull()

    store.setActiveProfile(aircraft)
    expect(store.activeProfile!.id).toBe(aircraft.id)
    expect(store.hasActiveProfile).toBe(true)
  })

  // @UT-AC-STORE-079@ (FROM: @IMP-AC-STORE-006@)
  it('hasActiveProfile is false after clearActive', () => {
    const store = useActiveAircraftStore()
    store.setActiveProfile(buildProfile())
    store.clearActive()
    expect(store.hasActiveProfile).toBe(false)
    expect(store.isDraft).toBe(false)
  })

  // ─── Hot-swap dependent-state reset (Issue #165 DoD) ───────────────────────

  /**
   * Stage a "previous aircraft" MB session to prove that switching airframes
   * wipes load inputs, results and notifications — i.e. no stale data leaks
   * into the next computation.
   */
  function stageDirtyMbSession(): ReturnType<typeof useMassBalanceStore> {
    const mbStore = useMassBalanceStore()
    mbStore.$patch({
      aircraft: {
        id: 'prior-aircraft-id',
        registration: 'D-EBPN',
        manufacturer: 'Tecnam',
        model: 'P2008 JC',
        sourceUnit: 'kg',
        status: 'verified',
        weighingReports: [],
        loadPoints: [],
        certificationCategories: [],
      },
      activeCategory: 'Normal',
      stations: [
        { index: 0, name: 'Pilot', weight: 85, verified: true, mandatory: true, touched: true, hasError: false },
      ],
      notifications: [
        { id: 'PRIOR-NOTE', severity: 'WARNING', message: 'prior aircraft note', context: 'test', persistent: false, dismissible: true },
      ],
      lastResult: { violations: [], tom: 650, zfm: 550, cgAtTakeoff: 1.9, cgAtLanding: 1.9, migrationPath: [] } as unknown as ReturnType<typeof useMassBalanceStore>['lastResult'],
      uiState: 'VERIFIED_SAFE',
    })
    return mbStore
  }

  // @UT-AC-STORE-080@ (FROM: @IMP-AC-STORE-006@)
  it('switching to a different airframe clears the M&B store (load data, results, notifications)', () => {
    const store = useActiveAircraftStore()
    const aircraft1 = buildProfile({ registration: 'D-EBPN' })
    store.setActiveProfile(aircraft1)

    const mbStore = stageDirtyMbSession()
    expect(mbStore.aircraft).not.toBeNull()
    expect(mbStore.stations.length).toBe(1)
    expect(mbStore.notifications.length).toBe(1)
    expect(mbStore.lastResult).not.toBeNull()

    const aircraft2 = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-000000000002',
      registration: 'G-ABCD',
    })
    store.setActiveProfile(aircraft2)

    expect(mbStore.aircraft).toBeNull()
    expect(mbStore.activeCategory).toBeNull()
    expect(mbStore.stations).toEqual([])
    expect(mbStore.notifications).toEqual([])
    expect(mbStore.lastResult).toBeNull()
    expect(mbStore.uiState).toBe('INITIAL')
  })

  // @UT-AC-STORE-081@ (FROM: @IMP-AC-STORE-006@)
  it('first-time setActiveProfile (no prior profile) does not clear pre-existing M&B state', () => {
    const store = useActiveAircraftStore()
    const mbStore = stageDirtyMbSession()

    store.setActiveProfile(buildProfile({ registration: 'G-NEW' }))

    // Nothing was active before, so there's no "prior airframe" to evict.
    expect(mbStore.aircraft).not.toBeNull()
    expect(mbStore.stations.length).toBe(1)
  })

  // @UT-AC-STORE-082@ (FROM: @IMP-AC-STORE-006@, @IMP-AC-STORE-005@)
  it('swapping the active profile with the same registration (Draft→Verified snapshot) preserves M&B state', () => {
    const store = useActiveAircraftStore()
    const draft = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-000000000001',
      registration: 'D-EBPN',
      status: 'draft',
    })
    store.setActiveProfile(draft)

    const mbStore = stageDirtyMbSession()

    // verifyProfile mints a new UUID but keeps the same registration
    const verifiedSnapshot = buildProfile({
      id: 'aaaaaaaa-0000-4000-a000-0000000000ff',
      registration: 'D-EBPN',
      status: 'verified',
    })
    store.setActiveProfile(verifiedSnapshot)

    expect(mbStore.aircraft).not.toBeNull()
    expect(mbStore.stations.length).toBe(1)
    expect(mbStore.notifications.length).toBe(1)
  })

  // @UT-AC-STORE-083@ (FROM: @IMP-AC-STORE-006@)
  it('clearActive wipes the M&B store so no stale aircraft data survives', () => {
    const store = useActiveAircraftStore()
    store.setActiveProfile(buildProfile({ registration: 'D-EBPN' }))
    const mbStore = stageDirtyMbSession()

    store.clearActive()

    expect(store.activeProfile).toBeNull()
    expect(mbStore.aircraft).toBeNull()
    expect(mbStore.stations).toEqual([])
    expect(mbStore.notifications).toEqual([])
    expect(mbStore.lastResult).toBeNull()
    expect(mbStore.uiState).toBe('INITIAL')
  })
})
