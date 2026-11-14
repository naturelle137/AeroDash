/**
 * MassBalanceView — CG chart envelope and calculated points share SI axes.
 *
 * Drives the real view → real store → real calculation adapter → real chart.
 * Before the fix the view passed the profile's raw (source-unit) envelope to
 * the chart while the plotted points were SI, so a `lb-in` envelope was drawn at
 * 1500–2600 on the kg axis and 35–45 on the metre axis.
 *
 * Independent synthetic vectors (1 lb = 0.45359237 kg, 1 in = 0.0254 m):
 *   envelope arms 35 / 45 in      → 0.889 / 1.143 m
 *   envelope masses 1500 / 2600 lb → 680.388555 / 1179.340162 kg
 *   TOM 2090 lb = 948.0080533 kg; ZFM 1900 lb = 861.825503 kg
 *   ZFM CG (1500·40 + 400·38) / 1900 in = 39.578947 in = 1.0053053 m
 * Moment graph (`kg-in`): envelope moments are kg·in → ×0.0254 kg·m.
 *   20000 / 50000 kg·in → 508 / 1270 kg·m
 * Synthetic test data only; not aircraft operational validation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import MassBalanceView from '../MassBalanceView.vue'
import CGEnvelopeChart from '@/modules/mass-balance/components/CGEnvelopeChart.vue'
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

const imperialProfile: AircraftContext = {
  id: 'imperial-chart-units',
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
    {
      category: 'Normal',
      maxTakeoffMass: 2400,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 35, mass: 1500 },
        { armOrMoment: 35, mass: 2600 },
        { armOrMoment: 45, mass: 2600 },
        { armOrMoment: 45, mass: 1500 },
      ],
    },
    {
      category: 'Utility',
      maxTakeoffMass: 2400,
      maxZeroFuelMass: 2000,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 37, mass: 1600 },
        { armOrMoment: 37, mass: 2400 },
        { armOrMoment: 43, mass: 2400 },
        { armOrMoment: 43, mass: 1600 },
      ],
    },
  ],
}

const momentProfile: AircraftContext = {
  ...imperialProfile,
  id: 'kg-in-moment-chart-units',
  sourceUnit: 'kg-in',
  weighingReports: [
    { basicEmptyMass: 600, emptyCg: 40, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
  ],
  loadPoints: [
    {
      name: 'Pilot',
      arm: 38,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 100,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      maxTakeoffMass: 900,
      maxZeroFuelMass: null,
      graphType: 'moment',
      envelope: [
        { armOrMoment: 20000, mass: 500 },
        { armOrMoment: 20000, mass: 900 },
        { armOrMoment: 50000, mass: 900 },
        { armOrMoment: 50000, mass: 500 },
      ],
    },
  ],
}

const siProfile: AircraftContext = {
  id: 'si-chart-units',
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

function expectEnvelope(
  wrapper: VueWrapper,
  expected: { armOrMoment: number; mass: number }[],
) {
  const envelope = wrapper.findComponent(CGEnvelopeChart).props('envelope') as {
    armOrMoment: number
    mass: number
  }[]
  expect(envelope).toHaveLength(expected.length)
  expected.forEach((p, i) => {
    expect(envelope[i]!.armOrMoment).toBeCloseTo(p.armOrMoment, 6)
    expect(envelope[i]!.mass).toBeCloseTo(p.mass, 6)
  })
}

/** SVG pixel bounds of the rendered envelope polygon. */
function polygonBox(wrapper: VueWrapper) {
  const pts = wrapper
    .find('[data-testid="cg-envelope-polygon"]')
    .attributes('points')!
    .split(' ')
    .map((pair) => pair.split(',').map(Number) as [number, number])
  const xs = pts.map(([x]) => x)
  const ys = pts.map(([, y]) => y)
  return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) }
}

/** ZFM marker centre: its label is drawn at (cx + 9, cy − 10). */
function zfmPixel(wrapper: VueWrapper) {
  const label = wrapper.find('[data-testid="cg-point-label-zfm"]')
  return { x: Number(label.attributes('x')) - 9, y: Number(label.attributes('y')) + 10 }
}

