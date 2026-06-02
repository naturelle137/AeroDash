// @UT-MB-VIEW-021@ (FROM: @IMP-MB-UI-FLEET-002@, @IMP-MB-UI-008@)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import MassBalanceView from '../MassBalanceView.vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import type {
  AircraftContext,
  MathCoreResult,
  Violation,
} from '@/modules/mass-balance/stores/mass-balance.types'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

vi.mock('@/core/adapters/mass-balance.adapter', () => ({
  calculateMassBalance: vi.fn<(input: unknown) => MathCoreResult>(),
}))

// Mock fleet repository so mountView() doesn't touch IndexedDB.
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

import { calculateMassBalance } from '@/core/adapters/mass-balance.adapter'

const mockedCalculate = vi.mocked(calculateMassBalance)

/** Build a fleet-store `AircraftProfile` that maps to the given `AircraftContext`. */
function toFleetProfile(ctx: AircraftContext): AircraftProfile {
  return {
    id: ctx.id,
    ownerId: 'test-owner',
    registration: ctx.registration,
    manufacturer: ctx.manufacturer,
    model: ctx.model,
    icaoTypeDesignator: 'ZZZZ',
    sourceUnit: ctx.sourceUnit,
    referenceDatumDescription: 'Test',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: ctx.status ?? 'verified',
    schemaVersion: 1,
    powertrain: ctx.powertrain ?? 'combustion',
    passengerProfiles: [],
    weighingReports: ctx.weighingReports.map((wr) => ({
      bem: wr.basicEmptyMass,
      emptyCg: wr.emptyCg,
      weighingDate: wr.weighingDate,
      validFrom: wr.validFrom,
    })),
    loadPoints: ctx.loadPoints as AircraftProfile['loadPoints'],
    certificationCategories: ctx.certificationCategories.map((cc) => ({
      category: cc.category,
      mtom: cc.maxTakeoffMass,
      maxZeroFuelMass: cc.maxZeroFuelMass,
      graphType: cc.graphType,
      envelope: cc.envelope,
    })),
  }
}

/** Seed the fleet store synchronously in the READY state (bypass IndexedDB). */
function seedFleet(profiles: AircraftProfile[]): void {
  const fleet = useFleetStore()
  fleet.profiles = profiles
  fleet.fleetLoadState = 'READY'
  fleet.fleetLoadError = null
}

/** Make a tiny router so `useRouter()` inside the view resolves without errors. */
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

function buildSuccessResult(overrides: Partial<MathCoreResult> = {}): MathCoreResult {
  return {
    success: true,
    violations: [],
    zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    takeoffCenterOfGravityPoint: { arm: 1.91, mass: 530, moment: 1012.3 },
    landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    migrationPath: [
      { arm: 1.91, mass: 530, moment: 1012.3, label: 'Takeoff' },
      { arm: 1.9, mass: 500, moment: 950, label: 'Landing' },
    ],
    ...overrides,
  }
}

function buildViolationResult(violations: Violation[]): MathCoreResult {
  return buildSuccessResult({ violations })
}

