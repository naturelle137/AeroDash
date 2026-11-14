/**
 * MassBalanceView — neutral within-limit presentation and the exact-limit
 * cross-check, through the real store and calculation (no adapter mock).
 *
 * Synthetic software vectors in kg, not aircraft data: BEM 500 kg, payload
 * and fuel stations (no unusable fuel). Normal MTOM 1000 / MZFM 900 kg;
 * Utility MTOM 1100 / MZFM 950 kg.
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

const envelope = [
  { armOrMoment: 0.5, mass: 400 },
  { armOrMoment: 0.5, mass: 1200 },
  { armOrMoment: 1.5, mass: 1200 },
  { armOrMoment: 1.5, mass: 400 },
]

const profile: AircraftContext = {
  id: 'exact-limit-vectors',
  registration: 'D-EXCT',
  manufacturer: 'TestCo',
  model: 'Synthetic',
  sourceUnit: 'kg-m',
  weighingReports: [{ basicEmptyMass: 500, emptyCg: 1, weighingDate: '2025-01-01', validFrom: '2025-01-01' }],
  loadPoints: [
    {
      name: 'Payload', arm: 1, armLookup: [], operationalLimit: 1000, defaultQuantity: 300, unit: 'kg',
      allowableCategories: null, fuelTank: null,
    },
    {
      name: 'Fuel', arm: 1, armLookup: [], operationalLimit: 300, defaultQuantity: 100, unit: 'kg',
      allowableCategories: null,
      fuelTank: { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
    },
  ],
  certificationCategories: [
    { category: 'Normal', maxTakeoffMass: 1000, maxZeroFuelMass: 900, graphType: 'arm', envelope },
    { category: 'Utility', maxTakeoffMass: 1100, maxZeroFuelMass: 950, graphType: 'arm', envelope },
  ],
}

const PAYLOAD = 0
const FUEL = 1
const PROMPT = '[data-testid="exact-limit-cross-check"]'

async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/fleet', name: 'fleet', component: { template: '<div />' } },
    ],
  })
  const store = useMassBalanceStore()
  store.loadProfile(profile)
  const wrapper = mount(MassBalanceView, { global: { plugins: [router] } })
  async function load(payload: number, fuel: number) {
    store.updateStationWeight(PAYLOAD, payload)
    store.updateStationWeight(FUEL, fuel)
    await wrapper.vm.$nextTick()
  }
  return { store, wrapper, load }
}

describe('MassBalanceView — exact-limit cross-check', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('treats 979 and 981 kg alike: same neutral state, numeric differences, no prompt', async () => {
    const { store, wrapper, load } = await setup()
    for (const [fuel, text] of [[89, 'Below MTOM by 21.0 kg'], [91, 'Below MTOM by 19.0 kg']] as const) {
      await load(390, fuel) // ZFM 890; TOM 979 / 981
      expect(store.uiState).toBe('VERIFIED_SAFE')
      expect(wrapper.get('[data-testid="takeoff-limit-difference"]').text()).toBe(text)
      expect(wrapper.find('.result-summary__value--over').exists()).toBe(false)
      expect(wrapper.find(PROMPT).exists()).toBe(false)
      expect(wrapper.text()).not.toMatch(/approaching/i)
    }
  })

  it('prompts once for exact MTOM and MZFM, keeps the neutral state, and drops it on category change', async () => {
    const { store, wrapper, load } = await setup()
    await load(400, 100) // ZFM 900, TOM 1000
    expect(store.uiState).toBe('VERIFIED_SAFE')
    expect(wrapper.find('.state-banner.banner--success').text()).toContain('within entered limits')
    expect(wrapper.findAll(PROMPT)).toHaveLength(1)
    expect(wrapper.get(PROMPT).text()).toMatch(/^Exactly at MTOM and MZFM: no arithmetic mass difference remains\./)

    store.changeCertificationCategory('Utility')
    await wrapper.vm.$nextTick()
    expect(wrapper.find(PROMPT).exists()).toBe(false)
    expect(wrapper.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Below MTOM by 100.0 kg')
  })

  it('names only the affected limit and keeps critical notices above it', async () => {
    const { store, wrapper, load } = await setup()
    await load(400, 99.96) // ZFM 900, TOM 999.96
    expect(wrapper.get(PROMPT).text()).toMatch(/^Exactly at MZFM: /)

    await load(400.04, 99.96) // ZFM 900.04 above, TOM 1000 exact
    expect(store.uiState).toBe('ERROR_CRITICAL')
    expect(wrapper.get('[data-testid="zero-fuel-limit-difference"]').text()).toBe('Above MZFM by 0.1 kg')
    expect(wrapper.get(PROMPT).text()).toMatch(/^Exactly at MTOM: /)
    expect(wrapper.find('.state-banner.banner--critical').exists()).toBe(true)

    await load(400, 100.04) // TOM 1000.04 above, ZFM 900 exact
    expect(wrapper.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Above MTOM by 0.1 kg')
    expect(wrapper.findAll('.result-summary__value--over')).toHaveLength(1)
    expect(wrapper.get(PROMPT).text()).toMatch(/^Exactly at MZFM: /)
  })

  it('suppresses the old equality for invalid input and restores it for the corrected result', async () => {
    const { wrapper, load } = await setup()
    await load(400, 100)
    expect(wrapper.find(PROMPT).exists()).toBe(true)
    await load(-5, 100)
    expect(wrapper.find(PROMPT).exists()).toBe(false)
    expect(wrapper.find('.state-banner.banner--success').exists()).toBe(false)
    await load(400, 100)
    expect(wrapper.findAll(PROMPT)).toHaveLength(1)
  })
})
