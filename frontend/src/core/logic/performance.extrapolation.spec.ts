/**
 * Unit tests for the conservative extrapolation-control layer.
 *
 * @see performance.extrapolation.ts
 */

// @UT-PF-CORE-042@ (FROM: @IMP-PF-CORE-006@, @IMP-PF-CORE-007@, @IMP-PF-CORE-008@, @IMP-PF-CORE-009@, @IMP-PF-CORE-010@, @IMP-PF-CORE-011@)
import { describe, it, expect } from 'vitest'
import type { PohDistanceConditions } from './performance.poh-distance'
import type { PerformanceCube3D } from './performance.poh-distance'
import {
  EXTRAPOLATION_CAP_FRACTION,
  EXTRAPOLATION_PENALTY_FRACTION,
  EXTRAPOLATION_LIMITS,
  classifyAxisExcursion,
  assessExtrapolation,
  applyExtrapolationPenalty,
  cubeEnvelopeRanges,
  resolveExtrapolatedDistance,
  type EnvelopeRanges,
} from './performance.extrapolation'

// POH envelope mirroring UJ-C-001 (50 °C / 10,000 ft maxima).
const RANGES: EnvelopeRanges = {
  mass: { min: 850, max: 1157 },
  pressureAltitude: { min: 0, max: 10_000 },
  temperature: { min: -20, max: 50 },
}

const WITHIN: PohDistanceConditions = { mass: 1000, pressureAltitude: 5000, temperature: 20 }

function conditions(over: Partial<PohDistanceConditions>): PohDistanceConditions {
  return { ...WITHIN, ...over }
}

describe('extrapolation constants', () => {
  it('fixes the cap at 10% and the penalty at 20%', () => {
    expect(EXTRAPOLATION_CAP_FRACTION).toBe(0.1)
    expect(EXTRAPOLATION_PENALTY_FRACTION).toBe(0.2)
    expect(EXTRAPOLATION_LIMITS).toEqual({ capFraction: 0.1, penaltyFraction: 0.2 })
  })

  it('is frozen so it cannot be made user-configurable at runtime', () => {
    expect(Object.isFrozen(EXTRAPOLATION_LIMITS)).toBe(true)
    expect(() => {
      ;(EXTRAPOLATION_LIMITS as { capFraction: number }).capFraction = 0.5
    }).toThrow(TypeError)
    expect(EXTRAPOLATION_LIMITS.capFraction).toBe(0.1)
  })
})

describe('classifyAxisExcursion', () => {
  it('reports "within" at and inside both boundaries', () => {
    expect(classifyAxisExcursion(0, { min: 0, max: 10 }).direction).toBe('within')
    expect(classifyAxisExcursion(10, { min: 0, max: 10 }).direction).toBe('within')
    expect(classifyAxisExcursion(5, { min: 0, max: 10 }).direction).toBe('within')
  })

  it('reports "better" below the minimum (benefit direction)', () => {
    const e = classifyAxisExcursion(-1, { min: 0, max: 10 })
    expect(e.direction).toBe('better')
    expect(e.beyondCap).toBe(false)
    expect(e.worseFraction).toBe(0)
  })

  it('reports "worse" within the 10% cap', () => {
    const e = classifyAxisExcursion(11_000, { min: 0, max: 10_000 })
    expect(e.direction).toBe('worse')
    expect(e.worseFraction).toBeCloseTo(0.1, 10)
    expect(e.beyondCap).toBe(false)
  })

  it('treats exactly the 10% boundary as within the cap', () => {
    expect(classifyAxisExcursion(55, { min: -20, max: 50 }).beyondCap).toBe(false)
  })

  it('reports "worse" beyond the cap', () => {
    const e = classifyAxisExcursion(11_100, { min: 0, max: 10_000 })
    expect(e.direction).toBe('worse')
    expect(e.worseFraction).toBeCloseTo(0.11, 10)
    expect(e.beyondCap).toBe(true)
  })

  it('blocks any excursion above a non-positive maximum', () => {
    const e = classifyAxisExcursion(5, { min: -10, max: 0 })
    expect(e.direction).toBe('worse')
    expect(e.worseFraction).toBe(Number.POSITIVE_INFINITY)
    expect(e.beyondCap).toBe(true)
  })

  it('throws on a non-finite value', () => {
    expect(() => classifyAxisExcursion(Number.NaN, { min: 0, max: 10 })).toThrow(/finite/)
    expect(() => classifyAxisExcursion(Number.POSITIVE_INFINITY, { min: 0, max: 10 })).toThrow(/finite/)
  })

  it('throws on non-finite range bounds', () => {
    expect(() => classifyAxisExcursion(5, { min: Number.NaN, max: 10 })).toThrow(/finite/)
    expect(() => classifyAxisExcursion(5, { min: 0, max: Number.POSITIVE_INFINITY })).toThrow(/finite/)
  })

  it('throws when min exceeds max', () => {
    expect(() => classifyAxisExcursion(5, { min: 10, max: 0 })).toThrow(/min.*max/)
  })
})

