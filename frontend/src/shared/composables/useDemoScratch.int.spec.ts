import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { beforeEach, expect, it } from 'vitest'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { useFuelPlanning } from '@/modules/fuel-endurance/services/use-fuel-planning'
import { useDemoScratch } from '@/shared/composables/useDemoScratch'
import { saveManualRunway } from '@/modules/airport/services/manual-runway.repository'
import { usePerformanceStep } from '@/modules/performance/composables/performance-step'
import { UNIT_PREFERENCES_STORAGE_KEY, useLoadedUnitPreferences } from '@/modules/performance/stores/unit-preferences.store'

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
    step.obstacle.height = '50'
    step.obstacle.distance = '600'
    const before = JSON.stringify(step.presentation.value.inputs)
    store.enterDemo()
    step.pa.method.value = 'direct'
    step.pa.direct.value = '4000'
    step.pa.draft.elevationUnit = 'm'
    step.temperature.value = '30'
    step.corrections.takeoff.headwind = '-10'
    step.safetyFactors.landing.preset = 'custom'
    step.obstacle.height = '100'
    expect(JSON.stringify(step.presentation.value.inputs)).not.toBe(before)
    store.exitDemo()
    expect(JSON.stringify(step.presentation.value.inputs)).toBe(before)
    expect(step.pa.draft).toMatchObject({ qnh: '1013', elevation: '500', elevationUnit: 'ft' })
    expect(step.safetyFactors.landing.preset).toBe('poh-afm')
  })
  scope.stop()
})

it('keeps demo unit changes out of storage and restores them on discard, including when first opened in demo', () => {
  const store = loadAircraft()
  localStorage.setItem(UNIT_PREFERENCES_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, qnh: 'hPa', pressureAltitude: 'ft', fieldElevation: 'ft', runwayDistance: 'm' }))
  const saved = localStorage.getItem(UNIT_PREFERENCES_STORAGE_KEY)
  store.enterDemo()
  const units = useLoadedUnitPreferences()
  units.set('fieldElevation', 'm')
  units.set('runwayDistance', 'ft')
  expect(units.preferences).toMatchObject({ fieldElevation: 'm', runwayDistance: 'ft' })
  expect(localStorage.getItem(UNIT_PREFERENCES_STORAGE_KEY)).toBe(saved)
  store.exitDemo()
  expect(units.preferences).toMatchObject({ fieldElevation: 'ft', runwayDistance: 'm' })
  expect(localStorage.getItem(UNIT_PREFERENCES_STORAGE_KEY)).toBe(saved)
  units.set('runwayDistance', 'ft')
  expect(localStorage.getItem(UNIT_PREFERENCES_STORAGE_KEY)).not.toBe(saved)
})

it('never restores a runway-copied elevation whose saved runway changed during the demo', async () => {
  const { useManualRunwayStore } = await import('@/modules/airport/stores/manual-runway.store')
  const { usePressureAltitudeInput } = await import('@/modules/performance/composables/pressure-altitude-input')
  const store = loadAircraft()
  const runway = useManualRunwayStore()
  runway.load()
  Object.assign(runway.draft, {
    aerodrome: 'TEST', designator: '18', toraUnit: 'm', tora: '1000', lda: '900', ldaUnit: 'm',
    fieldElevation: '100', fieldElevationUnit: 'ft', surfaceType: 'paved', surfaceCondition: 'dry',
  })
  runway.save(new Date('2026-11-12T08:00:00.000Z'))
  const scope = effectScope()
  scope.run(() => {
    const input = usePressureAltitudeInput()
    useDemoScratch(input.snapshot, input.restore)
    input.useRunwayElevation()
    store.enterDemo()
    // Defence in depth: a declaration changed behind the store while the demo is active.
    saveManualRunway(runway.saved!.runway, new Date('2026-11-13T08:00:00.000Z'))
    store.exitDemo()
    expect(input.copiedFromRunway.value).toBe(false)
    expect(input.draft.elevation).toBe('')
  })
  scope.stop()
})
