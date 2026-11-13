import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import { syntheticFuelContext } from '../services/synthetic-fuel.fixture'
import FuelEnduranceCard from './FuelEnduranceCard.vue'

describe('fuel plan with live M&B store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  async function setup() {
    const store = useMassBalanceStore()
    store.loadProfile(AircraftContextSchema.parse(syntheticFuelContext()))
    const wrapper = mount(FuelEnduranceCard)
    await wrapper.get('#fe-method').setValue('duration')
    return { store, wrapper }
  }
  it('requires explicit inputs, recomputes tanks/categories, clears on aircraft change and remount', async () => {
    const { store, wrapper } = await setup()
    const results = () => wrapper.find('[aria-label="Fuel planning results"]')
    expect(results().exists()).toBe(false)
    await wrapper.get('#fe-consumption').setValue('10')
    await wrapper.get('#fe-trip').setValue('120')
    await wrapper.get('#fe-reserve').setValue('30')
    expect(results().text()).toContain('240 min')
    expect(results().text()).toContain('15 kg')
    store.updateStationWeight(0, 20)
    await nextTick()
    expect(results().text()).toContain('WARN-FE-001')
    store.updateStationWeight(0, NaN)
    await nextTick()
    expect(results().exists()).toBe(false)
    store.updateStationWeight(0, 50)
    await nextTick()
    expect(results().exists()).toBe(true)
    store.activeCategory = null
    await nextTick()
    expect(results().exists()).toBe(false)
    store.activeCategory = store.aircraft!.certificationCategories[0]!.category
    await nextTick()
    expect(results().exists()).toBe(true)
    const aircraft = AircraftContextSchema.parse(syntheticFuelContext())
    store.loadProfile({ ...aircraft, id: 'different-aircraft' })
    await nextTick()
    expect(wrapper.get<HTMLSelectElement>('#fe-method').element.value).toBe('')
    expect(results().exists()).toBe(false)
    wrapper.unmount()
    const reopened = mount(FuelEnduranceCard)
    expect(reopened.find('[aria-label="Fuel planning results"]').exists()).toBe(false)
  })
  it('uses validated takeoff mass, retains unusable fuel and never changes the full-burn endpoint', async () => {
    const store = useMassBalanceStore()
    const aircraft = AircraftContextSchema.parse(syntheticFuelContext())
    aircraft.sourceUnit = 'kg'
    aircraft.weighingReports[0]!.basicEmptyMass = 560
    store.loadProfile(aircraft)
    const wrapper = mount(FuelEnduranceCard)
    await wrapper.get('#fe-method').setValue('duration')
    const arrival = () => wrapper.find('[aria-label="Estimated trip arrival"]')
    const values = () =>
      arrival()
        .findAll('dd')
        .map((dd) => dd.text())
    await wrapper.get('#fe-consumption').setValue('10')
    await wrapper.get('#fe-trip').setValue('120')
    await wrapper.get('#fe-reserve').setValue('30')
    expect(values()).toEqual(['600 kg', '20 kg', '580 kg', '20 kg'])
    expect(store.lastResult!.landingCenterOfGravityPoint.mass).toBe(560)
    await wrapper.get('#fe-trip').setValue('0')
    expect(values()).toEqual(['600 kg', '0 kg', '600 kg', '40 kg'])
    await wrapper.get('#fe-trip').setValue('240')
    expect(values()).toEqual(['600 kg', '40 kg', '560 kg', '0 kg'])
    expect(wrapper.text()).toContain('WARN-FE-001')
    await wrapper.get('#fe-trip').setValue('241')
    expect(arrival().exists()).toBe(false)
    expect(wrapper.text()).toContain('Trip fuel exceeds available usable fuel')
    expect(wrapper.text()).toContain('WARN-FE-001')
    await wrapper.get('#fe-trip').setValue('120')
    await wrapper.get('#fe-reserve').setValue('180')
    expect(values()).toEqual(['600 kg', '20 kg', '580 kg', '20 kg'])
    expect(wrapper.text()).toContain('WARN-FE-001')
    store.updateStationWeight(0, 60)
    await nextTick()
    expect(values()).toEqual(['610 kg', '20 kg', '590 kg', '30 kg'])
    store.lastResult = null
    await nextTick()
    expect(arrival().exists()).toBe(false)
    expect(wrapper.text()).toContain('Valid current Mass & Balance loading is required')
  })
  it('uses the same category-filtered tanks for takeoff and remaining fuel', async () => {
    const store = useMassBalanceStore()
    const aircraft = AircraftContextSchema.parse(syntheticFuelContext())
    aircraft.sourceUnit = 'kg'
    aircraft.weighingReports[0]!.basicEmptyMass = 560
    const category = aircraft.certificationCategories[0]!
    aircraft.certificationCategories = [
      { ...category, category: 'Normal' },
      { ...category, category: 'Utility' },
    ]
    aircraft.loadPoints.push({
      ...aircraft.loadPoints[0]!,
      name: 'Normal-only tank',
      defaultQuantity: 30,
      allowableCategories: ['Normal'],
    })
    store.loadProfile(aircraft)
    const wrapper = mount(FuelEnduranceCard)
    await wrapper.get('#fe-method').setValue('duration')
    await wrapper.get('#fe-consumption').setValue('10')
    await wrapper.get('#fe-trip').setValue('120')
    await wrapper.get('#fe-reserve').setValue('30')
    const values = () =>
      wrapper
        .findAll('[aria-label="Estimated trip arrival"] dd')
        .map((dd) => dd.text())
    expect(values()).toEqual(['620 kg', '20 kg', '600 kg', '40 kg'])
    store.changeCertificationCategory('Utility')
    await nextTick()
    expect(values()).toEqual(['600 kg', '20 kg', '580 kg', '20 kg'])
    store.updateStationWeight(1, NaN)
    await nextTick()
    expect(values()).toEqual(['600 kg', '20 kg', '580 kg', '20 kg'])
    store.changeCertificationCategory('Normal')
    await nextTick()
    expect(wrapper.find('[aria-label="Estimated trip arrival"]').exists()).toBe(false)
  })
  it('invalidates arrival on non-fuel loading failures and recomputes payload edits', async () => {
    const store = useMassBalanceStore()
    const aircraft = AircraftContextSchema.parse(syntheticFuelContext())
    aircraft.loadPoints.push({
      ...aircraft.loadPoints[0]!,
      name: 'Payload',
      fuelTank: null,
      defaultQuantity: 60,
    })
    store.loadProfile(aircraft)
    const wrapper = mount(FuelEnduranceCard)
    await wrapper.get('#fe-method').setValue('duration')
    for (const id of ['consumption', 'trip', 'reserve'])
      await wrapper.get(`#fe-${id}`).setValue('10')
    const mass = () =>
      wrapper.find('[aria-label="Estimated trip arrival"]').findAll('dd')[2]!.text()
    const before = mass()
    store.updateStationWeight(1, 70)
    await nextTick()
    expect(mass()).not.toBe(before)
    for (const invalid of [NaN, -1, Infinity, 101]) {
      store.updateStationWeight(1, invalid)
      await nextTick()
      expect(wrapper.find('[aria-label="Estimated trip arrival"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Arrival estimate unavailable')
    }
    store.updateStationWeight(1, 60)
    await nextTick()
    expect(mass()).toBe(before)
    store.aircraft!.loadPoints[0]!.unit = 'unsupported'
    await nextTick()
    expect(wrapper.find('[aria-label="Estimated trip arrival"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('unsupported fuel unit')
  })
  it.each(['', '-1', 'NaN', 'Infinity', '0x10', '1e2', '9'.repeat(400)])(
    'invalidates a prior result for %s',
    async (raw) => {
      const { wrapper } = await setup()
      for (const id of ['consumption', 'trip', 'reserve'])
        await wrapper.get(`#fe-${id}`).setValue('10')
      expect(wrapper.find('[aria-label="Fuel planning results"]').exists()).toBe(true)
      await wrapper.get('#fe-trip').setValue(raw)
      expect(wrapper.find('[aria-label="Fuel planning results"]').exists()).toBe(false)
    },
  )
  it('renders equality and reserve-only insufficiency without a success claim', async () => {
    const { wrapper } = await setup()
    await wrapper.get('#fe-consumption').setValue('10')
    await wrapper.get('#fe-trip').setValue('240')
    await wrapper.get('#fe-reserve').setValue('0')
    expect(wrapper.text()).toContain('Zero margin')
    expect(wrapper.text()).not.toContain('WARN-FE-001')
    await wrapper.get('#fe-trip').setValue('0')
    await wrapper.get('#fe-reserve').setValue('241')
    expect(wrapper.text()).toContain('reserve alone')
    expect(wrapper.text()).toContain('WARN-FE-001')
  })
  it('selects direct fuel without duration prerequisites and clears hidden inputs on switches', async () => {
    const { wrapper } = await setup()
    for (const id of ['consumption', 'trip', 'reserve'])
      await wrapper.get(`#fe-${id}`).setValue('10')
    await wrapper.get('#fe-method').setValue('direct')
    const arrival = () => wrapper.find('[aria-label="Estimated trip arrival"]')
    expect(arrival().exists()).toBe(false)
    expect(wrapper.text()).toContain('explicit finite nonnegative Trip Fuel')
    expect(wrapper.find('#fe-consumption').exists()).toBe(false)
    await wrapper.get('#fe-direct-trip').setValue('20')
    expect(arrival().findAll('dd')[3]!.text()).toBe('20 kg')
    for (const text of [
      'Total endurance',
      'Required reserve fuel',
      'WARN-FE-001',
      'Zero margin',
      'Margin =',
    ])
      expect(wrapper.text()).not.toContain(text)
    await wrapper.get('#fe-method').setValue('duration')
    expect(arrival().exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#fe-consumption').element.value).toBe('')
    await wrapper.get('#fe-method').setValue('direct')
    expect(wrapper.get<HTMLInputElement>('#fe-direct-trip').element.value).toBe('')
    expect(arrival().exists()).toBe(false)
  })
  it('direct zero/full fuel retains unusable mass, recomputes current loading and resets aircraft', async () => {
    const store = useMassBalanceStore()
    const aircraft = AircraftContextSchema.parse(syntheticFuelContext())
    aircraft.sourceUnit = 'kg'
    aircraft.weighingReports[0]!.basicEmptyMass = 560
    store.loadProfile(aircraft)
    const wrapper = mount(FuelEnduranceCard)
    expect(wrapper.get<HTMLSelectElement>('#fe-method').element.value).toBe('')
    await wrapper.get('#fe-method').setValue('direct')
    const input = wrapper.get('#fe-direct-trip')
    const values = () =>
      wrapper
        .findAll('[aria-label="Estimated trip arrival"] dd')
        .map((dd) => dd.text())
    await input.setValue('0')
    expect(values()).toEqual(['600 kg', '0 kg', '600 kg', '40 kg'])
    await input.setValue('40')
    expect(values()).toEqual(['600 kg', '40 kg', '560 kg', '0 kg'])
    await input.setValue('40,001')
    expect(values()).toEqual([])
    expect(wrapper.text()).toContain('Trip fuel exceeds available usable fuel')
    await input.setValue('20')
    store.updateStationWeight(0, 60)
    await nextTick()
    expect(values()).toEqual(['610 kg', '20 kg', '590 kg', '30 kg'])
    store.activeCategory = null
    await nextTick()
    expect(values()).toEqual([])
    store.activeCategory = aircraft.certificationCategories[0]!.category
    await nextTick()
    expect(values()).toEqual(['610 kg', '20 kg', '590 kg', '30 kg'])
    store.lastResult = null
    await nextTick()
    expect(values()).toEqual([])
    expect(wrapper.text()).toContain('Valid current Mass & Balance loading is required')
    store.loadProfile({ ...aircraft, id: 'next' })
    await nextTick()
    expect(wrapper.get<HTMLSelectElement>('#fe-method').element.value).toBe('')
    await wrapper.get('#fe-method').setValue('direct')
    expect(wrapper.get<HTMLInputElement>('#fe-direct-trip').element.value).toBe('')
    wrapper.unmount()
    expect(mount(FuelEnduranceCard).get<HTMLSelectElement>('#fe-method').element.value).toBe('')
  })
  it.each(['', '-1', 'NaN', 'Infinity', '0x10', '1e2', '2kg', '9'.repeat(400)])(
    'direct mode rejects %s after a valid result',
    async (raw) => {
      const { wrapper } = await setup()
      await wrapper.get('#fe-method').setValue('direct')
      await wrapper.get('#fe-direct-trip').setValue('20')
      expect(wrapper.find('[aria-label="Estimated trip arrival"]').exists()).toBe(true)
      await wrapper.get('#fe-direct-trip').setValue(raw)
      expect(wrapper.find('[aria-label="Estimated trip arrival"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('explicit finite nonnegative Trip Fuel')
    },
  )
})
