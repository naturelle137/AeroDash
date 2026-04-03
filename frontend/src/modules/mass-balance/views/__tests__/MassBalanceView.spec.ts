import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import MassBalanceView from '../MassBalanceView.vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import type {
  AircraftContext,
  MathCoreResult,
  Violation,
} from '@/modules/mass-balance/stores/mass-balance.types'

vi.mock('@/core/adapters/mass-balance.adapter', () => ({
  calculateMassBalance: vi.fn<(input: unknown) => MathCoreResult>(),
}))

import { calculateMassBalance } from '@/core/adapters/mass-balance.adapter'

const mockedCalculate = vi.mocked(calculateMassBalance)

function buildSuccessResult(overrides: Partial<MathCoreResult> = {}): MathCoreResult {
  return {
    success: true,
    violations: [],
    zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    takeoffCenterOfGravityPoint: { arm: 1.91, mass: 530, moment: 1012.3 },
    landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    migrationPath: [
      { arm: 1.91, mass: 530, label: 'Takeoff' },
      { arm: 1.9, mass: 500, label: 'Landing' },
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
  return mount(MassBalanceView)
}

describe('MassBalanceView integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedCalculate.mockReturnValue(buildSuccessResult())
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

  it('calls resetPayload from Reset Payload action and keeps results visible', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    const resetSpy = vi.spyOn(store, 'resetPayload')
    const wrapper = mountView()

    await wrapper.find('input#station-0').setValue('80')
    expect(store.uiState).toBe('VERIFIED_SAFE')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Reset Payload')!
      .trigger('click')

    expect(resetSpy).toHaveBeenCalledTimes(1)
    expect(store.uiState).toBe('VERIFIED_SAFE')
    expect(store.lastResult).not.toBeNull()
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
