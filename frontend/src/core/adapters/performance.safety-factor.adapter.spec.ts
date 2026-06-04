/**
 * Unit tests for the safety-factor Zod boundary — validation rejects
 * unsafe/non-finite input (REQ-SYS-011) and surfaces INVALID_INPUT
 * (ERR-SYS-001, REQ-SYS-012); valid input delegates to the pure pipeline.
 *
 * @see performance.safety-factor.adapter.ts
 */

// @UT-PF-CORE-043@ (FROM: @IMP-PF-CORE-013@, @IMP-PF-CORE-014@)

import { describe, it, expect } from 'vitest'
import { applySafetyFactors } from './performance.safety-factor.adapter'
import { computeSafetyFactorPipeline } from '../logic/performance.safety-factor'
import type { SafetyFactorInput } from '../domain/performance.math-types'

const VALID = {
  base: { takeoffRoll: 300, takeoffDistance50ft: 600, landingRoll: 200, landingDistance50ft: 400 },
  factors: { friction: 1, slope: 1, densityAltitude: 1, wind: 1 },
  osf: { preset: 'easa-standard' as const },
  available: { takeoff: 1000, landing: 1000 },
}

function expectInvalid(input: unknown): void {
  const r = applySafetyFactors(input)
  expect(r.status).toBe('failure')
  expect(r.violations).toEqual([
    { type: 'INVALID_INPUT', notificationId: 'ERR-SYS-001', severity: 'ERROR', blocking: false },
  ])
}

describe('applySafetyFactors — valid input', () => {
  it('delegates to the pure pipeline and returns its success result', () => {
    const r = applySafetyFactors(VALID)
    expect(r.status).toBe('success')
    expect(r).toEqual(computeSafetyFactorPipeline(VALID as SafetyFactorInput))
  })

  it('accepts custom OSF at the inclusive [1.00, 3.00] bounds', () => {
    expect(applySafetyFactors({ ...VALID, osf: { preset: 'custom', customMultiplier: 1.0 } }).status).toBe('success')
    expect(applySafetyFactors({ ...VALID, osf: { preset: 'custom', customMultiplier: 3.0 } }).status).toBe('success')
  })

  it('accepts a poh-afm preset with mandated factors', () => {
    expect(
      applySafetyFactors({ ...VALID, osf: { preset: 'poh-afm', pohMandatedFactor: { takeoff: 1.3, landing: 1.5 } } }).status,
    ).toBe('success')
  })

  it('accepts every named OSF preset through the boundary', () => {
    for (const preset of ['easa-standard', 'short-field', 'poh-afm'] as const) {
      expect(applySafetyFactors({ ...VALID, osf: { preset } }).status).toBe('success')
    }
  })
})

describe('applySafetyFactors — rejects non-finite values', () => {
  it('rejects Infinity in a base distance', () => {
    expectInvalid({ ...VALID, base: { ...VALID.base, takeoffRoll: Infinity } })
  })

  it('rejects NaN in a correction factor', () => {
    expectInvalid({ ...VALID, factors: { ...VALID.factors, wind: Number.NaN } })
  })

  it('rejects Infinity in an available distance', () => {
    expectInvalid({ ...VALID, available: { ...VALID.available, landing: Infinity } })
  })
})

describe('applySafetyFactors — rejects out-of-domain values', () => {
  it('rejects a zero correction factor (optimistic-unsafe)', () => {
    expectInvalid({ ...VALID, factors: { ...VALID.factors, friction: 0 } })
  })

  it('rejects a negative correction factor', () => {
    expectInvalid({ ...VALID, factors: { ...VALID.factors, slope: -1 } })
  })

  it('rejects a negative distance', () => {
    expectInvalid({ ...VALID, base: { ...VALID.base, landingRoll: -10 } })
  })

  it('rejects an absurdly large distance', () => {
    expectInvalid({ ...VALID, available: { ...VALID.available, takeoff: 100_001 } })
  })

  it('rejects an absurdly large factor', () => {
    expectInvalid({ ...VALID, factors: { ...VALID.factors, densityAltitude: 101 } })
  })

  it('rejects a non-positive POH-mandated factor', () => {
    expectInvalid({ ...VALID, osf: { preset: 'poh-afm', pohMandatedFactor: { takeoff: 0 } } })
  })
})

describe('applySafetyFactors — rejects malformed OSF and structure', () => {
  it('rejects a custom preset with no multiplier', () => {
    expectInvalid({ ...VALID, osf: { preset: 'custom' } })
  })

  it('rejects a custom multiplier below 1.00', () => {
    expectInvalid({ ...VALID, osf: { preset: 'custom', customMultiplier: 0.5 } })
  })

  it('rejects a custom multiplier above 3.00', () => {
    expectInvalid({ ...VALID, osf: { preset: 'custom', customMultiplier: 3.5 } })
  })

  it('rejects an unknown preset', () => {
    expectInvalid({ ...VALID, osf: { preset: 'no-such-preset' } })
  })

  it('rejects a missing required section', () => {
    const { available: _omit, ...withoutAvailable } = VALID
    expectInvalid(withoutAvailable)
  })

  it('rejects non-object input', () => {
    expectInvalid(null)
    expectInvalid('not-an-object')
  })
})