describe('MassBalanceView — chart envelope and points share SI coordinates', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('normalizes a lb-in arm envelope to kg/m, matching the calculated points', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)

    expectEnvelope(wrapper, [
      { armOrMoment: 0.889, mass: 680.388555 },
      { armOrMoment: 0.889, mass: 1179.340162 },
      { armOrMoment: 1.143, mass: 1179.340162 },
      { armOrMoment: 1.143, mass: 680.388555 },
    ])
    const zfm = store.lastResult!.zeroFuelCenterOfGravityPoint
    expect(zfm.mass).toBeCloseTo(861.825503, 6)
    expect(zfm.arm).toBeCloseTo(1.0053053, 6)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.mass).toBeCloseTo(948.0080533, 6)

    // The in-envelope point is drawn inside the drawn polygon.
    const box = polygonBox(wrapper)
    const p = zfmPixel(wrapper)
    expect(p.x).toBeGreaterThan(box.xMin)
    expect(p.x).toBeLessThan(box.xMax)
    expect(p.y).toBeGreaterThan(box.yMin)
    expect(p.y).toBeLessThan(box.yMax)

    expect(wrapper.text()).toContain('CG Arm (m)')
    expect(wrapper.text()).toContain('Mass (kg)')
  })

  it('follows a category switch with that category’s normalized envelope', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)
    store.changeCertificationCategory('Utility')
    await wrapper.vm.$nextTick()

    expectEnvelope(wrapper, [
      { armOrMoment: 0.9398, mass: 725.747792 },
      { armOrMoment: 0.9398, mass: 1088.621688 },
      { armOrMoment: 1.0922, mass: 1088.621688 },
      { armOrMoment: 1.0922, mass: 725.747792 },
    ])
    expect(wrapper.find('[data-testid="zero-fuel-limit-difference"]').text()).toBe(
      'Below MZFM by 45.3 kg',
    )
    expect(wrapper.find('.result-summary__limit').text()).toBe('/ MTOM 1088.6 kg')
  })

  it('draws an over-MTOM takeoff point above the polygon, with the critical state kept', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)
    store.changeCertificationCategory('Utility')
    store.updateStationWeight(0, 810) // TOM 1500 + 810 + 190 = 2500 lb, envelope top 2400 lb
    await wrapper.vm.$nextTick()

    expect(store.lastResult!.takeoffCenterOfGravityPoint.mass).toBeCloseTo(1133.980925, 6)
    expect(store.uiState).toBe('ERROR_CRITICAL')
    expect(wrapper.find('[data-testid="takeoff-limit-difference"]').text()).toBe(
      'Above MTOM by 45.4 kg',
    )
    // TOM label sits 10 or 24 px above its marker; either way the marker is
    // above the polygon's top edge (smaller SVG y).
    const box = polygonBox(wrapper)
    const labelY = Number(wrapper.find('[data-testid="cg-point-label-tom"]').attributes('y'))
    expect(labelY + 24).toBeLessThan(box.yMin)
  })

  it('normalizes a kg-in moment envelope to kg·m on the moment axis', async () => {
    const { store, wrapper } = await loadAndMount(momentProfile)

    expectEnvelope(wrapper, [
      { armOrMoment: 508, mass: 500 },
      { armOrMoment: 508, mass: 900 },
      { armOrMoment: 1270, mass: 900 },
      { armOrMoment: 1270, mass: 500 },
    ])
    // ZFM moment (600·40 + 100·38) kg·in = 27800 kg·in = 706.12 kg·m
    const zfm = store.lastResult!.zeroFuelCenterOfGravityPoint
    expect(zfm.moment).toBeCloseTo(706.12, 4)

    const box = polygonBox(wrapper)
    const p = zfmPixel(wrapper)
    expect(p.x).toBeGreaterThan(box.xMin)
    expect(p.x).toBeLessThan(box.xMax)
    expect(p.y).toBeGreaterThan(box.yMin)
    expect(p.y).toBeLessThan(box.yMax)
    expect(wrapper.text()).toContain('CG Moment (kg·m)')
  })

  it('keeps SI profiles unchanged and follows a switch from an imperial profile', async () => {
    const { store, wrapper } = await loadAndMount(imperialProfile)
    store.loadProfile(siProfile)
    await wrapper.vm.$nextTick()

    expectEnvelope(wrapper, siProfile.certificationCategories[0]!.envelope)
    expect(wrapper.find('.result-summary__limit').text()).toBe('/ MTOM 630.0 kg')
  })
})
