// @UT-PF-CORE-046@ (FROM: @IMP-PF-CORE-025@, @IMP-PF-CORE-026@)

import { describe, it, expect } from 'vitest'
import { applyEstimation, EstimationInputSchema } from './performance.estimation.adapter'

describe('applyEstimation — happy path', () => {
  it('estimates a missing 50 ft distance from validated input', () => {
    const result = applyEstimation({ takeoffRoll: 300, landingRoll: 200 })
    expect(result.status).toBe('success')
    if (result.status !== 'success') throw new Error('expected success')
    expect(result.anyEstimated).toBe(true)
    expect(result.distances.takeoffDistance50ft.provenance).toBe('estimated')
    expect(result.distances.takeoffDistance50ft.value).toBeCloseTo(570, 10)
  })

  it('passes fully-published POH data through unestimated', () => {
    const result = applyEstimation({
      takeoffRoll: 300,
      takeoffDistance50ft: 600,
      landingRoll: 250,
      landingDistance50ft: 450,
    })
    expect(result.status).toBe('success')
    if (result.status !== 'success') throw new Error('expected success')
    expect(result.anyEstimated).toBe(false)
  })
})

describe('applyEstimation — Zod boundary rejects unsafe input (never throws)', () => {
  it.each([
    ['null', null],
    ['a string', 'TOR=300'],
    ['a non-finite distance', { takeoffRoll: Number.POSITIVE_INFINITY, landingRoll: 200 }],
    ['a NaN distance', { takeoffRoll: Number.NaN, landingRoll: 200 }],
    ['a zero distance', { takeoffRoll: 0, landingRoll: 200 }],
    ['a negative distance', { takeoffRoll: -5, landingRoll: 200 }],
    ['an absurdly large distance', { takeoffRoll: 1_000_000, landingRoll: 200 }],
    ['a non-numeric field', { takeoffRoll: '300', landingRoll: 200 }],
  ])('returns invalid_input for %s', (_label, input) => {
    const result = applyEstimation(input)
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') throw new Error('expected failure')
    expect(result.reason).toBe('invalid_input')
  })
})

describe('EstimationInputSchema', () => {
  it('accepts an empty object (all gaps) — resolution failure is decided downstream, not at the schema', () => {
    expect(EstimationInputSchema.safeParse({}).success).toBe(true)
  })
})
