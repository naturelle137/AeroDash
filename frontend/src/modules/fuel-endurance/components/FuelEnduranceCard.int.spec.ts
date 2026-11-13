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
  function setup() {
    const store = useMassBalanceStore()
    store.loadProfile(AircraftContextSchema.parse(syntheticFuelContext()))
    const wrapper = mount(FuelEnduranceCard)
    return { store, wrapper }
  }
  it('requires explicit inputs, recomputes tanks/categories, clears on aircraft change and remount', async () => {
    const { store, wrapper } = setup()
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
    expect(wrapper.get<HTMLInputElement>('#fe-consumption').element.value).toBe('')
    expect(results().exists()).toBe(false)
    wrapper.unmount()
    const reopened = mount(FuelEnduranceCard)
    expect(reopened.find('[aria-label="Fuel planning results"]').exists()).toBe(false)
  })
  it.each(['', '-1', 'NaN', 'Infinity', '0x10', '1e2', '9'.repeat(400)])(
    'invalidates a prior result for %s',
    async (raw) => {
      const { wrapper } = setup()
      for (const id of ['consumption', 'trip', 'reserve'])
        await wrapper.get(`#fe-${id}`).setValue('10')
      expect(wrapper.find('[aria-label="Fuel planning results"]').exists()).toBe(true)
      await wrapper.get('#fe-trip').setValue(raw)
      expect(wrapper.find('[aria-label="Fuel planning results"]').exists()).toBe(false)
    },
  )
  it('renders equality and reserve-only insufficiency without a success claim', async () => {
    const { wrapper } = setup()
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
})