const mockProfile: AircraftContext = {
  id: 'tecnam-p2008',
  registration: 'D-ELUX',
  manufacturer: 'Tecnam',
  model: 'P2008 JC',
  sourceUnit: 'kg',
  weighingReports: [
    {
      basicEmptyMass: 433,
      emptyCg: 1.877,
      weighingDate: '2025-01-01',
      validFrom: '2025-01-01',
    },
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
    {
      name: 'Fuel',
      arm: 2.209,
      armLookup: [],
      operationalLimit: 75,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: {
        unusableFuel: 3,
        permissibleFuelTypes: ['MOGAS', 'AVGAS'],
        burnSequences: [],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      maxTakeoffMass: 630,
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
}

const multiCategoryProfile: AircraftContext = {
  ...mockProfile,
  certificationCategories: [
    ...mockProfile.certificationCategories,
    {
      category: 'Utility',
      maxTakeoffMass: 580,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.85, mass: 433 },
        { armOrMoment: 1.85, mass: 580 },
        { armOrMoment: 1.95, mass: 580 },
        { armOrMoment: 1.95, mass: 433 },
      ],
    },
  ],
}

function mountView() {
  return mount(MassBalanceView, { global: { plugins: [makeRouter()] } })
}

describe('MassBalanceView integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedCalculate.mockReturnValue(buildSuccessResult())
    // Default: seed the fleet so the aircraft <select> renders. Individual
    // tests that need empty/loading/error states override this.
    // Only seed mockProfile (multiCategoryProfile shares the same id).
    seedFleet([toFleetProfile(mockProfile)])
  })

  it('renders INITIAL state with disabled controls and no chart/results', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Select aircraft')
    expect(wrapper.find('svg.cg-chart').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Calculation results"]').exists()).toBe(false)
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })

  it('renders LOADING state with busy indicator and no inputs', () => {
    const store = useMassBalanceStore()
    store.uiState = 'LOADING'

    const wrapper = mountView()
    const loading = wrapper.find('.loading[aria-busy="true"]')

    expect(loading.exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading aircraft profile')
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })

  it('renders UNCONFIGURED state with required-fields hint', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.stations[0]!.touched = false
    store.evaluateState()
    const wrapper = mountView()

    expect(store.uiState).toBe('UNCONFIGURED')
    expect(wrapper.text()).toContain('Complete required fields')
    expect(wrapper.find('input#station-0').attributes('disabled')).toBeUndefined()
  })

  it('handles user weight input, calls updateStationWeight, and transitions to VERIFIED_SAFE', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const updateSpy = vi.spyOn(store, 'updateStationWeight')
    const wrapper = mountView()

    const pilotInput = wrapper.find('input#station-0')
    await pilotInput.setValue('80')

    expect(updateSpy).toHaveBeenCalledWith(0, 80)
    expect(store.uiState).toBe('VERIFIED_SAFE')
    expect(wrapper.find('.state-banner.banner--success').exists()).toBe(true)
  })

  it('renders WARNING state with alert banner', async () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'STATION_LIMIT_EXCEEDED', stationIndex: 0 }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('80')

    expect(store.uiState).toBe('WARNING')
    expect(wrapper.find('.state-banner.banner--warning[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Station 0 limit exceeded')
  })

  it('renders ERROR_CRITICAL state with critical visuals', async () => {
    mockedCalculate.mockReturnValue(buildViolationResult([{ type: 'MTOM_EXCEEDED' }]))
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('250')

    expect(store.uiState).toBe('ERROR_CRITICAL')
    expect(wrapper.find('.state-banner.banner--critical[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('MTOM Exceeded')
  })

  it('recovers from ERROR_CRITICAL to VERIFIED_SAFE and removes critical visuals', async () => {
    mockedCalculate
      .mockReturnValueOnce(buildSuccessResult())
      .mockReturnValueOnce(buildViolationResult([{ type: 'MTOM_EXCEEDED' }]))
      .mockReturnValue(buildSuccessResult())

    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('250')
    expect(store.uiState).toBe('ERROR_CRITICAL')

    await wrapper.find('input#station-0').setValue('80')
    expect(store.uiState).toBe('VERIFIED_SAFE')
    expect(wrapper.find('.banner--critical').exists()).toBe(false)
    expect(wrapper.find('svg[aria-label*="CRITICAL"]').exists()).toBe(false)
  })

  it('renders VERIFIED_SAFE success UI', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('80')

    expect(store.uiState).toBe('VERIFIED_SAFE')
    expect(wrapper.find('.state-banner.banner--success').exists()).toBe(true)
    expect(wrapper.text()).toContain('Mass & Balance verified')
  })

  it('calls resetPayload after confirming the Reset Payload action and keeps results visible', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const resetSpy = vi.spyOn(store, 'resetPayload')
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('80')
    expect(store.uiState).toBe('VERIFIED_SAFE')

    // UX-004: the tap now opens a confirm dialog; reset only fires on confirm.
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Reset Payload')!
      .trigger('click')
    expect(resetSpy).not.toHaveBeenCalled()
    ;(document.querySelector('.confirm-dialog__btn--danger') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(resetSpy).toHaveBeenCalledTimes(1)
    // REQ-UQ-006: the post-reset pilot mass is 0 kg, so the plausibility advisory
    // re-fires and the state machine resolves to WARNING (not VERIFIED_SAFE).
    expect(store.uiState).toBe('WARNING')
    expect(store.notifications.some((n) => n.id === 'WARN-UQ-001')).toBe(true)
    expect(store.lastResult).not.toBeNull()

    document.body.innerHTML = ''
  })

  it('does not render a Verify All button (verification not applicable to M&B inputs)', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const wrapper = mountView()

    const verifyAllBtn = wrapper.findAll('button').find((b) => b.text() === 'Verify All')
    expect(verifyAllBtn).toBeUndefined()
  })

  it('ignores empty and unknown aircraft selection values in INITIAL state', async () => {
    const store = useMassBalanceStore()
    const loadSpy = vi.spyOn(store, 'loadProfile')
    const wrapper = mountView()
    const selector = wrapper.find('select#aircraft-select')

    await selector.setValue('')
    await selector.setValue('does-not-exist')

    expect(loadSpy).not.toHaveBeenCalled()
    expect(store.uiState).toBe('INITIAL')
  })

  it('loads aircraft when a valid aircraft id is selected from INITIAL state', async () => {
    const store = useMassBalanceStore()
    const loadSpy = vi.spyOn(store, 'loadProfile')
    const wrapper = mountView()
    const selector = wrapper.find('select#aircraft-select')

    await selector.setValue('tecnam-p2008')

    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(store.aircraft?.id).toBe('tecnam-p2008')
    expect(store.uiState).not.toBe('INITIAL')
    expect(wrapper.text()).not.toContain('Select aircraft')
  })

  it('shows category selector for multi-category aircraft and delegates category changes', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCategoryProfile)
    const categorySpy = vi.spyOn(store, 'changeCertificationCategory')
    const wrapper = mountView()

    const categorySelect = wrapper.find('select[aria-label="Certification category"]')
    expect(categorySelect.exists()).toBe(true)

    await categorySelect.setValue('Utility')

    expect(categorySpy).toHaveBeenCalledWith('Utility')
    expect(store.activeCategory).toBe('Utility')
  })
})