describe('assessExtrapolation', () => {
  it('is within the envelope when every axis is in range', () => {
    const a = assessExtrapolation(WITHIN, RANGES)
    expect(a.state).toBe('within_envelope')
    expect(a.requiresAcknowledgment).toBe(false)
    expect(a.benefitCapped).toBe(false)
    expect(a.penaltyFactor).toBe(1)
  })

  it('marks extrapolated + acknowledgment when one axis is worse within cap', () => {
    const a = assessExtrapolation(conditions({ temperature: 54 }), RANGES)
    expect(a.state).toBe('extrapolated')
    expect(a.requiresAcknowledgment).toBe(true)
    expect(a.penaltyFactor).toBe(1.2)
  })

  it('blocks when any axis is beyond the cap', () => {
    const a = assessExtrapolation(conditions({ pressureAltitude: 11_100 }), RANGES)
    expect(a.state).toBe('blocked')
    expect(a.requiresAcknowledgment).toBe(false)
  })

  it('beyond-cap on one axis dominates worse-within-cap on another', () => {
    const a = assessExtrapolation(conditions({ temperature: 54, pressureAltitude: 11_100 }), RANGES)
    expect(a.state).toBe('blocked')
  })

  it('flags benefitCapped for a below-minimum axis without requiring acknowledgment', () => {
    const a = assessExtrapolation(conditions({ temperature: -40 }), RANGES)
    expect(a.state).toBe('within_envelope')
    expect(a.benefitCapped).toBe(true)
    expect(a.requiresAcknowledgment).toBe(false)
    expect(a.penaltyFactor).toBe(1)
  })

  it('combines extrapolation on one axis with benefit capping on another', () => {
    const a = assessExtrapolation(conditions({ temperature: 54, mass: 800 }), RANGES)
    expect(a.state).toBe('extrapolated')
    expect(a.benefitCapped).toBe(true)
    expect(a.requiresAcknowledgment).toBe(true)
  })

  it('detects a worse excursion independently on each axis', () => {
    expect(assessExtrapolation(conditions({ mass: 2000 }), RANGES).state).toBe('blocked')
    expect(assessExtrapolation(conditions({ mass: 1200 }), RANGES).state).toBe('extrapolated')
    expect(assessExtrapolation(conditions({ pressureAltitude: 10_500 }), RANGES).state).toBe('extrapolated')
    expect(assessExtrapolation(conditions({ temperature: 52 }), RANGES).state).toBe('extrapolated')
  })
})

