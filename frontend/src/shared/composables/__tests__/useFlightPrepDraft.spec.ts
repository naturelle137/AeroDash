import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import { syntheticFuelContext } from '@/modules/fuel-endurance/services/synthetic-fuel.fixture'
import { useFuelPlanning } from '@/modules/fuel-endurance/services/use-fuel-planning'
import { usePerformanceStep } from '@/modules/performance/composables/performance-step'
import { massSourceFromText } from '@/modules/performance/services/poh-inspection'
import { useFlightPrepDraftStore } from '@/stores/flightprep-draft.store'
import { useFlightPrepDraft } from '../useFlightPrepDraft'

const KEY = 'aerodash:flightprep:draft'

function harness() {
  let api!: { fuel: ReturnType<typeof useFuelPlanning>; step: ReturnType<typeof usePerformanceStep>; draft: ReturnType<typeof useFlightPrepDraft> }
  const wrapper = mount(defineComponent({
    setup() {
      const fuel = useFuelPlanning()
      const source = massSourceFromText('', 'test')
      const step = usePerformanceStep(() => ({ ready: true, notReadyReason: '', profile: null, category: null, takeoff: source, landing: source }))
      api = { fuel, step, draft: useFlightPrepDraft(fuel, step) }
      return () => null
    },
  }))
  return { wrapper, api }
}

function load(id: string) {
  const store = useMassBalanceStore()
  store.loadProfile({ ...AircraftContextSchema.parse(syntheticFuelContext()), id })
  return store
}

