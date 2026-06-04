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

  // ── 7. Expired-verification gate at the Go/No-Go entry point (REQ-AC-007) ──
  //
  // An expired (aged-out or source-changed) Verified profile must be treated as
  // unverified at the picker: marked destructively and gated behind the same
  // inline acknowledgement, never loaded silently into the M&B store (H-011).

  /** A Verified profile whose 2020 sign-off is long past the 90-day window. */
  function buildExpiredVerified(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
    return buildFleetProfile({
      id: 'dddddddd-0000-4000-d000-000000000004',
      registration: 'D-EXPIRD',
      status: 'verified',
      verification: {
        verifiedOn: '2020-01-01',
        verifiedBy: 'JS',
        pohRevision: 'Rev 1',
        // Matches the default weighing report's validFrom so the only failure is age.
        sourceWeighingDate: '2025-01-01',
      },
      ...overrides,
    })
  }

  // @UT-MB-VIEW-027@ (FROM: @IMP-MB-VIEW-011@)
  it('marks an expired Verified profile with an [Expired] suffix in the picker', () => {
    const expired = buildExpiredVerified()
    seedFleet([expired])
    const wrapper = mountView()

    const option = wrapper
      .findAll('select#aircraft-select option')
      .find((o) => o.attributes('value') === expired.id)
    expect(option?.text()).toContain('[Expired]')
    expect(option?.text()).not.toContain('[Draft]')
  })

  // @UT-MB-VIEW-028@ (FROM: @IMP-MB-VIEW-011@)
  it('does NOT load an expired Verified profile on selection — shows the inline acknowledgement first', async () => {
    const expired = buildExpiredVerified()
    seedFleet([expired])

    const mbStore = useMassBalanceStore()
    const activeStore = useActiveAircraftStore()
    const loadSpy = vi.spyOn(mbStore, 'loadProfile')
    const setActiveSpy = vi.spyOn(activeStore, 'setActiveProfile')

    const wrapper = mountView()
    await wrapper.find('select#aircraft-select').setValue(expired.id)

    expect(loadSpy).not.toHaveBeenCalled()
    expect(setActiveSpy).not.toHaveBeenCalled()
    const ack = wrapper.find('.draft-ack')
    expect(ack.exists()).toBe(true)
    expect(ack.text()).toContain('Verification expired')
    expect(ack.text()).toContain('D-EXPIRD')
  })

  // @UT-MB-VIEW-029@ (FROM: @IMP-MB-VIEW-011@)
  it('loads the expired Verified profile only after the acknowledgement is confirmed', async () => {
    const expired = buildExpiredVerified()
    seedFleet([expired])

    const mbStore = useMassBalanceStore()
    const activeStore = useActiveAircraftStore()
    const loadSpy = vi.spyOn(mbStore, 'loadProfile')
    const setActiveSpy = vi.spyOn(activeStore, 'setActiveProfile')

    const wrapper = mountView()
    await wrapper.find('select#aircraft-select').setValue(expired.id)
    await wrapper.find('.draft-ack__btn--continue').trigger('click')

    expect(setActiveSpy).toHaveBeenCalledWith(expired)
    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.draft-ack').exists()).toBe(false)
  })

  // @UT-MB-VIEW-030@ (FROM: @IMP-MB-VIEW-011@)
  it('cancelling the acknowledgement leaves an expired Verified profile unloaded', async () => {
    const expired = buildExpiredVerified()
    seedFleet([expired])

    const mbStore = useMassBalanceStore()
    const loadSpy = vi.spyOn(mbStore, 'loadProfile')

    const wrapper = mountView()
    await wrapper.find('select#aircraft-select').setValue(expired.id)
    await wrapper.find('.draft-ack__btn--cancel').trigger('click')

    expect(loadSpy).not.toHaveBeenCalled()
    expect(wrapper.find('.draft-ack').exists()).toBe(false)
  })

  // ── 8. Fleet-load timeout escalation ──────────────────────────────────────
  //
  // A hung IndexedDB read keeps the store in LOADING forever. The view arms a
  // watchdog on the load; when it expires the spinner is replaced by an
  // actionable error offering Retry or a jump to the Fleet page.

  // @UT-MB-VIEW-031@ (FROM: @IMP-MB-VIEW-012@)
  it('escalates the fleet spinner to a Retry/Go-to-Fleet error after the load times out', async () => {
    vi.useFakeTimers()
    try {
      const fleet = useFleetStore()
      fleet.fleetLoadState = 'LOADING'
      fleet.profiles = []
      // A load that never settles — simulates a wedged IndexedDB transaction.
      vi.spyOn(fleet, 'loadAll').mockReturnValue(new Promise<void>(() => {}))

      const wrapper = mountView()
      await wrapper.vm.$nextTick()

      // Before the watchdog fires: spinner only, no escalation.
      expect(wrapper.find('.loading[aria-busy="true"]').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('taking longer than expected')

      await vi.advanceTimersByTimeAsync(10_000)
      await wrapper.vm.$nextTick()

      // After the watchdog: spinner replaced by an actionable error.
      expect(wrapper.find('.loading[aria-busy="true"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('taking longer than expected')
      const buttonLabels = wrapper.findAll('button').map((b) => b.text())
      expect(buttonLabels).toContain('Retry')
      expect(buttonLabels).toContain('Go to Fleet')
    } finally {
      vi.useRealTimers()
    }
  })

  // @UT-MB-VIEW-032@ (FROM: @IMP-MB-VIEW-012@)
  it('clears the timeout state and re-attempts the load when Retry is clicked', async () => {
    vi.useFakeTimers()
    try {
      const fleet = useFleetStore()
      fleet.fleetLoadState = 'LOADING'
      fleet.profiles = []
      const loadSpy = vi.spyOn(fleet, 'loadAll').mockReturnValue(new Promise<void>(() => {}))

      const wrapper = mountView()
      await vi.advanceTimersByTimeAsync(10_000)
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('taking longer than expected')

      loadSpy.mockClear()
      const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Retry')!
      await retryBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Retry re-runs the load and drops the timeout escalation immediately.
      expect(loadSpy).toHaveBeenCalledTimes(1)
      expect(wrapper.text()).not.toContain('taking longer than expected')
      expect(wrapper.find('.loading[aria-busy="true"]').exists()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  // @UT-MB-VIEW-033@ (FROM: @IMP-MB-VIEW-012@)
  it('routes to the Fleet page when Go to Fleet is clicked after a timeout', async () => {
    vi.useFakeTimers()
    try {
      const fleet = useFleetStore()
      fleet.fleetLoadState = 'LOADING'
      fleet.profiles = []
      vi.spyOn(fleet, 'loadAll').mockReturnValue(new Promise<void>(() => {}))

      const router = makeRouter()
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mountView(router)
      await vi.advanceTimersByTimeAsync(10_000)
      await wrapper.vm.$nextTick()

      const goBtn = wrapper.findAll('button').find((b) => b.text() === 'Go to Fleet')!
      await goBtn.trigger('click')

      expect(pushSpy).toHaveBeenCalledWith({ name: 'fleet' })
    } finally {
      vi.useRealTimers()
    }
  })

  // @UT-MB-VIEW-034@ (FROM: @IMP-MB-VIEW-013@)
  // Arriving from the wizard's "Start flight prep": the active aircraft is set
  // but the M&B store has not loaded the profile yet (gated by the draft ack).
  // The dropdown must mirror the pending profile so the pilot sees the
  // registration they just saved, not a blank "— choose aircraft —".
  it('shows the pending draft profile in the dropdown while the WARN-AC-002 ack is awaiting', async () => {
    const draft = buildFleetProfile({
      id: 'eeeeeeee-0000-4000-e000-000000000005',
      registration: 'D-NEWEST',
      status: 'draft',
    })
    seedFleet([draft])
    const activeStore = useActiveAircraftStore()
    activeStore.activeProfile = draft

    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.draft-ack').exists()).toBe(true)
    const select = wrapper.find<HTMLSelectElement>('select#aircraft-select')
    expect(select.element.value).toBe(draft.id)
  })
})

// @UT-MB-VIEW-035@ (FROM: @IMP-MB-VIEW-014@, @IMP-MB-VIEW-015@)
describe('MassBalanceView — wind limits surfacing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function mountWithActive(profile: AircraftProfile) {
    seedFleet([profile])
    useActiveAircraftStore().activeProfile = profile
    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it("surfaces the active aircraft's stored crosswind limit for manual checking", async () => {
    const profile = buildFleetProfile({
      windLimits: [{ component: 'MaxCrosswind', value: 15, classification: 'Demonstrated' }],
    })
    const wrapper = await mountWithActive(profile)

    const summary = wrapper.find('[aria-label="Aircraft wind limits"]')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('Crosswind')
    expect(summary.text()).toContain('15 kt')
    expect(summary.text()).toContain('Demonstrated')
  })

  it('shows the empty hint when the active aircraft has no stored wind limits', async () => {
    const profile = buildFleetProfile({ windLimits: undefined })
    const wrapper = await mountWithActive(profile)

    const summary = wrapper.find('[aria-label="Aircraft wind limits"]')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('No wind limits stored')
  })

  it('does not surface the wind-limits panel before an aircraft is loaded', () => {
    seedFleet([])
    const wrapper = mountView()
    expect(wrapper.find('[aria-label="Aircraft wind limits"]').exists()).toBe(false)
  })
})