describe('applyExtrapolationPenalty', () => {
  it('leaves a within-envelope distance unchanged', () => {
    const a = assessExtrapolation(WITHIN, RANGES)
    expect(applyExtrapolationPenalty(1000, a)).toBe(1000)
  })

  it('applies the +20% penalty to an extrapolated distance', () => {
    const a = assessExtrapolation(conditions({ temperature: 54 }), RANGES)
    expect(applyExtrapolationPenalty(1000, a)).toBeCloseTo(1200, 10)
  })

  it('never returns a distance shorter than the base (Minimum Distance Rule)', () => {
    const a = assessExtrapolation(conditions({ temperature: -40 }), RANGES)
    expect(applyExtrapolationPenalty(1000, a)).toBeGreaterThanOrEqual(1000)
  })

  it('throws on a non-finite base distance', () => {
    const a = assessExtrapolation(WITHIN, RANGES)
    expect(() => applyExtrapolationPenalty(Number.NaN, a)).toThrow(/finite/)
  })
})

describe('cubeEnvelopeRanges', () => {
  it('derives min/max ranges from a performance cube', () => {
    const cube: PerformanceCube3D = {
      massAxis: [850, 1000, 1157],
      altitudeAxis: [0, 5000, 10_000],
      temperatureAxis: [-20, 0, 50],
      values: [[[0]]],
    }
    expect(cubeEnvelopeRanges(cube)).toEqual(RANGES)
  })
})

describe('resolveExtrapolatedDistance', () => {
  it('passes a within-envelope point through unchanged', () => {
    const r = resolveExtrapolatedDistance(1000, WITHIN, RANGES)
    expect(r.state).toBe('within_envelope')
    if (r.state === 'blocked') throw new Error('unexpected block')
    expect(r.distance).toBe(1000)
    expect(r.requiresAcknowledgment).toBe(false)
    expect(r.benefitCapped).toBe(false)
  })

  it('penalises and flags acknowledgment for a within-cap extrapolation', () => {
    const r = resolveExtrapolatedDistance(1000, conditions({ temperature: 54 }), RANGES)
    expect(r.state).toBe('extrapolated')
    if (r.state === 'blocked') throw new Error('unexpected block')
    expect(r.distance).toBeCloseTo(1200, 10)
    expect(r.requiresAcknowledgment).toBe(true)
  })

  it('floors a benefit excursion at the best-case POH distance', () => {
    const r = resolveExtrapolatedDistance(1000, conditions({ temperature: -40 }), RANGES)
    expect(r.state).toBe('within_envelope')
    if (r.state === 'blocked') throw new Error('unexpected block')
    expect(r.distance).toBe(1000)
    expect(r.benefitCapped).toBe(true)
    expect(r.requiresAcknowledgment).toBe(false)
  })

  it('blocks beyond the cap and carries no distance', () => {
    const r = resolveExtrapolatedDistance(1000, conditions({ pressureAltitude: 11_100 }), RANGES)
    expect(r.state).toBe('blocked')
    if (r.state !== 'blocked') throw new Error('expected block')
    expect(r.reason).toBe('extrapolation_exceeds_cap')
    expect(r.message).toContain('10%')
    expect(r.assessment).not.toBeNull()
    expect('distance' in r).toBe(false)
  })

  it('blocks with invalid_input on a non-finite base distance', () => {
    const r = resolveExtrapolatedDistance(Number.NaN, WITHIN, RANGES)
    expect(r.state).toBe('blocked')
    if (r.state !== 'blocked') throw new Error('expected block')
    expect(r.reason).toBe('invalid_input')
    expect(r.assessment).toBeNull()
  })

  it('blocks with invalid_input on a non-finite condition', () => {
    const r = resolveExtrapolatedDistance(1000, conditions({ mass: Number.POSITIVE_INFINITY }), RANGES)
    expect(r.state).toBe('blocked')
    if (r.state !== 'blocked') throw new Error('expected block')
    expect(r.reason).toBe('invalid_input')
  })

  it('blocks with invalid_input when a range is structurally invalid', () => {
    const badRanges: EnvelopeRanges = { ...RANGES, mass: { min: 2000, max: 1000 } }
    const r = resolveExtrapolatedDistance(1000, WITHIN, badRanges)
    expect(r.state).toBe('blocked')
    if (r.state !== 'blocked') throw new Error('expected block')
    expect(r.reason).toBe('invalid_input')
    expect(r.assessment).toBeNull()
  })
})
