import { createPinia, setActivePinia } from 'pinia'
import { effectScope, reactive } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import { usePerformanceStep, type PerformanceStepContext } from '../composables/performance-step'

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })

// Synthetic wiring vectors on a profile that only matches the D-EBPN source scope; not POH data.
function s9Profile(registration = 'D-EBPN') {
  const profile = testPohAircraft()
  return { ...profile, registration, icaoTypeDesignator: 'P208', certificationCategories: [{ ...profile.certificationCategories[0]!, mtom: 650 }] }
}

function setup(registration?: string, surface: 'paved' | 'unpaved' = 'paved', save = true) {
  const context = reactive<PerformanceStepContext>({
    ready: true, notReadyReason: '', profile: s9Profile(registration), category: 'Normal', revision: '',
    takeoff: { status: 'ready', massKg: 900, origin: 'M&B' },
    landing: { status: 'ready', massKg: 900, origin: 'M&B' },
  })
  const runway = useManualRunwayStore(); runway.load()
  Object.assign(runway.draft, { aerodrome: 'TEST', designator: '18', tora: '1000', lda: '900', fieldElevation: '100',
    surfaceType: surface, surfaceCondition: surface === 'paved' ? 'dry' : 'dry-short-grass' })
  if (save) runway.save()
  const step = usePerformanceStep(() => context)
  step.pa.method.value = 'direct'; step.pa.direct.value = '1000'; step.temperature.value = '10'
  return { step, runway }
}
const corrected = (step: ReturnType<typeof setup>['step'], index: number) => step.presentation.value.corrected[index]!

describe('corrected distances in the performance step', () => {
  it('stays uncorrected until wind and slope are entered; empty is never zero', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup()
      expect(corrected(step, 0)).toMatchObject({ operation: 'takeoff', status: 'unavailable' })
      expect((corrected(step, 0) as { reason: string }).reason).toContain('headwind component')
      step.corrections.takeoff.headwind = '0'
      expect((corrected(step, 0) as { reason: string }).reason).toContain('runway slope')
      step.corrections.takeoff.slope = 'abc'
      expect(corrected(step, 0).status).toBe('unavailable')
      step.corrections.takeoff.slope = '100'
      expect(corrected(step, 0).status).toBe('unavailable')
    })
    effect.stop()
  })

  it('applies the manual rules to the raw table distance with source provenance', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup()
      expect(step.presentation.value.groups[0]!.rows[0]!.value).toBe('220.0 m')
      Object.assign(step.corrections.takeoff, { headwind: '-2', slope: '1' })
      const item = corrected(step, 0)
      if (item.status !== 'applied') throw new Error('expected applied')
      // roll 220 → paved ×0.9 → slope ×1.07 → +30 m tailwind, × 1.10; over 50 ft keeps the airborne part.
      const roll = 220 * 0.9 * 1.07 + 30
      expect(item.rows[0]!.factored).toBe(`${Math.ceil(roll * 1.1)} m`)
      expect(item.rows[0]!.raw).toBe('220.0 m')
      expect(item.source).toContain('Revision 18')
      expect(item.notes.join(' ')).toContain('in-service factor')
      // The raw group is untouched.
      expect(step.presentation.value.groups[0]!.rows[0]!.value).toBe('220.0 m')
    })
    effect.stop()
  })

  it('reports not-credited headwind and keeps landing independent of takeoff inputs', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup('D-EBPN', 'unpaved')
      Object.assign(step.corrections.landing, { headwind: '10', slope: '-2' })
      expect(corrected(step, 0).status).toBe('unavailable')
      const landing = corrected(step, 1)
      if (landing.status !== 'applied') throw new Error('expected applied')
      expect(landing.notes.join(' ')).toContain('Headwind is not credited')
      expect(landing.notes.join(' ')).toContain('650 kg only')
      expect(step.presentation.value.inputs).toContainEqual({ label: 'Landing headwind component', value: '10 kt' })
    })
    effect.stop()
  })

  it.each([
    ['another registration', () => setup('D-TEST'), 'No accepted correction source'],
    ['an unsaved runway', () => setup('D-EBPN', 'paved', false), 'No accepted correction source'],
  ])('refuses correction for %s', (_name, build, message) => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = build()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      const item = corrected(step, 0)
      expect(item.status).toBe('unavailable')
      expect((item as { reason: string }).reason).toContain(message)
    })
    effect.stop()
  })

  it('removes a corrected result when a condition changes', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      expect(corrected(step, 0).status).toBe('applied')
      step.corrections.takeoff.headwind = ''
      expect(corrected(step, 0).status).toBe('unavailable')
    })
    effect.stop()
  })
})
