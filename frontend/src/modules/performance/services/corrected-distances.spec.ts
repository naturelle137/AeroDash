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
  it.each(['takeoff', 'landing'] as const)('honours pilot ground correction order for %s', (operation) => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup()
      const input = step.corrections[operation]
      Object.assign(input, { headwind: '0', slope: '0', surfaceFactor: '2', surfaceSource: 'Synthetic surface', slopeAddend: '25', slopeSource: 'Synthetic slope' })
      const index = operation === 'takeoff' ? 0 : 1
      const first = corrected(step, index)
      if (first.status !== 'applied') throw new Error('expected result')
      input.groundOrder = 'slope-first'
      const second = corrected(step, index)
      if (second.status !== 'applied') throw new Error('expected result')
      const distance = (value: string) => Number.parseFloat(value.replaceAll(',', ''))
      expect(distance(second.rows[0]!.corrected) - distance(first.rows[0]!.corrected)).toBe(25)
      expect(distance(second.rows[1]!.corrected) - distance(first.rows[1]!.corrected)).toBe(25)
      expect(second.partial).toBe(true)
      expect(second.notes.join(' ')).toContain('slope then surface')
    })
    effect.stop()
  })

  it.each(['takeoff', 'landing'] as const)('honours pilot wind correction order for %s', (operation) => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup()
      const input = step.corrections[operation]
      Object.assign(input, { headwind: '5', slope: '0', windFactor: '0.5', windSource: 'Synthetic wind', slopeAddend: '40', slopeSource: 'Synthetic slope' })
      const index = operation === 'takeoff' ? 0 : 1
      const after = corrected(step, index)
      input.windOrder = 'before-ground'
      const before = corrected(step, index)
      if (after.status !== 'applied' || before.status !== 'applied') throw new Error('expected result')
      const distance = (value: string) => Number.parseFloat(value.replaceAll(',', ''))
      // Wind scales both distances; the ground addend then adds to ground roll only, so order shifts the result by 20 m.
      expect(distance(before.rows[0]!.corrected) - distance(after.rows[0]!.corrected)).toBe(20)
      expect(distance(before.rows[1]!.corrected) - distance(after.rows[1]!.corrected)).toBe(20)
      expect(before.partial).toBe(true)
      expect(before.notes.join(' ')).toContain('before the pilot-entered ground corrections')
    })
    effect.stop()
  })

  it.each(['takeoff', 'landing'] as const)('replaces the surface rule on ground roll only for %s and invalidates it', (operation) => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup(undefined, 'unpaved')
      Object.assign(step.corrections[operation], { headwind: '0', slope: '0', surfaceFactor: '1', surfaceSource: 'Synthetic manual section 2' })
      const index = operation === 'takeoff' ? 0 : 1
      const baseline = corrected(step, index)
      if (baseline.status !== 'applied') throw new Error('expected result')
      step.corrections[operation].surfaceFactor = '1.5'
      const result = corrected(step, index)
      if (result.status !== 'applied') throw new Error('expected result')
      const number = (value: string) => Number.parseFloat(value.replaceAll(',', ''))
      const delta = number(result.rows[0]!.corrected) - number(baseline.rows[0]!.corrected)
      expect(number(result.rows[1]!.corrected) - number(baseline.rows[1]!.corrected)).toBe(delta)
      expect(result.partial).toBe(true)
      expect(result.comparison.margin).toBe('Not available')
      expect(result.notes.join(' ')).toContain('Synthetic manual section 2')
      for (const invalid of ['0', '-1', 'Infinity', 'abc']) {
        step.corrections[operation].surfaceFactor = invalid
        expect(corrected(step, index).status).toBe('unavailable')
      }
      step.corrections[operation].surfaceFactor = '1.5'
      runway.draft.tora = '999'
      expect(step.corrections[operation].surfaceFactor).toBe('')
      expect(step.corrections[operation].surfaceSource).toBe('')
    })
    effect.stop()
  })

  it.each(['takeoff', 'landing'] as const)('applies a manual additive surface correction for %s', (operation) => {
    const { step, runway } = setup(undefined, 'unpaved')
    const input = step.corrections[operation]
    const index = operation === 'takeoff' ? 0 : 1
    Object.assign(input, { headwind: '0', slope: '0', surfaceFactor: '1', surfaceSource: 'Synthetic section' })
    const baseline = corrected(step, index)
    if (baseline.status !== 'applied') throw new Error('expected result')
    input.surfaceFactor = ''
    input.surfaceAddend = '25'
    const result = corrected(step, index)
    if (result.status !== 'applied') throw new Error('expected result')
    for (let i = 0; i < 2; i++) expect(Number.parseFloat(result.rows[i]!.corrected.replaceAll(',', ''))).toBe(Number.parseFloat(baseline.rows[i]!.corrected.replaceAll(',', '')) + 25)
    expect(result.rows[0]!.corrected).toContain('UNVERIFIED PILOT-ENTERED SURFACE ADDEND')
    expect(result.notes.join(' ')).toContain('Synthetic section')
    expect(result.partial).toBe(true)
    expect(result.comparison.margin).toBe('Not available')
    input.surfaceFactor = '1'
    expect(corrected(step, index).status).toBe('unavailable')
    input.surfaceFactor = ''
    for (const invalid of ['abc', '-99999']) {
      input.surfaceAddend = invalid
      expect(corrected(step, index).status).toBe('unavailable')
    }
    input.surfaceAddend = '25'
    input.surfaceSource = ''
    expect(corrected(step, index).status).toBe('unavailable')
    runway.draft.tora = '999'
    expect(input.surfaceAddend).toBe('')
  })

  it.each(['D-OTHER', 'D-EBPN'])('replaces takeoff slope for %s without changing the airborne segment', (registration) => {
    const { step } = setup(registration)
    const input = step.corrections.takeoff
    Object.assign(input, { headwind: '0', slope: '2', slopeFactor: '1', slopeSource: 'Synthetic section' })
    const baseline = corrected(step, 0)
    if (baseline.status !== 'applied') throw new Error('expected result')
    input.slopeFactor = ''
    input.slopeAddend = '25'
    const result = corrected(step, 0)
    if (result.status !== 'applied') throw new Error('expected result')
    for (let i = 0; i < 2; i++) expect(Number.parseFloat(result.rows[i]!.corrected.replaceAll(',', ''))).toBe(Number.parseFloat(baseline.rows[i]!.corrected.replaceAll(',', '')) + 25)
    expect(result.partial).toBe(true)
    expect(result.comparison.margin).toBe('Not available')
    expect(result.notes.join(' ')).toContain('Synthetic section')
    input.slopeFactor = '1'
    expect(corrected(step, 0).status).toBe('unavailable')
    input.slopeFactor = ''
    input.slopeSource = ''
    expect(corrected(step, 0).status).toBe('unavailable')
    input.slope = '3'
    expect(input.slopeAddend).toBe('')
  })

  it('applies a manual landing slope factor only to ground roll and clears it on condition changes', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup('D-OTHER')
      Object.assign(step.corrections.landing, { headwind: '0', slope: '-2' })
      const before = corrected(step, 1)
      if (before.status !== 'applied') throw new Error('expected result')
      step.corrections.landing.slopeFactor = '1.2'
      expect(corrected(step, 1).status).toBe('unavailable')
      step.corrections.landing.slopeSource = 'Synthetic manual section 2'
      const after = corrected(step, 1)
      if (after.status !== 'applied') throw new Error('expected result')
      const roll = Number.parseFloat(before.rows[0]!.corrected.replaceAll(',', ''))
      const total = Number.parseFloat(before.rows[1]!.corrected.replaceAll(',', ''))
      expect(after.rows[0]!.corrected).toContain(`${Math.ceil(roll * 1.2)} m`)
      expect(after.rows[1]!.corrected).toContain(`${Math.ceil(total + roll * 0.2)} m`)
      expect(after.notes.join(' ')).toContain('Synthetic manual section 2')
      expect(after.partial).toBe(true)
      expect(after.comparison.margin).toBe('Not available')
      step.corrections.landing.slope = '-3'
      expect(step.corrections.landing.slopeFactor).toBe('')
      expect(step.corrections.landing.slopeSource).toBe('')
    })
    effect.stop()
  })
  it('applies an additive landing slope correction only to ground roll and rejects invalid inputs', () => {
    const { step } = setup()
    const input = step.corrections.landing
    Object.assign(input, { headwind: '0', slope: '-2', slopeFactor: '1', slopeSource: 'Synthetic section' })
    const baseline = corrected(step, 1)
    if (baseline.status !== 'applied') throw new Error('expected result')
    input.slopeFactor = ''
    input.slopeAddend = '25'
    const result = corrected(step, 1)
    if (result.status !== 'applied') throw new Error('expected result')
    for (let i = 0; i < 2; i++) expect(Number.parseFloat(result.rows[i]!.corrected.replaceAll(',', ''))).toBe(Number.parseFloat(baseline.rows[i]!.corrected.replaceAll(',', '')) + 25)
    expect(result.notes.join(' ')).toContain('Synthetic section')
    expect(result.partial).toBe(true)
    expect(result.comparison.margin).toBe('Not available')
    input.slopeFactor = '1'
    expect(corrected(step, 1).status).toBe('unavailable')
    input.slopeFactor = ''
    input.slopeAddend = '-99999'
    expect(corrected(step, 1).status).toBe('unavailable')
    input.slopeAddend = 'abc'
    expect(corrected(step, 1).status).toBe('unavailable')
    input.slopeAddend = '25'
    input.slopeSource = ''
    expect(corrected(step, 1).status).toBe('unavailable')
    input.slope = '-3'
    expect(input.slopeAddend).toBe('')
  })

  it.each(['takeoff', 'landing'] as const)('applies a pilot-entered whole-distance wind multiplier for %s and clears it on changed conditions', (operation) => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup('D-OTHER')
      Object.assign(step.corrections[operation], { headwind: '-5', slope: '0' })
      const index = operation === 'takeoff' ? 0 : 1
      const before = corrected(step, index)
      if (before.status !== 'applied') throw new Error('expected result')
      step.corrections[operation].windFactor = '1.2'
      expect(corrected(step, index).status).toBe('unavailable')
      step.corrections[operation].windSource = 'Synthetic manual, section 1'
      const after = corrected(step, index)
      if (after.status !== 'applied') throw new Error('expected result')
      expect(after.rows.map(row => row.corrected)).toEqual(before.rows.map(row => `${Math.ceil(Number.parseFloat(row.corrected.replaceAll(',', '')) * 1.2)} m [UNVERIFIED PILOT-ENTERED WIND FACTOR]`))
      expect(after.notes.join(' ')).toContain('Synthetic manual, section 1')
      expect(after.partial).toBe(true)
      expect(after.comparison.margin).toBe('Not available')
      step.corrections[operation].headwind = '-6'
      expect(step.corrections[operation].windFactor).toBe('')
      expect(step.corrections[operation].windSource).toBe('')
    })
    effect.stop()
  })

  it.each(['takeoff', 'landing'] as const)('applies an additive wind correction for %s and invalidates it', (operation) => {
    const { step } = setup()
    const input = step.corrections[operation]
    Object.assign(input, { headwind: '-2', slope: '0', windFactor: '1', windSource: 'Synthetic section' })
    const index = operation === 'takeoff' ? 0 : 1
    const baseline = corrected(step, index)
    if (baseline.status !== 'applied') throw new Error('expected result')
    input.windFactor = ''
    input.windAddend = '25'
    const result = corrected(step, index)
    if (result.status !== 'applied') throw new Error('expected result')
    for (let i = 0; i < 2; i++) {
      expect(Number.parseFloat(result.rows[i]!.corrected.replaceAll(',', ''))).toBe(Number.parseFloat(baseline.rows[i]!.corrected.replaceAll(',', '')) + 25)
    }
    expect(result.notes.join(' ')).toContain('Synthetic section')
    expect(result.partial).toBe(true)
    expect(result.comparison.margin).toBe('Not available')
    input.windFactor = '1'
    expect(corrected(step, index).status).toBe('unavailable')
    input.windFactor = ''
    input.windAddend = '-99999'
    expect(corrected(step, index).status).toBe('unavailable')
    input.headwind = '-3'
    expect(input.windAddend).toBe('')
    expect(input.windSource).toBe('')
  })

  it('replaces the built-in wind rule without applying it twice', () => {
    const { step } = setup()
    Object.assign(step.corrections.takeoff, { headwind: '-2', slope: '0', windFactor: '1', windSource: 'Synthetic section' })
    const withManualWind = corrected(step, 0)
    if (withManualWind.status !== 'applied') throw new Error('expected result')
    expect(withManualWind.rows[0]!.corrected).toBe('198 m [UNVERIFIED PILOT-ENTERED WIND FACTOR]')
    expect(withManualWind.safetyFactor).toContain('1.10')
    expect(withManualWind.partial).toBe(true)
  })

  it('replaces the built-in landing slope rule without applying it twice', () => {
    const { step } = setup()
    Object.assign(step.corrections.landing, { headwind: '0', slope: '-2', slopeFactor: '1', slopeSource: 'Synthetic section' })
    const result = corrected(step, 1)
    if (result.status !== 'applied') throw new Error('expected result')
    expect(result.rows[0]!.corrected).toBe('378 m [UNVERIFIED PILOT-ENTERED SLOPE FACTOR]')
    expect(result.partial).toBe(true)
  })

  it('clears the manual selection when the profile changes', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, context } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      expect(corrected(step, 0).status).toBe('applied')
      context.profile = s9Profile('D-OTHER')
      expect(step.manualConfiguration.value).toBe('')
      expect(corrected(step, 0)).toMatchObject({ status: 'applied', partial: true, source: 'No applicable wind, surface or slope correction source' })
    })
    effect.stop()
  })

  it('stays uncorrected until wind and slope are entered; empty is never zero', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step } = setup()
      expect(corrected(step, 0)).toMatchObject({ operation: 'takeoff', status: 'unavailable' })
      expect((corrected(step, 0) as { reason: string }).reason).toContain('headwind component')
      expect((corrected(step, 0) as { reason: string }).reason).toContain('runway slope')
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
      if (item.status !== 'applied') throw new Error('expected partial result')
      expect(item.partial).toBe(true)
      expect(item.notes.join(' ')).toContain('Wind component -5 kt was not applied')
      expect(item.notes.join(' ')).toContain('Runway slope 2 % was not applied')
      expect(item.notes.join(' ')).toContain('surface')
      expect(item.comparison.margin).toBe('Not available')
      const initial = item.rows[0]!.factored
      step.safetyFactors[operation].preset = 'custom'
      step.safetyFactors[operation].custom = '2'
      const updated = corrected(step, operation === 'takeoff' ? 0 : 1)
      if (updated.status !== 'applied') throw new Error('expected partial result')
      expect(updated.rows[0]!.factored).not.toBe(initial)
      expect(updated.rows[0]!.factored).toBe(`${operation === 'takeoff' ? 440 : 840} m`)
    })
    effect.stop()
  })

  it('identifies zero and invalid entries when the correction source is unavailable', () => {
    const { step } = setup('D-OTHER')
    Object.assign(step.corrections.landing, { headwind: '0', slope: 'abc' })
    const item = corrected(step, 1)
    if (item.status !== 'unavailable') throw new Error('expected unavailable')
    expect(item.reason).toContain('Wind component 0 kt was not applied')
    expect(item.reason).toContain('Runway slope abc % was not applied')
  })

  it.each(['takeoff', 'landing'] as const)('applies available manual corrections with missing surface for %s', (operation) => {
    const { step, runway } = setup()
    runway.draft.surfaceCondition = 'wet'; runway.save()
    Object.assign(step.corrections[operation], { headwind: '-2', slope: operation === 'takeoff' ? '1' : '-1' })
    const item = corrected(step, operation === 'takeoff' ? 0 : 1)
    if (item.status !== 'applied') throw new Error('expected partial result')
    expect(item.partial).toBe(true)
    expect(item.notes.join(' ')).toContain('no applicable correction applied for surface')
    expect(item.comparison.margin).toBe('Not available')
    const roll = operation === 'takeoff' ? 220 * 1.07 + 30 : 420 * 1.03 + 26
    expect(item.rows[0]!.corrected).toBe(`${Math.ceil(roll)} m`)
    expect(item.rows[0]!.factored).toBe(`${Math.ceil(roll * (operation === 'takeoff' ? 1.1 : 1.67))} m`)
  })

  it.each([['takeoff', '-1'], ['landing', '1']] as const)('marks favourable %s inputs partially corrected', (operation, slope) => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      Object.assign(step.corrections[operation], { headwind: '5', slope })
      const item = corrected(step, operation === 'takeoff' ? 0 : 1)
      if (item.status !== 'applied') throw new Error('expected applied')
      expect(item.partial).toBe(true)
      expect(item.comparison.summary).toContain('Comparison uses partially corrected distances')
      expect(item.comparison.status).toBe('unavailable')
      expect(item.comparison.margin).toBe('Not available')
      expect(item.comparison.summary).not.toContain('fits the declared')
      expect(item.comparison.summary).toContain('Do not use this comparison for runway assessment')
      expect(item.notes.join(' ')).toContain('Wind component 5 kt was not applied')
      expect(item.notes.join(' ')).toContain(`Runway slope ${slope} % was not applied`)
      Object.assign(runway.draft, { tora: '100', lda: '100' }); runway.save()
      const short = corrected(step, operation === 'takeoff' ? 0 : 1)
      if (short.status !== 'applied') throw new Error('expected applied')
      expect(short.comparison.status).toBe('insufficient')
      expect(short.comparison.margin).toBe('Not available')
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

  describe('FSM 3/75 estimate without an aircraft manual rule set', () => {
    // Synthetic profile outside every manual scope; arithmetic wiring only.
    function fsmSetup(surface: 'paved' | 'unpaved' = 'unpaved', condition = 'dry-short-grass') {
      const { step, runway, context } = setup('D-TEST', surface)
      context.profile = { ...testPohAircraft(), registration: 'D-TEST' }
      Object.assign(runway.draft, { surfaceType: surface, surfaceCondition: condition }); runway.save()
      return { step, runway, context }
    }

    it('estimates take-off slope and grass on the ground roll, marked ESTIMATED', () => {
      const effect = effectScope()
      effect.run(() => {
        const { step } = fsmSetup()
        Object.assign(step.corrections.takeoff, { headwind: '0', slope: '2' })
        const item = corrected(step, 0)
        if (item.status !== 'applied') throw new Error('expected applied')
        // roll 220 → slope ×1.2 → grass ×1.2 → × regulatory baseline 1.25 (no manual factor).
        expect(item.rows[0]!.corrected).toBe(`${Math.ceil(220 * 1.2 * 1.2)} m ESTIMATED (FSM 3/75)`)
        expect(item.rows[0]!.factored).toBe(`${Math.ceil(220 * 1.2 * 1.2 * 1.25)} m ESTIMATED (FSM 3/75)`)
        expect(item.rows[0]!.raw).toBe('220.0 m')
        expect(item.comparison.required).toContain('ESTIMATED (FSM 3/75)')
        expect(item.partial).toBe(false)
        expect(item.comparison.summary).not.toContain('partially corrected distances')
        expect(item.safetyFactor).toContain('no manual factor')
        expect(item.notes.join(' ')).toContain('not validated by it')
        expect(item.notes.join(' ')).toContain('supplies no wind correction')
        expect(item.notes.join(' ')).toContain('can understate that surcharge')
      })
      effect.stop()
    })

    it.each(['TakeoffRoll', 'TakeoffDistance50ft'] as const)('retains extrapolated and CAA-estimated provenance with FSM when %s is missing', (phase) => {
      const effect = effectScope()
      effect.run(() => {
        const { step, runway, context } = fsmSetup()
        context.profile!.performanceProfiles = context.profile!.performanceProfiles!.filter(table => table.flightPhase !== phase)
        context.takeoff = { status: 'ready', massKg: 1050, origin: 'M&B' }
        Object.assign(step.corrections.takeoff, { headwind: '0', slope: '2' })
        Object.assign(runway.draft, { tora: '100', toda: '5000' }); runway.save()
        expect(corrected(step, 0).status).toBe('unavailable')
        step.extrapolationAcknowledged.value = true
        const item = corrected(step, 0)
        if (item.status !== 'applied') throw new Error('expected applied')
        const extrapolated = 'ESTIMATED — EXTRAPOLATED (+20 % penalty)'
        const caa = 'ESTIMATED (CAA SSL 07)'
        const fsm = 'ESTIMATED (FSM 3/75)'
        for (const row of item.rows) for (const value of [row.corrected, row.factored]) {
          expect(value).toContain(extrapolated)
          expect(value).toContain(fsm)
        }
        for (const value of [item.rows[1]!.corrected, item.rows[1]!.factored, item.comparison.required, item.comparison.margin]) {
          expect(value).toContain(extrapolated)
          expect(value).toContain(caa)
          expect(value).toContain(fsm)
        }
        for (const value of [item.rows[0]!.corrected, item.rows[0]!.factored, item.comparison.summary]) {
          expect(value.includes(caa)).toBe(phase === 'TakeoffRoll')
          expect(value).toContain(extrapolated)
          expect(value).toContain(fsm)
        }
      })
      effect.stop()
    })

    it('applies available estimates while identifying unsupported tailwind and surface', () => {
      const effect = effectScope()
      effect.run(() => {
        const { step, runway } = fsmSetup()
        Object.assign(step.corrections.landing, { headwind: '0', slope: '1' })
        const landing = corrected(step, 1)
        if (landing.status !== 'applied') throw new Error('expected partial landing result')
        expect(landing.partial).toBe(true)
        expect(landing.notes.join(' ')).toContain('Runway slope 1 % was not applied')
        Object.assign(step.corrections.takeoff, { headwind: '-3', slope: '1' })
        const tail = corrected(step, 0)
        if (tail.status !== 'applied') throw new Error('expected partial estimate')
        expect(tail.partial).toBe(true)
        expect(tail.rows[0]!.corrected).toBe(`${Math.ceil(220 * 1.1 * 1.2)} m ESTIMATED (FSM 3/75)`)
        expect(tail.notes.join(' ')).toContain('no applicable correction applied for wind')
        expect(tail.comparison.status).toBe('unavailable')
        step.corrections.takeoff.headwind = '0'
        runway.draft.surfaceCondition = 'wet-soft-ground'; runway.save()
        const surface = corrected(step, 0)
        if (surface.status !== 'applied') throw new Error('expected partial estimate')
        expect(surface.rows[0]!.corrected).toBe(`${Math.ceil(220 * 1.1)} m ESTIMATED (FSM 3/75)`)
        expect(surface.notes.join(' ')).toContain('no applicable correction applied for surface')
        expect(surface.comparison.margin).toBe('Not available')
      })
      effect.stop()
    })

    it('does not credit headwind or downhill slope and marks the result partial', () => {
      const effect = effectScope()
      effect.run(() => {
        const { step } = fsmSetup('paved', 'dry')
        Object.assign(step.corrections.takeoff, { headwind: '8', slope: '-1' })
        const item = corrected(step, 0)
        if (item.status !== 'applied') throw new Error('expected applied')
        expect(item.partial).toBe(true)
        expect(item.comparison.summary).toContain('Do not use this comparison for runway assessment')
        expect(item.rows[0]!.corrected).toBe('220 m ESTIMATED (FSM 3/75)')
        expect(item.notes.join(' ')).toContain('Headwind is not credited')
        expect(item.notes.join(' ')).toContain('Favourable slope is not credited')
      })
      effect.stop()
    })
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
    ['an unsaved runway', () => setup('D-EBPN', 'paved', false), 'Save the manual runway'],
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

  it('invalidates the comparison on a surface edit and marks an unsupported saved condition incomplete', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      expect(corrected(step, 0).status).toBe('applied')
      runway.draft.surfaceCondition = 'ice'
      expect(corrected(step, 0).status).toBe('unavailable')
      expect(runway.save()).toBe(true)
      expect(corrected(step, 0)).toMatchObject({ status: 'applied', partial: true })
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

  it('applies the landing safety factor after estimating the 50 ft distance', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, context } = setup()
      context.profile!.performanceProfiles = context.profile!.performanceProfiles!.filter(table => table.flightPhase !== 'LandingDistance50ft')
      step.manualConfiguration.value = 's9'
      Object.assign(step.corrections.landing, { headwind: '0', slope: '0' })
      const item = corrected(step, 1)
      if (item.status !== 'applied') throw new Error('expected applied')
      expect(item.rows[1]!.raw).toBe('701.4 m ESTIMATED (CAA SSL 07)')
      expect(item.rows[1]!.factored).toBe('1,102 m ESTIMATED (CAA SSL 07)')
    })
    effect.stop()
  })

  it('retains lower-axis estimate markers in corrected distances and runway comparisons', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, runway } = setup()
      step.pa.direct.value = '-1'; step.temperature.value = '-1'
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      Object.assign(runway.draft, { tora: '100', toda: '5000' }); runway.save()
      const item = corrected(step, 0)
      if (item.status !== 'applied') throw new Error('expected applied')
      const marker = 'ESTIMATED (lower-axis table boundary)'
      for (const row of item.rows) for (const value of [row.raw, row.corrected, row.factored]) expect(value).toContain(marker)
      for (const value of [item.comparison.required, item.comparison.margin, item.comparison.summary]) expect(value).toContain(marker)
    })
    effect.stop()
  })

  it('retains extrapolation markers in corrected distances and runway comparisons after acknowledgement', () => {
    const effect = effectScope()
    effect.run(() => {
      const { step, context, runway } = setup()
      context.takeoff = { status: 'ready', massKg: 1050, origin: 'M&B' }
      Object.assign(step.corrections.takeoff, { headwind: '0', slope: '0' })
      Object.assign(runway.draft, { tora: '100', toda: '5000' }); runway.save()
      expect(corrected(step, 0).status).toBe('unavailable')
      step.extrapolationAcknowledged.value = true
      const item = corrected(step, 0)
      if (item.status !== 'applied') throw new Error('expected applied')
      const marker = 'ESTIMATED — EXTRAPOLATED (+20 % penalty)'
      for (const row of item.rows) for (const value of [row.raw, row.corrected, row.factored]) expect(value).toContain(marker)
      expect(item.comparison.required).toContain(marker)
      expect(item.comparison.margin).toContain(marker)
      expect(item.comparison.summary).toContain(marker)
      step.temperature.value = '11'
      expect(corrected(step, 0).status).toBe('unavailable')
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
