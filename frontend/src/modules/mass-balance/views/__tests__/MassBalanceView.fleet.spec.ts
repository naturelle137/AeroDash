/**
 * Fleet-picker component tests for MassBalanceView.
 *
 * Covers the four fleet-integration scenarios:
 *   1. Empty fleet + READY → empty-state CTA rendered
 *   2. Fleet profiles → select rendered with one option per profile (Draft suffix for drafts)
 *   3. Selecting a profile → calls both setActiveProfile and store.loadProfile
 *   4. Restoring active aircraft on mount → dropdown preselected, loadProfile called
 *
 * @see frontend/src/modules/mass-balance/views/MassBalanceView.vue
 */

// @UT-MB-VIEW-020@ (FROM: @IMP-MB-SVC-001@, @IMP-MB-UI-004@)

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import MassBalanceView from '../MassBalanceView.vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import { useActiveAircraftStore } from '@/modules/aircraft/stores/active-aircraft.store'
import type { MathCoreResult } from '@/modules/mass-balance/stores/mass-balance.types'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/core/adapters/mass-balance.adapter', () => ({
  calculateMassBalance: vi.fn<(input: unknown) => MathCoreResult>().mockReturnValue({
    success: true,
    violations: [],
    zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    takeoffCenterOfGravityPoint: { arm: 1.91, mass: 530, moment: 1012.3 },
    landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    migrationPath: [],
  }),
}))

// Mock fleet repository — no IndexedDB in jsdom
vi.mock('@/modules/aircraft/services/fleet.repository', () => ({
  fleetRepository: {
    findAll: vi.fn<() => Promise<AircraftProfile[]>>().mockResolvedValue([]),
    create: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    update: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteById: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    findById: vi.fn<() => Promise<AircraftProfile | undefined>>().mockResolvedValue(undefined),
    openDB: vi.fn<() => Promise<IDBDatabase>>().mockResolvedValue({} as IDBDatabase),
  },
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Build a minimal valid AircraftProfile for the fleet. */
function buildFleetProfile(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
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
    status: 'verified',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 433, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot & Passenger',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 200,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: ['Normal'],
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 630,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.841, mass: 433 },
          { armOrMoment: 1.841, mass: 630 },
          { armOrMoment: 1.978, mass: 630 },
          { armOrMoment: 1.978, mass: 433 },
        ],
      },
    ],
    ...overrides,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/mass-balance', component: MassBalanceView },
      { path: '/fleet', name: 'fleet', component: { template: '<div />' } },
    ],
  })
}

function mountView(router = makeRouter()) {
  return mount(MassBalanceView, { global: { plugins: [router] } })
}