describe('flight preparation draft', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function enterAndSave() {
    load('plane-a')
    const { api, wrapper } = harness()
    await nextTick()
    api.fuel.method.value = 'duration'
    api.fuel.consumption.value = '10'
    api.fuel.trip.value = '120'
    api.fuel.reserve.value = '30'
    api.step.temperature.value = '15'
    api.step.pa.method.value = 'direct'
    api.step.pa.direct.value = '1500'
    api.step.corrections.takeoff.headwind = '5'
    api.step.safetyFactors.landing.preset = 'custom'
    api.step.safetyFactors.landing.custom = '1.5'
    api.step.obstacle.height = '50'
    api.step.manualConfiguration.value = 'basic'
    await nextTick()
    vi.advanceTimersByTime(400)
    wrapper.unmount()
  }

  it('saves per aircraft and restores after a reload without acknowledgements', async () => {
    await enterAndSave()
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(Object.keys(stored.drafts)).toEqual(['plane-a'])
    expect(JSON.stringify(stored)).not.toContain('basic')

    setActivePinia(createPinia())
    load('plane-a')
    const { api } = harness()
    await nextTick()
    expect(api.fuel.method.value).toBe('duration')
    expect(api.fuel.consumption.value).toBe('10')
    expect(api.step.temperature.value).toBe('15')
    expect(api.step.pa.direct.value).toBe('1500')
    expect(api.step.corrections.takeoff.headwind).toBe('5')
    expect(api.step.safetyFactors.landing.custom).toBe('1.5')
    expect(api.step.obstacle.height).toBe('50')
    expect(api.step.manualConfiguration.value).toBe('')
    expect(api.step.extrapolationAcknowledged.value).toBe(false)
    expect(useFlightPrepDraftStore().restored?.aircraftId).toBe('plane-a')
  })

  it('retains earlier aircraft drafts when more than 50 are saved', async () => {
    await enterAndSave()
    const store = useFlightPrepDraftStore()
    const draft = store.load('plane-a')!
    for (let i = 0; i < 50; i++) store.save({ ...draft, aircraftId: `plane-${i}` })
    expect(store.load('plane-a')).toEqual(draft)
  })

  it('does not restore another aircraft\'s draft', async () => {
    await enterAndSave()
    setActivePinia(createPinia())
    load('plane-b')
    const { api } = harness()
    await nextTick()
    expect(api.fuel.method.value).toBe('')
    expect(useFlightPrepDraftStore().restored).toBeNull()
  })

  it('drops an invalid or tampered entry instead of applying it', async () => {
    await enterAndSave()
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    stored.drafts['plane-a'].performance.pressureAltitude.elevationUnit = 'furlong'
    localStorage.setItem(KEY, JSON.stringify(stored))
    setActivePinia(createPinia())
    load('plane-a')
    const { api } = harness()
    await nextTick()
    expect(api.step.temperature.value).toBe('')
    expect(useFlightPrepDraftStore().restored).toBeNull()
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{"drafts":{}}').drafts['plane-a']).toBeUndefined()
  })

  it('treats corrupt storage as no draft', async () => {
    localStorage.setItem(KEY, '{not json')
    load('plane-a')
    const { api } = harness()
    await nextTick()
    expect(api.fuel.method.value).toBe('')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('keeps out-of-range restored text blocked by the normal validation', async () => {
    await enterAndSave()
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    stored.drafts['plane-a'].performance.temperature = '9999'
    localStorage.setItem(KEY, JSON.stringify(stored))
    setActivePinia(createPinia())
    load('plane-a')
    const { api } = harness()
    await nextTick()
    expect(api.step.temperature.value).toBe('9999')
    expect(api.step.temperatureWarnings.value.length).toBeGreaterThan(0)
  })

  it('clears the stored draft and the inputs', async () => {
    await enterAndSave()
    setActivePinia(createPinia())
    load('plane-a')
    const { api } = harness()
    await nextTick()
    api.draft.clearDraft()
    await nextTick()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(api.fuel.method.value).toBe('')
    expect(api.step.temperature.value).toBe('')
    expect(api.step.safetyFactors.landing.preset).toBe('poh-afm')
    expect(useFlightPrepDraftStore().restored).toBeNull()
    vi.advanceTimersByTime(400)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('never writes while a demo copy is active', async () => {
    const store = load('plane-a')
    const { api } = harness()
    await nextTick()
    store.enterDemo()
    api.step.temperature.value = '20'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('does not copy the previous aircraft\'s entries into an aircraft without a draft', async () => {
    const store = load('plane-a')
    const { api } = harness()
    await nextTick()
    api.fuel.method.value = 'duration'
    api.fuel.consumption.value = '10'
    api.step.temperature.value = '15'
    api.step.safetyFactors.landing.preset = 'custom'
    api.step.obstacle.height = '50'
    await nextTick()
    vi.advanceTimersByTime(400)

    store.loadProfile({ ...AircraftContextSchema.parse(syntheticFuelContext()), id: 'plane-b' })
    await nextTick()
    expect(api.fuel.method.value).toBe('')
    expect(api.fuel.consumption.value).toBe('')
    expect(api.step.temperature.value).toBe('')
    expect(api.step.safetyFactors.landing.preset).toBe('poh-afm')
    expect(api.step.obstacle.height).toBe('')
    vi.advanceTimersByTime(400)
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(Object.keys(stored.drafts)).toEqual(['plane-a'])
  })

  it('keeps the saved draft when a demo starts, including edits still waiting to be saved', async () => {
    const store = load('plane-a')
    const { api } = harness()
    await nextTick()
    api.step.temperature.value = '15'
    await nextTick()
    // Demo starts inside the debounce window.
    store.enterDemo()
    api.step.temperature.value = '40'
    api.fuel.consumption.value = '99'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(JSON.parse(localStorage.getItem(KEY)!).drafts['plane-a'].performance.temperature).toBe('15')

    store.exitDemo()
    await nextTick()
    vi.advanceTimersByTime(400)
    const draft = JSON.parse(localStorage.getItem(KEY)!).drafts['plane-a']
    expect(api.step.temperature.value).toBe('15')
    expect(draft.performance.temperature).toBe('15')
    expect(draft.fuel.consumption).toBe('')
  })

  it('saves entries typed just before switching aircraft for the aircraft they belong to', async () => {
    const store = load('plane-a')
    const { api } = harness()
    await nextTick()
    api.step.temperature.value = '15'
    await nextTick()
    store.loadProfile({ ...AircraftContextSchema.parse(syntheticFuelContext()), id: 'plane-b' })
    await nextTick()
    expect(api.step.temperature.value).toBe('')

    store.loadProfile({ ...AircraftContextSchema.parse(syntheticFuelContext()), id: 'plane-a' })
    await nextTick()
    expect(api.step.temperature.value).toBe('15')
    expect(Object.keys(JSON.parse(localStorage.getItem(KEY)!).drafts)).toEqual(['plane-a'])
  })
})
