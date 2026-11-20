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
  step.manualConfiguration.value = 's9'
  step.pa.method.value = 'direct'; step.pa.direct.value = '1000'; step.temperature.value = '10'
  return { step, runway, context }
}
const corrected = (step: ReturnType<typeof setup>['step'], index: number) => step.presentation.value.corrected[index]!

describe('corrected distances in the performance step', () => {
  it('clears the manual selection when the profile changes', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, context } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      expect(corrected(step, 0).status).toBe('applied')
      context.profile = s9Profile('D-OTHER')
      expect(step.manualConfiguration.value).toBe('')
      expect(corrected(step, 0).status).toBe('unavailable')
    })
    effect.stop()
  })

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

  it.each(['takeoff', 'landing'] as const)('identifies unapplied inputs for %s', (operation) => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup('D-OTHER')
      Object.assign(step.corrections[operation], { headwind: '-5', slope: '2' })
      const item = corrected(step, operation === 'takeoff' ? 0 : 1)
      expect(item.status).toBe('unavailable')
      if (item.status !== 'unavailable') throw new Error('expected unavailable')
      expect(item.reason).toContain('Wind component -5 kt was not applied')
      expect(item.reason).toContain('Runway slope 2 % was not applied')
    })
    effect.stop()
  })

  it.each([['takeoff', '-1'], ['landing', '1']] as const)('marks favourable %s inputs partially corrected', (operation, slope) => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup()
      Object.assign(step.corrections[operation], { headwind: '5', slope })
      const item = corrected(step, operation === 'takeoff' ? 0 : 1)
      if (item.status !== 'applied') throw new Error('expected applied')
      expect(item.partial).toBe(true)
      expect(item.notes.join(' ')).toContain('Wind component 5 kt was not applied')
      expect(item.notes.join(' ')).toContain(`Runway slope ${slope} % was not applied`)
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

  it('blocks a previously saved runway if storage reports an error', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      expect(corrected(step, 0).status).toBe('applied')
      runway.storageError = 'Storage unavailable'
      expect(corrected(step, 0).status).toBe('unavailable')
      expect(step.presentation.value.runway.status).toBe('unavailable')
    })
    effect.stop()
  })

  it('invalidates the comparison on a surface edit and blocks an unsupported saved condition', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      expect(corrected(step, 0).status).toBe('applied')
      runway.draft.surfaceCondition = 'ice'
      expect(corrected(step, 0).status).toBe('unavailable')
      expect(runway.save()).toBe(true)
      expect(corrected(step, 0).status).toBe('unavailable')
    })
    effect.stop()
  })

  it('compares the final distance over 50 ft with the declared runway and reports margins', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      const fits = corrected(step, 0)
      if (fits.status !== 'applied') throw new Error('expected applied')
      expect(fits.comparison).toMatchObject({ status: 'sufficient', availableLabel: 'TORA', available: '1,000.0 m' })
      expect(fits.comparison.margin).toMatch(/^\+.* m \(\+.* %\)$/)
      // Shortening the declared runway below the requirement flips the result after saving.
      runway.draft.tora = '100'; runway.save()
      const short = corrected(step, 0)
      if (short.status !== 'applied') throw new Error('expected applied')
      expect(short.comparison.status).toBe('insufficient')
      expect(short.comparison.summary).toContain('Runway insufficient')
      expect(short.comparison.margin.startsWith('−')).toBe(true)
    })
    effect.stop()
  })

  it('keeps shared notifications aligned with current results and clears them when inputs become invalid', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      expect(step.presentation.value.notifications.map(n => n.id)).toEqual(['WARN-PF-002'])
      runway.draft.tora = '100'; runway.save()
      expect(step.presentation.value.notifications.map(n => n.id)).toEqual(['CRIT-PF-002', 'WARN-PF-002'])
      expect(step.presentation.value.notifications[0]).toMatchObject({ severity: 'CRITICAL', context: 'Performance.RunwayLength', persistent: true })
      runway.draft.surfaceCondition = ''
      expect(corrected(step, 0).status).toBe('unavailable')
      expect(step.presentation.value.notifications).toEqual([])
    })
    effect.stop()
  })

  it('compares landing with LDA and treats feet as converted and rounded down', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      runway.draft.ldaUnit = 'ft'; runway.draft.lda = '3000'; runway.save()
      Object.assign(step.corrections.landing, { headwind: '0', slope: '0' })
      const landing = corrected(step, 1)
      if (landing.status !== 'applied') throw new Error('expected applied')
      expect(landing.comparison.availableLabel).toBe('LDA')
      expect(landing.comparison.available).toBe('914.4 m')
    })
    effect.stop()
  })

  it('applies the selected safety factor and raises WARN-PF-002 below the recommended minimum', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      Object.assign(step.corrections.landing, { headwind: '0', slope: '0' })
      const at = (index: number) => { const item = corrected(step, index); if (item.status !== 'applied') throw new Error('expected applied'); return item }
      // Manual default: take-off 1.10 is below the 1.25 baseline, landing 1.67 is above 1.43.
      expect(at(0).safetyFactorWarning).toContain('WARN-PF-002')
      expect(at(0).safetyFactorWarning).toContain('1.25')
      expect(at(1).safetyFactorWarning).toBeNull()
      const roll = at(0).rows[0]!.corrected
      step.safetyFactors.takeoff.preset = 'easa-standard'
      expect(at(0).safetyFactorWarning).toBeNull()
      expect(at(0).rows[0]!.factored).toBe(`${Math.ceil(Number(roll.replace(/[^\d]/g, '')) * 1.25)} m`)
      // The EASA landing baseline is below the manual's 1.67, so choosing it warns.
      step.safetyFactors.landing.preset = 'easa-standard'
      expect(at(1).safetyFactorWarning).toContain('1.67')
      step.safetyFactors.landing.preset = 'custom'
      expect(corrected(step, 1)).toMatchObject({ status: 'unavailable' })
      step.safetyFactors.landing.custom = '3.01'
      expect(corrected(step, 1).status).toBe('unavailable')
      step.safetyFactors.landing.custom = '1.7'
      expect(at(1).safetyFactorWarning).toBeNull()
      expect(at(1).safetyFactor).toContain('1.70')
    })
    effect.stop()
  })

  it.each([
    ['TakeoffDistance50ft', false, true],
    ['TakeoffRoll', true, false],
  ] as const)('marks each value according to its inputs when %s is missing', (phase, rollEstimated, over50Estimated) => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway, context } = setup()
      context.profile!.performanceProfiles = context.profile!.performanceProfiles!.filter(table => table.flightPhase !== phase)
      step.manualConfiguration.value = 's9'
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      Object.assign(runway.draft, { tora: '100', toda: '5000', todaUnit: 'm' }); runway.save()
      const item = corrected(step, 0)
      if (item.status !== 'applied') throw new Error('expected applied')
      const marked = (value: string) => value.includes('ESTIMATED (CAA SSL 07)')
      expect(marked(item.rows[0]!.raw)).toBe(rollEstimated)
      expect(marked(item.rows[0]!.corrected)).toBe(rollEstimated)
      expect(marked(item.rows[0]!.factored)).toBe(rollEstimated)
      expect(marked(item.rows[1]!.raw)).toBe(over50Estimated)
      expect(marked(item.rows[1]!.corrected)).toBe(true)
      expect(marked(item.rows[1]!.factored)).toBe(true)
      expect(marked(item.comparison.required)).toBe(true)
      expect(marked(item.comparison.margin)).toBe(true)
      expect(item.comparison.summary).toContain('ground roll')
      expect(marked(item.comparison.summary)).toBe(rollEstimated)
    })
    effect.stop()
  })

  it('compares the 50 ft distance with TODA and the ground roll with TORA when TODA is declared', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      Object.assign(runway.draft, { toda: '2000', todaUnit: 'm' }); runway.save()
      const item = corrected(step, 0)
      if (item.status !== 'applied') throw new Error('expected applied')
      expect(item.comparison).toMatchObject({ status: 'sufficient', availableLabel: 'TODA', available: '2,000.0 m' })
      expect(step.presentation.value.runway).toMatchObject({ status: 'declared' })
      // A ground roll beyond TORA is insufficient even when TODA is long.
      runway.draft.tora = '100'; runway.draft.toda = '5000'; runway.save()
      const short = corrected(step, 0)
      if (short.status !== 'applied') throw new Error('expected applied')
      expect(short.comparison.status).toBe('insufficient')
      expect(short.comparison.summary).toContain('ground roll')
    })
    effect.stop()
  })
})
