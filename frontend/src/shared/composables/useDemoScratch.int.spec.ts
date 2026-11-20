import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { beforeEach, expect, it } from 'vitest'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { useFuelPlanning } from '@/modules/fuel-endurance/services/use-fuel-planning'
import { usePerformanceStep } from '@/modules/performance/composables/performance-step'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

// Minimal loaded-aircraft state: the demo only needs `aircraft` to be set.
// Loaded before the inputs are typed: a new aircraft id resets fuel inputs by design.
const loadAircraft = () => {
  const store = useMassBalanceStore()
  store.$patch({ aircraft: { id: 'demo-test' } as never })
  return store
}

it('restores fuel planning inputs exactly when the demo is discarded', () => {
  const scope = effectScope()
  scope.run(() => {
    const store = loadAircraft()
    const fuel = useFuelPlanning()
    fuel.method.value = 'duration'
    fuel.consumption.value = '30'
    fuel.trip.value = '60'
    fuel.reserve.value = '45'
    store.enterDemo()
    fuel.method.value = 'direct'
    fuel.directTripFuel.value = '99'
    fuel.consumption.value = ''
    store.exitDemo()
    expect(fuel.method.value).toBe('duration')
    expect(fuel.consumption.value).toBe('30')
    expect(fuel.trip.value).toBe('60')
    expect(fuel.reserve.value).toBe('45')
    expect(fuel.directTripFuel.value).toBe('')
  })
  scope.stop()
})

it('restores performance inputs exactly when the demo is discarded', () => {
  const scope = effectScope()
  scope.run(() => {
    const store = loadAircraft()
    const step = usePerformanceStep(() => ({
      ready: true, notReadyReason: '', profile: testPohAircraft(), category: 'Normal',
      takeoff: { status: 'ready', massKg: 900, origin: 'M&B' },
      landing: { status: 'ready', massKg: 850, origin: 'M&B' },
    }))
    step.pa.method.value = 'qnh-elevation'
    step.pa.draft.qnh = '1013'
    step.pa.draft.elevation = '500'
    step.pa.draft.elevationUnit = 'ft'
    step.temperature.value = '10'
    step.corrections.takeoff.headwind = '5'
    const before = JSON.stringify(step.presentation.value.inputs)
    store.enterDemo()
    step.pa.method.value = 'direct'
    step.pa.direct.value = '4000'
    step.pa.draft.elevationUnit = 'm'
    step.temperature.value = '30'
    step.corrections.takeoff.headwind = '-10'
    step.safetyFactors.landing.preset = 'custom'
    expect(JSON.stringify(step.presentation.value.inputs)).not.toBe(before)
    store.exitDemo()
    expect(JSON.stringify(step.presentation.value.inputs)).toBe(before)
    expect(step.pa.draft).toMatchObject({ qnh: '1013', elevation: '500', elevationUnit: 'ft' })
    expect(step.safetyFactors.landing.preset).toBe('poh-afm')
  })
  scope.stop()
})
