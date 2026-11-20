import { createPinia, setActivePinia } from 'pinia'
import { effectScope, reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import { useUnitPreferencesStore } from '../stores/unit-preferences.store'
import { usePerformanceStep, type PerformanceStepContext } from './performance-step'

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
afterEach(() => { vi.restoreAllMocks() })

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

it('withholds extrapolated results until acknowledged and revokes the acknowledgment on every input change', () => {
  const scope = effectScope()
  scope.run(() => {
    const context = reactive<PerformanceStepContext>({
      ready: true, notReadyReason: '', profile: testPohAircraft(), category: 'Normal', revision: '',
      takeoff: { status: 'ready', massKg: 1050, origin: 'M&B' },
      landing: { status: 'ready', massKg: 850, origin: 'trip arrival' },
    })
    const step = usePerformanceStep(() => context)
    const runway = useManualRunwayStore()
    const units = useUnitPreferencesStore()
    step.pa.method.value = 'direct'; step.pa.direct.value = '1000'; step.temperature.value = '10'
    const groups = () => step.presentation.value.groups
    expect(groups()[0]).toMatchObject({ status: 'blocked', rows: [] })
    expect(groups()[0]!.reason).toContain('withheld')
    expect(groups()[1]).toMatchObject({ status: 'success' })
    expect(step.presentation.value.extrapolation).toMatchObject({ acknowledged: false })
    expect(step.presentation.value.extrapolation!.details[0]).toContain('mass 1,050.0 kg is 5.0 % above the table maximum 1,000.0 kg')
    expect(step.presentation.value.corrected.every((item) => item.status === 'unavailable')).toBe(true)

    step.extrapolationAcknowledged.value = true
    expect(step.presentation.value.extrapolation).toMatchObject({ acknowledged: true })
    expect(groups()[0]!.rows.map((row) => [row.value, row.note])).toEqual([
      ['384.0 m', 'ESTIMATED — EXTRAPOLATED (+20 % penalty)'], ['504.0 m', 'ESTIMATED — EXTRAPOLATED (+20 % penalty)'],
    ])

    const changes = [
      () => { context.takeoff = { status: 'ready', massKg: 1060, origin: 'M&B' } },
      () => { context.landing = { status: 'ready', massKg: 860, origin: 'trip arrival' } },
      () => { context.revision = 'different payload, same total mass' },
      () => { context.category = 'Utility' },
      () => { context.profile!.model = 'Edited source' },
      () => { step.pa.direct.value = '1100' },
      () => { step.temperature.value = '11' },
      () => { step.corrections.takeoff.headwind = '5' },
      () => { step.safetyFactors.takeoff.preset = 'easa-standard' },
      () => { runway.draft.tora = '900' },
      () => { units.set('runwayDistance', 'ft') },
    ]
    for (const change of changes) {
      step.extrapolationAcknowledged.value = true
      expect(step.extrapolationAcknowledged.value).toBe(true)
      change()
      expect(step.extrapolationAcknowledged.value).toBe(false)
      expect(groups()[0]!.rows).toEqual([])
    }
    // Returning to an earlier input does not resurrect an old acknowledgment.
    step.temperature.value = '10'
    step.extrapolationAcknowledged.value = true
    step.temperature.value = '12'
    step.temperature.value = '10'
    expect(step.extrapolationAcknowledged.value).toBe(false)
  })
  scope.stop()
})

it('blocks beyond the extrapolation limit with no acknowledgment path', () => {
  const scope = effectScope()
  scope.run(() => {
    const context = reactive<PerformanceStepContext>({
      ready: true, notReadyReason: '', profile: testPohAircraft(), category: 'Normal', revision: '',
      takeoff: { status: 'ready', massKg: 1101, origin: 'M&B' },
      landing: { status: 'ready', massKg: 850, origin: 'trip arrival' },
    })
    const step = usePerformanceStep(() => context)
    step.pa.method.value = 'direct'; step.pa.direct.value = '1000'; step.temperature.value = '10'
    expect(step.presentation.value.groups[0]).toMatchObject({ status: 'blocked', rows: [] })
    expect(step.presentation.value.groups[0]!.reason).toContain('fixed 10 % extrapolation limit')
    expect(step.presentation.value.extrapolation).toBeNull()
    step.extrapolationAcknowledged.value = true
    expect(step.presentation.value.groups[0]).toMatchObject({ status: 'blocked', rows: [] })
  })
  scope.stop()
})

it('blocks upper excursions when the source prohibits extrapolation', () => {
  const scope = effectScope()
  scope.run(() => {
    const context = reactive<PerformanceStepContext>({
      ready: true, notReadyReason: '', profile: testPohAircraft(), category: 'Normal', revision: '',
      takeoff: { status: 'ready', massKg: 1050, origin: 'M&B' },
      landing: { status: 'ready', massKg: 850, origin: 'trip arrival' },
    })
    context.profile!.performanceProfiles![0]!.extrapolation = 'prohibited'
    const step = usePerformanceStep(() => context)
    step.pa.method.value = 'direct'; step.pa.direct.value = '1000'; step.temperature.value = '10'
    expect(step.presentation.value.groups[0]).toMatchObject({ status: 'blocked', rows: [] })
    expect(step.presentation.value.groups[0]!.reason).toContain('above the table maximum')
    expect(step.presentation.value.groups[1]!.status).toBe('success')
    expect(step.presentation.value.extrapolation).toBeNull()
    step.extrapolationAcknowledged.value = true
    expect(step.presentation.value.groups[0]).toMatchObject({ status: 'blocked', rows: [] })
  })
  scope.stop()
})

it('records an unverified obstacle, invalidates on edit and drops it when cleared', () => {
  const scope = effectScope()
  scope.run(() => {
    const context = reactive<PerformanceStepContext>({
      ready: true, notReadyReason: '', profile: testPohAircraft(), category: 'Normal', revision: '',
      takeoff: { status: 'ready', massKg: 900, origin: 'M&B' }, landing: { status: 'ready', massKg: 850, origin: 'M&B' },
    })
    const step = usePerformanceStep(() => context)
    step.pa.method.value = 'direct'; step.pa.direct.value = '1000'; step.temperature.value = '10'
    const ids = () => step.presentation.value.notifications.map((n) => n.id)
    expect(ids()).not.toContain('WARN-PF-001')
    const keyBefore = step.presentation.value.inputKey
    step.obstacle.height = '50'; step.obstacle.distance = '600'
    expect(ids()).toContain('WARN-PF-001')
    expect(step.presentation.value.inputKey).not.toBe(keyBefore)
    expect(step.presentation.value.inputs).toContainEqual({ label: 'Unverified obstacle constraint', value: '50 ft above the runway at 600 ft from the runway' })
    expect(step.presentation.value.scope.join(' ')).toContain('not calculated')
    step.obstacle.distance = '-1'
    expect(ids()).not.toContain('WARN-PF-001')
    step.obstacle.height = ''; step.obstacle.distance = ''
    expect(step.presentation.value.inputKey).toBe(keyBefore)
    expect(step.presentation.value.inputs).toContainEqual({ label: 'Unverified obstacle constraint', value: 'None' })
  })
  scope.stop()
})