// ─── UX-004: confirm-then-undo Reset Payload ───────────────────────────────

describe('MassBalanceView — Reset Payload confirm + undo (UX-004)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedCalculate.mockReturnValue(buildSuccessResult())
    seedFleet([toFleetProfile(mockProfile)])
  })

  afterEach(() => {
    // ConfirmDialog + UndoToast teleport to <body>.
    document.body.innerHTML = ''
  })

  function findResetButton(wrapper: ReturnType<typeof mountView>) {
    return wrapper.findAll('button').find((b) => b.text() === 'Reset Payload')!
  }

  it('does not reset on tap — opens an in-app confirmation with a discard count', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const resetSpy = vi.spyOn(store, 'resetPayload')
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('80')
    await findResetButton(wrapper).trigger('click')

    expect(resetSpy).not.toHaveBeenCalled()
    const dialog = document.querySelector('.confirm-dialog')
    expect(dialog).not.toBeNull()
    // One station carries an entered weight → "discard 1 ... weight".
    expect(dialog?.textContent).toContain('Discard 1')
  })

  it('cancelling the confirmation leaves weights untouched', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const resetSpy = vi.spyOn(store, 'resetPayload')
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('80')
    await findResetButton(wrapper).trigger('click')
    ;(document.querySelector('.confirm-dialog__btn--cancel') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(resetSpy).not.toHaveBeenCalled()
    expect(store.stations[0]!.weight).toBe(80)
    expect(document.querySelector('.confirm-dialog')).toBeNull()
  })

  it('confirming resets the payload and surfaces an undo toast', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('80')
    await findResetButton(wrapper).trigger('click')
    ;(document.querySelector('.confirm-dialog__btn--danger') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(store.stations[0]!.weight).toBe(0)
    expect(document.querySelector('.undo-toast')).not.toBeNull()
  })

  it('undo restores the pre-reset station weights', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('80')
    await findResetButton(wrapper).trigger('click')
    ;(document.querySelector('.confirm-dialog__btn--danger') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    expect(store.stations[0]!.weight).toBe(0)
    ;(document.querySelector('.undo-toast__action') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(store.stations[0]!.weight).toBe(80)
  })
})