/** Directly seed the fleet store, bypassing IndexedDB. */
function seedFleet(profiles: AircraftProfile[]) {
  const fleet = useFleetStore()
  fleet.profiles = profiles
  fleet.fleetLoadState = 'READY'
  fleet.fleetLoadError = null
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MassBalanceView — fleet picker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── 1. Empty fleet CTA ────────────────────────────────────────────────────

  it('renders empty-state CTA when fleet is empty and READY', () => {
    seedFleet([])
    const wrapper = mountView()

    expect(wrapper.find('[aria-label="No aircraft in fleet"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No aircraft in your fleet yet')
    expect(wrapper.text()).toContain('Add Aircraft')
    expect(wrapper.find('select#aircraft-select').exists()).toBe(false)
  })

  it('navigates to /fleet when Add Aircraft is clicked (no fleet-new route)', async () => {
    seedFleet([])
    const router = makeRouter() // fleet-new not registered
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mountView(router)

    const addBtn = wrapper.findAll('button').find((b) => b.text().includes('Add Aircraft'))
    expect(addBtn).toBeDefined()
    await addBtn!.trigger('click')

    expect(pushSpy).toHaveBeenCalledWith('/fleet')
  })

  // ── 2. Select rendered with fleet profiles ────────────────────────────────

  it('renders <select> with one option per fleet profile', () => {
    const profile = buildFleetProfile()
    seedFleet([profile])
    const wrapper = mountView()

    const select = wrapper.find('select#aircraft-select')
    expect(select.exists()).toBe(true)

    // One placeholder + one profile option
    const options = select.findAll('option')
    expect(options).toHaveLength(2)
    expect(options[1]!.attributes('value')).toBe(profile.id)
    expect(options[1]!.text()).toContain('D-EBPN')
    expect(options[1]!.text()).toContain('Tecnam')
    expect(options[1]!.text()).toContain('P2008 JC')
  })

  it('appends [Draft] suffix to draft profile options', () => {
    const draft = buildFleetProfile({ id: 'bbbbbbbb-0000-4000-b000-000000000002', registration: 'D-DRAFT', status: 'draft' })
    const verified = buildFleetProfile({ id: 'aaaaaaaa-0000-4000-a000-000000000001', registration: 'D-VERIFIED', status: 'verified' })
    seedFleet([draft, verified])
    const wrapper = mountView()

    const options = wrapper.findAll('select#aircraft-select option').filter((o) => o.attributes('value'))
    const draftOption = options.find((o) => o.attributes('value') === draft.id)
    const verifiedOption = options.find((o) => o.attributes('value') === verified.id)

    expect(draftOption?.text()).toContain('[Draft]')
    expect(verifiedOption?.text()).not.toContain('[Draft]')
  })

  it('sorts fleet options alphabetically by registration', () => {
    const profileZ = buildFleetProfile({ id: 'cccccccc-0000-4000-c000-000000000003', registration: 'D-ZEBRA' })
    const profileA = buildFleetProfile({ id: 'aaaaaaaa-0000-4000-a000-000000000001', registration: 'D-ALPHA' })
    seedFleet([profileZ, profileA])
    const wrapper = mountView()

    const options = wrapper.findAll('select#aircraft-select option').filter((o) => o.attributes('value'))
    expect(options[0]!.text()).toContain('D-ALPHA')
    expect(options[1]!.text()).toContain('D-ZEBRA')
  })

  // ── 3. Selecting a profile ─────────────────────────────────────────────────

  it('calls setActiveProfile AND store.loadProfile when a profile is selected', async () => {
    const profile = buildFleetProfile()
    seedFleet([profile])

    const mbStore = useMassBalanceStore()
    const activeStore = useActiveAircraftStore()
    const loadSpy = vi.spyOn(mbStore, 'loadProfile')
    const setActiveSpy = vi.spyOn(activeStore, 'setActiveProfile')

    const wrapper = mountView()
    const select = wrapper.find('select#aircraft-select')
    await select.setValue(profile.id)

    expect(setActiveSpy).toHaveBeenCalledTimes(1)
    expect(setActiveSpy).toHaveBeenCalledWith(profile)
    expect(loadSpy).toHaveBeenCalledTimes(1)
    // loadProfile receives the mapped AircraftContext (basicEmptyMass, not bem)
    const loadArg = loadSpy.mock.calls[0]?.[0]
    expect(loadArg).toBeDefined()
    expect(loadArg).toHaveProperty('id', profile.id)
  })

  // ── 4. Restore active aircraft on mount ───────────────────────────────────

  it('preselects dropdown and calls loadProfile when activeAircraftStore.activeProfile is set on mount', async () => {
    const profile = buildFleetProfile()
    seedFleet([profile])

    // Pre-set active aircraft before mounting
    const activeStore = useActiveAircraftStore()
    activeStore.activeProfile = profile

    const mbStore = useMassBalanceStore()
    const loadSpy = vi.spyOn(mbStore, 'loadProfile')

    const wrapper = mountView()
    // Wait for onMounted async to complete
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(loadSpy).toHaveBeenCalledTimes(1)
    const loadArg = loadSpy.mock.calls[0]?.[0]
    expect(loadArg).toHaveProperty('id', profile.id)
  })

  // ── 5. Fleet loading / error states ──────────────────────────────────────

  it('shows fleet loading indicator while fleetLoadState is LOADING', () => {
    const fleet = useFleetStore()
    fleet.fleetLoadState = 'LOADING'
    const wrapper = mountView()

    const loading = wrapper.find('.loading[aria-busy="true"]')
    expect(loading.exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading your fleet')
  })

  it('shows fleet error message and Retry button when fleetLoadState is ERROR', () => {
    const fleet = useFleetStore()
    fleet.fleetLoadState = 'ERROR'
    fleet.fleetLoadError = 'IndexedDB unavailable'
    const wrapper = mountView()

    expect(wrapper.text()).toContain('IndexedDB unavailable')
    const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Retry')
    expect(retryBtn).toBeDefined()
  })

  it('calls fleetStore.loadAll() when Retry is clicked', async () => {
    const fleet = useFleetStore()
    fleet.fleetLoadState = 'ERROR'
    fleet.fleetLoadError = 'Read error'
    const loadAllSpy = vi.spyOn(fleet, 'loadAll').mockResolvedValue(undefined)
    const wrapper = mountView()

    const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Retry')!
    await retryBtn.trigger('click')

    expect(loadAllSpy).toHaveBeenCalledTimes(1)
  })

  // ── 6. Draft-aware grouping + inline acknowledgement (REQ-AC-005/007) ──────

  // @UT-MB-VIEW-022@ (FROM: @IMP-MB-VIEW-011@)
  it('groups picker options into Verified and Draft optgroups', () => {
    const draft = buildFleetProfile({ id: 'bbbbbbbb-0000-4000-b000-000000000002', registration: 'D-DRAFT', status: 'draft' })
    const verified = buildFleetProfile({ id: 'aaaaaaaa-0000-4000-a000-000000000001', registration: 'D-VERIF', status: 'verified' })
    seedFleet([draft, verified])
    const wrapper = mountView()

    const labels = wrapper.findAll('select#aircraft-select optgroup').map((g) => g.attributes('label'))
    expect(labels).toContain('Verified')
    expect(labels).toContain('Draft')
  })

  // @UT-MB-VIEW-023@ (FROM: @IMP-MB-VIEW-011@)
  it('surfaces the active aircraft in a Last used optgroup at the top', () => {
    const profile = buildFleetProfile()
    seedFleet([profile])
    const activeStore = useActiveAircraftStore()
    activeStore.activeProfile = profile
    const wrapper = mountView()

    const groups = wrapper.findAll('select#aircraft-select optgroup')
    expect(groups[0]!.attributes('label')).toBe('Last used')
    expect(groups[0]!.find('option').attributes('value')).toBe(profile.id)
  })

  // @UT-MB-VIEW-024@ (FROM: @IMP-MB-VIEW-011@)
  it('does NOT load a Draft on selection — shows the inline WARN-AC-002 acknowledgement first', async () => {
    const draft = buildFleetProfile({ id: 'bbbbbbbb-0000-4000-b000-000000000002', registration: 'D-DRAFT', status: 'draft' })
    seedFleet([draft])

    const mbStore = useMassBalanceStore()
    const activeStore = useActiveAircraftStore()
    const loadSpy = vi.spyOn(mbStore, 'loadProfile')
    const setActiveSpy = vi.spyOn(activeStore, 'setActiveProfile')

    const wrapper = mountView()
    await wrapper.find('select#aircraft-select').setValue(draft.id)

    // Draft is NOT loaded until acknowledged.
    expect(loadSpy).not.toHaveBeenCalled()
    expect(setActiveSpy).not.toHaveBeenCalled()
    const ack = wrapper.find('.draft-ack')
    expect(ack.exists()).toBe(true)
    expect(ack.text()).toContain('WARN-AC-002')
    expect(ack.text()).toContain('D-DRAFT')
  })

  // @UT-MB-VIEW-025@ (FROM: @IMP-MB-VIEW-011@)
  it('loads the Draft only after the acknowledgement is confirmed', async () => {
    const draft = buildFleetProfile({ id: 'bbbbbbbb-0000-4000-b000-000000000002', registration: 'D-DRAFT', status: 'draft' })
    seedFleet([draft])

    const mbStore = useMassBalanceStore()
    const activeStore = useActiveAircraftStore()
    const loadSpy = vi.spyOn(mbStore, 'loadProfile')
    const setActiveSpy = vi.spyOn(activeStore, 'setActiveProfile')

    const wrapper = mountView()
    await wrapper.find('select#aircraft-select').setValue(draft.id)
    await wrapper.find('.draft-ack__btn--continue').trigger('click')

    expect(setActiveSpy).toHaveBeenCalledWith(draft)
    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.draft-ack').exists()).toBe(false)
  })

  // @UT-MB-VIEW-026@ (FROM: @IMP-MB-VIEW-011@)
  it('cancelling the acknowledgement leaves the Draft unloaded', async () => {
    const draft = buildFleetProfile({ id: 'bbbbbbbb-0000-4000-b000-000000000002', registration: 'D-DRAFT', status: 'draft' })
    seedFleet([draft])

    const mbStore = useMassBalanceStore()
    const loadSpy = vi.spyOn(mbStore, 'loadProfile')

    const wrapper = mountView()
    await wrapper.find('select#aircraft-select').setValue(draft.id)
    await wrapper.find('.draft-ack__btn--cancel').trigger('click')

    expect(loadSpy).not.toHaveBeenCalled()
    expect(wrapper.find('.draft-ack').exists()).toBe(false)
  })
})
