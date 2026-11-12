// @IT-MB-STORE-004@ (FROM: @IMP-MB-STORE-023@)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { AircraftContextSchema } from '../data/aircraft-context.schema'
import { AIRCRAFT_CATALOGUE } from '../data/aircraft-catalogue'
import { useMassBalanceStore } from './mass-balance.store'
import MassStationInput from '../components/MassStationInput.vue'

describe('optional occupancy through the real input and math adapter', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function setup() {
    const store = useMassBalanceStore()
    const profile = structuredClone(AIRCRAFT_CATALOGUE.find(p => p.registration === 'D-ECSM')!)
    store.loadProfile(AircraftContextSchema.parse(profile))
    store.updateStationWeight(0, 80)
    const wrapper = mount(MassStationInput, {
      props: { station: store.stations[1]!, 'onUpdate:weight': (value: number) => store.updateStationWeight(1, value) },
    })
    return { store, wrapper }
  }

  it('allows empty optional seats, baggage and unchanged fuel rules', () => {
    const { store } = setup()
    expect(store.notifications.some(n => n.id === 'WARN-UQ-001')).toBe(false)
    expect(store.hasErrorNotification).toBe(false)
    expect(store.allMandatoryFieldsPopulated).toBe(true)
    expect(store.lastResult).not.toBeNull()
  })

  it.each(['', '-1', 'NaN', 'Infinity', '1e2', '0x0', '9'.repeat(400)])('does not convert %s to accepted zero on blur', async (raw) => {
    const { store, wrapper } = setup()
    const input = wrapper.get('input[type="text"]')
    await input.setValue(raw)
    await input.trigger('blur')
    expect(Number.isNaN(store.stations[1]!.weight)).toBe(true)
    expect(store.lastResult).toBeNull()
    expect(store.hasErrorNotification).toBe(true)
    expect(store.uiState).toBe('ERROR_CRITICAL')
    await input.setValue('0')
    await input.trigger('blur')
    expect(store.stations[1]!.weight).toBe(0)
    expect(store.hasErrorNotification).toBe(false)
    wrapper.unmount()
  })

  it.each([-1, NaN, Infinity, undefined])('rejects invalid direct store input %s', (weight) => {
    const { store } = setup()
    store.updateStationWeight(1, weight as number)
    expect(store.lastResult).toBeNull()
    expect(store.hasErrorNotification).toBe(true)
  })
})
