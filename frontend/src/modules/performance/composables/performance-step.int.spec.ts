import { createPinia, setActivePinia } from 'pinia'
import { effectScope, reactive } from 'vue'
import { beforeEach, expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import { useUnitPreferencesStore } from '../stores/unit-preferences.store'
import { usePerformanceStep, type PerformanceStepContext } from './performance-step'

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })

it('keeps phase masses independent and invalidates synchronously on all source changes', () => {
  const scope = effectScope()
  scope.run(() => {
    const context = reactive<PerformanceStepContext>({
      ready: true, notReadyReason: '', profile: testPohAircraft(), category: 'Normal', revision: '',
      takeoff: { status: 'ready', massKg: 900, origin: 'M&B' },
      landing: { status: 'ready', massKg: 850, origin: 'trip arrival' },
    })
    const step = usePerformanceStep(() => context)
    step.pa.method.value = 'direct'; step.pa.direct.value = '1000'; step.temperature.value = '10'
    expect(step.presentation.value.groups[0]!.rows[0]!.value).toBe('220.0 m')
    expect(step.presentation.value.inputs).toContainEqual({ label: 'Entered pressure altitude', value: '1000 ft' })
    expect(step.presentation.value.operational.status).toBe('unavailable')
    expect(step.presentation.value.operational.rows).toHaveLength(6)
    expect(step.presentation.value.operational.rows[0]!.reasons).toContain('Needs your wind component in knots for each operation.')
    expect(step.presentation.value.groups[1]!.rows[0]!.value).toBe('370.0 m')
    const runway = useManualRunwayStore()
    const units = useUnitPreferencesStore()
    const changes = [
      () => { context.landing = { status: 'unavailable', reason: 'invalid trip' } },
      () => { context.revision = 'different payload, same total mass' },
      () => { context.category = 'Utility' },
      () => { context.profile!.model = 'Edited source' },
      () => { step.pa.direct.value = '1100' },
      () => { step.temperature.value = '11' },
      () => { runway.draft.tora = '900' },
      () => { runway.draft.tora = '901' },
      () => { units.set('runwayDistance', 'ft') },
    ]
    for (const change of changes) {
        expect(step.presentation.value.status).toBe('assessed')
      change()
      expect(step.presentation.value.status).toBe('assessed')
      expect(step.presentation.value.groups[0]!.rows).toHaveLength(2)
    }
    expect(step.presentation.value.groups[0]!.status).toBe('success')
    expect(step.presentation.value.groups[1]).toMatchObject({ status: 'blocked', reason: 'invalid trip', rows: [] })
    context.ready = false
    expect(step.presentation.value.groups[0]!.rows).toEqual([])
  })
  scope.stop()
})

it('persists preferences while new sessions clear numeric PA/QNH and preserves runway physical values', () => {
  const scope = effectScope()
  scope.run(() => {
    const runway = useManualRunwayStore(); runway.load()
    Object.assign(runway.draft, { aerodrome: 'TEST', designator: '18', tora: '1000', lda: '900', fieldElevation: '1000', surfaceType: 'paved', surfaceCondition: 'dry' })
    runway.draft.toraUnit = 'ft'
    runway.draft.fieldElevationUnit = 'm'
    expect(runway.draft.tora).toBe('3280.8399')
    expect(runway.draft.fieldElevation).toBe('304.8')
    expect(runway.save()).toBe(true)
    const units = useUnitPreferencesStore(); units.set('runwayDistance', 'ft'); units.set('fieldElevation', 'm')
    setActivePinia(createPinia())
    const reloaded = useManualRunwayStore(); reloaded.load()
    expect(reloaded.draft.tora).toBe('3280.8399')
    expect(reloaded.draft.fieldElevation).toBe('304.8')
    expect(useUnitPreferencesStore().preferences.fieldElevation).toBe('m')
    expect(JSON.stringify(localStorage)).not.toContain('qnhValue')
  })
  scope.stop()
})
