import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { useElectricPlanning } from '../services/use-electric-planning'
import ElectricEnergyCard from './ElectricEnergyCard.vue'

describe('electric energy budget', () => {
  it('updates, warns, suppresses invalid results and clears on aircraft switch', async () => {
    setActivePinia(createPinia())
    const store = useMassBalanceStore()
    store.aircraft = { id: 'one', powertrain: 'electric', batteryPack: { usableEnergyKwh: 30, reserveFloorKwh: 5 } } as typeof store.aircraft
    const planning = useElectricPlanning()
    const wrapper = mount(ElectricEnergyCard, { props: { planning } })
    await wrapper.get('#energy-available').setValue('20')
    await wrapper.get('#energy-power').setValue('20')
    expect(wrapper.text()).toContain('Estimated time to depletion60 min')
    expect(wrapper.text()).toContain('Estimated time above reserve floor45 min')
    expect(wrapper.text()).toContain('Energy budget unavailable')
    await wrapper.get('#energy-trip').setValue('45')
    await wrapper.get('#energy-reserve').setValue('0')
    expect(wrapper.text()).toContain('Estimated added reserve energy0 kWh')
    expect(wrapper.text()).toContain('Difference to reserve floor after trip and added reserve0 kWh')
    await wrapper.get('#energy-reserve').setValue('15')
    expect(wrapper.text()).toContain('after trip and added reserve is below the reserve floor')
    await wrapper.get('#energy-reserve').setValue('-1')
    expect(wrapper.text()).toContain('Added reserve budget unavailable')
    expect(wrapper.text()).not.toContain('Estimated added reserve energy')
    expect(wrapper.text()).toContain('Estimated trip energy15 kWh')
    await wrapper.get('#energy-reserve').setValue('0')
    await wrapper.get('#energy-trip').setValue('60')
    expect(wrapper.findAll('[role="alert"]').at(-1)!.text()).toContain('below the reserve floor')
    expect(wrapper.text()).toContain('-5 kWh')
    await wrapper.get('#energy-available').setValue('31')
    expect(wrapper.text()).toContain('Energy budget unavailable')
    expect(wrapper.find('[aria-label="Estimated energy budget"]').exists()).toBe(false)
    store.aircraft = { ...store.aircraft!, id: 'two' }
    expect(planning.available.value).toBe('')
    expect(planning.power.value).toBe('')
    expect(planning.minutes.value).toBe('')
    expect(planning.reserveMinutes.value).toBe('')
  })
})
