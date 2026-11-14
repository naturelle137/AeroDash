/**
 * MassBalanceView — mass-limit differences for imperial (`lb-in`) profiles.
 *
 * Regression for PR #522 review finding 1: the view passed the active
 * category's MTOM/MZFM to ResultSummary in the profile's source unit (lb) while
 * the results are SI kg, so a 2090 lb takeoff mass against a 2400 lb MTOM read
 * "Below MTOM by 1451.9 kg" instead of 140.6 kg. These tests drive the real
 * view → real store → real calculation adapter (no adapter mock, no
 * pre-normalized props), so they fail if the view hands raw limits on.
 *
 * Independent vector (see mass-balance.store.int.spec.ts): BEM 1500 lb,
 * pilot 400 lb, fuel 200 lb with 10 lb unusable → TOM 2090 lb = 948.0080533 kg,
 * ZFM 1900 lb = 861.825503 kg. 1 lb = 0.45359237 kg.
 *   MTOM 2400 lb = 1088.621688 kg → below by 140.6136347 kg → "140.6"
 *   TOM  2500 lb = 1133.980925 kg → above by 45.359237 kg  → "45.4"
 *   MZFM 2000 lb = 907.18474 kg; ZFM 1900 lb → below by 45.359237 kg → "45.3"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import MassBalanceView from '../MassBalanceView.vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import type { AircraftContext } from '@/modules/mass-balance/stores/mass-balance.types'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

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

const envelopeLb = [
  { armOrMoment: 35, mass: 1500 },
  { armOrMoment: 35, mass: 2600 },
  { armOrMoment: 45, mass: 2600 },
  { armOrMoment: 45, mass: 1500 },
]

const imperialProfile: AircraftContext = {
  id: 'imperial-limit-units',
  registration: 'N12345',
  manufacturer: 'TestCo',
  model: 'Imperial One',
  sourceUnit: 'lb-in',
  weighingReports: [
    { basicEmptyMass: 1500, emptyCg: 40, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
  ],
  loadPoints: [
    {
      name: 'Pilot',
      arm: 38,
      armLookup: [],
      operationalLimit: 800,
      defaultQuantity: 400,
      unit: 'lb',
      allowableCategories: ['Normal', 'Utility'],
      fuelTank: null,
    },
    {
      name: 'Fuel',
      arm: 48,
      armLookup: [],
      operationalLimit: 400,
      defaultQuantity: 200,
      unit: 'lb',
      allowableCategories: ['Normal', 'Utility'],
      fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
    },
  ],
  certificationCategories: [
    { category: 'Normal', maxTakeoffMass: 2400, maxZeroFuelMass: null, graphType: 'arm', envelope: envelopeLb },
    { category: 'Utility', maxTakeoffMass: 2400, maxZeroFuelMass: 2000, graphType: 'arm', envelope: envelopeLb },
  ],
}

const siProfile: AircraftContext = {
  id: 'si-limit-units',
  registration: 'D-EBPN',
  manufacturer: 'TestCo',
  model: 'Metric One',
  sourceUnit: 'kg-m',
  weighingReports: [
    { basicEmptyMass: 433, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
  ],
  loadPoints: [
    {
      name: 'Pilot',
      arm: 1.8,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 150,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      maxTakeoffMass: 630,
      maxZeroFuelMass: 600,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.7, mass: 400 },
        { armOrMoment: 1.7, mass: 700 },
        { armOrMoment: 2.0, mass: 700 },
        { armOrMoment: 2.0, mass: 400 },
      ],
    },
  ],
}

const PILOT = 0
const FUEL = 1

function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/fleet', name: 'fleet', component: { template: '<div />' } },
    ],
  })
  return mount(MassBalanceView, { global: { plugins: [router] } })
}

async function loadAndMount(profile: AircraftContext) {
  const store = useMassBalanceStore()
  store.loadProfile(profile)
  const wrapper = mountView()
  await wrapper.vm.$nextTick()
  return { store, wrapper }
}

function takeoffText(wrapper: ReturnType<typeof mountView>) {
  return wrapper.find('[data-testid="takeoff-limit-difference"]').text()
}
function zeroFuel(wrapper: ReturnType<typeof mountView>) {
  return wrapper.find('[data-testid="zero-fuel-limit-difference"]')
}

describe('MassBalanceView — mass-limit differences use kg limits for imperial profiles', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('compares the 2090 lb vector with MTOM 2400 lb in kg (not raw lb)', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)
    expect(store.lastResult?.takeoffCenterOfGravityPoint.mass).toBeCloseTo(948.0080533, 6)

    expect(takeoffText(wrapper)).toBe('Below MTOM by 140.6 kg')
    // The displayed limit is in kg as labelled (1088.62 kg), never the raw 2400.
    expect(wrapper.find('.result-summary__limit').text()).not.toContain('2400')
    // Normal has no MZFM → no zero-fuel comparison.
    expect(zeroFuel(wrapper).exists()).toBe(false)
  })

  it('shows Exactly at MTOM when TOM equals 2400 lb', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)
    store.updateStationWeight(PILOT, 710) // 1500 + 710 + 190 usable = 2400 lb
    await wrapper.vm.$nextTick()
    expect(takeoffText(wrapper)).toBe('Exactly at MTOM')
  })

  it('shows Above MTOM by 45.4 kg at TOM 2500 lb, with the critical notification intact', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)
    store.updateStationWeight(PILOT, 810)
    store.updateStationWeight(FUEL, 200) // 1500 + 810 + 190 usable = 2500 lb
    await wrapper.vm.$nextTick()
    expect(store.lastResult?.takeoffCenterOfGravityPoint.mass).toBeCloseTo(1133.980925, 6)
    expect(takeoffText(wrapper)).toBe('Above MTOM by 45.4 kg')
    expect(store.uiState).toBe('ERROR_CRITICAL')
  })

  it('compares ZFM with MZFM in kg after a category switch, and hides it again without MZFM', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)
    expect(zeroFuel(wrapper).exists()).toBe(false)

    store.changeCertificationCategory('Utility')
    await wrapper.vm.$nextTick()
    expect(zeroFuel(wrapper).text()).toBe('Below MZFM by 45.3 kg') // 1900 vs 2000 lb

    store.updateStationWeight(PILOT, 500) // ZFM 2000 lb
    await wrapper.vm.$nextTick()
    expect(zeroFuel(wrapper).text()).toBe('Exactly at MZFM')

    store.updateStationWeight(PILOT, 600) // ZFM 2100 lb
    await wrapper.vm.$nextTick()
    expect(zeroFuel(wrapper).text()).toBe('Above MZFM by 45.4 kg')

    store.changeCertificationCategory('Normal')
    await wrapper.vm.$nextTick()
    expect(zeroFuel(wrapper).exists()).toBe(false)
  })

  it('keeps SI profiles unchanged and follows a switch from an imperial profile', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)
    expect(takeoffText(wrapper)).toBe('Below MTOM by 140.6 kg')

    store.loadProfile(siProfile)
    await wrapper.vm.$nextTick()
    // 433 + 150 = 583 kg vs MTOM 630 / MZFM 600 kg.
    expect(takeoffText(wrapper)).toBe('Below MTOM by 47.0 kg')
    expect(zeroFuel(wrapper).text()).toBe('Below MZFM by 17.0 kg')
    expect(wrapper.find('.result-summary__limit').text()).toContain('630')
  })
})
