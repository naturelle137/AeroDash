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
    await wrapper.get('#energy-trip').setValue('60')
    expect(wrapper.get('[role="alert"]').text()).toContain('below the reserve floor')
    expect(wrapper.text()).toContain('-5 kWh')
    await wrapper.get('#energy-available').setValue('31')
    expect(wrapper.text()).toContain('Energy budget unavailable')
    expect(wrapper.find('[aria-label="Estimated energy budget"]').exists()).toBe(false)
    store.aircraft = { ...store.aircraft!, id: 'two' }
    expect(planning.available.value).toBe('')
    expect(planning.power.value).toBe('')
    expect(planning.minutes.value).toBe('')
  })
})
