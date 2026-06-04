/**
 * Unit tests for the performance safety-factor pipeline — correction isolation
 * (REQ-PF-004), OSF presets (REQ-PF-006), safety margin (REQ-PF-007), and
 * CRIT-PF-002 / WARN-PF-002 emission (REQ-PF-015 / REQ-PF-016).
 *
 * @see performance.safety-factor.ts
 * @see docs/architecture/performance-safety-factor-pipeline.md
 */

// @UT-PF-CORE-043@ (FROM: @IMP-PF-CORE-012@, @IMP-PF-CORE-013@, @IMP-PF-CORE-014@, @IMP-PF-CORE-015@, @IMP-PF-CORE-016@, @IMP-PF-CORE-017@, @IMP-PF-CORE-018@)

import { describe, it, expect } from 'vitest'
import {
  EASA_LANDING_FACTOR,
  EASA_TAKEOFF_FACTOR,
  SHORT_FIELD_LANDING_FACTOR,
  computeSafetyFactorPipeline,
  correctedFullDistance,
  correctedGroundRoll,
  environmentalFactor,
  groundRollFactor,
  invalidInputViolation,
  isOsfBelowMinimum,
  osfBelowMinimumViolation,
  osfThreshold,
  regulatoryBaseline,
  resolveOsf,
  runwayInsufficientViolation,
  safetyMargin,
} from './performance.safety-factor'
import type {
  PerformanceCorrectionFactors,
  SafetyFactorInput,
} from '../domain/performance.math-types'

const NEUTRAL: PerformanceCorrectionFactors = {
  friction: 1,
  slope: 1,
  densityAltitude: 1,
  wind: 1,
}

const BASE = {
  takeoffRoll: 300,
  takeoffDistance50ft: 600,
  landingRoll: 200,
  landingDistance50ft: 400,
}

function input(overrides: Partial<SafetyFactorInput> = {}): SafetyFactorInput {
  return {
    base: BASE,
    factors: NEUTRAL,
    osf: { preset: 'easa-standard' },
    available: { takeoff: 1000, landing: 1000 },
    ...overrides,
  }
}

describe('regulatoryBaseline', () => {
  it('is 1.25 for takeoff and 1.43 for landing', () => {
    expect(regulatoryBaseline('takeoff')).toBe(EASA_TAKEOFF_FACTOR)
    expect(regulatoryBaseline('landing')).toBe(EASA_LANDING_FACTOR)
    expect(EASA_TAKEOFF_FACTOR).toBe(1.25)
    expect(EASA_LANDING_FACTOR).toBe(1.43)
  })
})

describe('resolveOsf — preset resolution (REQ-PF-006)', () => {
  it('easa-standard resolves to the regulatory baselines', () => {
    expect(resolveOsf({ preset: 'easa-standard' }, 'takeoff')).toBe(1.25)
    expect(resolveOsf({ preset: 'easa-standard' }, 'landing')).toBe(1.43)
  })

  it('short-field uses 1.15 for landing and retains 1.25 for takeoff', () => {
    expect(resolveOsf({ preset: 'short-field' }, 'landing')).toBe(SHORT_FIELD_LANDING_FACTOR)
    expect(resolveOsf({ preset: 'short-field' }, 'landing')).toBe(1.15)
    expect(resolveOsf({ preset: 'short-field' }, 'takeoff')).toBe(1.25)
  })

  it('poh-afm uses the mandated factor when present', () => {
    const osf = { preset: 'poh-afm', pohMandatedFactor: { takeoff: 1.7, landing: 1.55 } } as const
    expect(resolveOsf(osf, 'takeoff')).toBe(1.7)
    expect(resolveOsf(osf, 'landing')).toBe(1.55)
  })

  it('poh-afm falls back to the baseline when no mandated factor is present', () => {
    expect(resolveOsf({ preset: 'poh-afm' }, 'takeoff')).toBe(1.25)
    expect(resolveOsf({ preset: 'poh-afm', pohMandatedFactor: {} }, 'landing')).toBe(1.43)
  })

  it('custom uses the supplied multiplier for both operations', () => {
    const osf = { preset: 'custom', customMultiplier: 1.8 } as const
    expect(resolveOsf(osf, 'takeoff')).toBe(1.8)
    expect(resolveOsf(osf, 'landing')).toBe(1.8)
  })

  it('custom falls back to the baseline when the multiplier is absent', () => {
    expect(resolveOsf({ preset: 'custom' }, 'takeoff')).toBe(1.25)
    expect(resolveOsf({ preset: 'custom' }, 'landing')).toBe(1.43)
  })
})

describe('osfThreshold + isOsfBelowMinimum (REQ-PF-016)', () => {
  it('threshold is the baseline when no POH factor is present', () => {
    expect(osfThreshold({ preset: 'easa-standard' }, 'takeoff')).toBe(1.25)
    expect(osfThreshold({ preset: 'easa-standard' }, 'landing')).toBe(1.43)
  })

  it('threshold rises to the POH factor when it exceeds the baseline', () => {
    expect(osfThreshold({ preset: 'custom', customMultiplier: 1, pohMandatedFactor: { takeoff: 1.6 } }, 'takeoff')).toBe(1.6)
  })

  it('threshold stays at the baseline when the POH factor is below it', () => {
    expect(osfThreshold({ preset: 'custom', customMultiplier: 1, pohMandatedFactor: { takeoff: 1.0 } }, 'takeoff')).toBe(1.25)
  })

  it('flags a below-minimum OSF and clears one at or above', () => {
    expect(isOsfBelowMinimum({ preset: 'custom', customMultiplier: 1.0 }, 'takeoff')).toBe(true)
    expect(isOsfBelowMinimum({ preset: 'easa-standard' }, 'takeoff')).toBe(false)
    expect(isOsfBelowMinimum({ preset: 'short-field' }, 'landing')).toBe(true)
    expect(isOsfBelowMinimum({ preset: 'easa-standard' }, 'landing')).toBe(false)
  })

  it('honours a POH factor raising the threshold above the selected custom OSF', () => {
    const osf = { preset: 'custom', customMultiplier: 1.4, pohMandatedFactor: { takeoff: 1.6 } } as const
    expect(isOsfBelowMinimum(osf, 'takeoff')).toBe(true)
    expect(isOsfBelowMinimum({ preset: 'custom', customMultiplier: 1.4 }, 'takeoff')).toBe(false)
  })
})

describe('correction factors (REQ-PF-004)', () => {
  it('combines friction × slope and densityAltitude × wind', () => {
    const f: PerformanceCorrectionFactors = { friction: 1.2, slope: 1.1, densityAltitude: 1.1, wind: 1.05 }
    expect(groundRollFactor(f)).toBeCloseTo(1.32, 10)
    expect(environmentalFactor(f)).toBeCloseTo(1.155, 10)
  })

  it('correctedGroundRoll applies g × e × osf to the whole value', () => {
    expect(correctedGroundRoll(300, NEUTRAL, 1.25)).toBe(375)
    expect(correctedGroundRoll(300, { friction: 2, slope: 1, densityAltitude: 1, wind: 1 }, 1.0)).toBe(600)
  })

  it('correctedFullDistance corrects only the ground-roll portion with friction/slope', () => {
    const corrected = correctedFullDistance(
      300,
      600,
      { friction: 2, slope: 1, densityAltitude: 1, wind: 1 },
      1.0,
    )
    expect(corrected).toBe(900)
    // The whole-variable (incorrect) reading would be 600 × 2 = 1200.
    expect(corrected).toBeLessThan(1200)
  })

  it('correctedFullDistance applies density-altitude/wind to the entire distance', () => {
    expect(
      correctedFullDistance(300, 600, { friction: 1, slope: 1, densityAltitude: 2, wind: 1 }, 1.0),
    ).toBe(1200)
  })

  it('correctedFullDistance never inverts below its own ground roll (malformed profile)', () => {
    expect(correctedFullDistance(400, 300, NEUTRAL, 1.0)).toBe(400)
  })
})

describe('safetyMargin (REQ-PF-007)', () => {
  it('computes a positive margin and percentage of the required distance', () => {
    const m = safetyMargin(1000, 750)
    expect(m.absolute).toBe(250)
    expect(m.percent).toBeCloseTo(33.3333, 3)
  })

  it('computes a negative margin when available is below required', () => {
    const m = safetyMargin(700, 750)
    expect(m.absolute).toBe(-50)
    expect(m.percent).toBeCloseTo(-6.6667, 3)
  })

  it('is exactly zero at the boundary', () => {
    const m = safetyMargin(750, 750)
    expect(m.absolute).toBe(0)
    expect(m.percent).toBe(0)
  })

  it('returns null percent for a non-positive required distance', () => {
    expect(safetyMargin(500, 0).percent).toBeNull()
    expect(safetyMargin(500, -5).percent).toBeNull()
  })
})

describe('violation builders', () => {
  it('runwayInsufficientViolation maps to a blocking CRIT-PF-002', () => {
    expect(runwayInsufficientViolation('takeoff')).toEqual({
      type: 'RUNWAY_INSUFFICIENT',
      notificationId: 'CRIT-PF-002',
      severity: 'CRITICAL',
      blocking: true,
      operation: 'takeoff',
    })
  })

  it('osfBelowMinimumViolation maps to an advisory WARN-PF-002', () => {
    expect(osfBelowMinimumViolation('landing')).toEqual({
      type: 'OSF_BELOW_MINIMUM',
      notificationId: 'WARN-PF-002',
      severity: 'WARNING',
      blocking: false,
      operation: 'landing',
    })
  })

  it('invalidInputViolation maps to ERR-SYS-001 with no operation', () => {
    expect(invalidInputViolation()).toEqual({
      type: 'INVALID_INPUT',
      notificationId: 'ERR-SYS-001',
      severity: 'ERROR',
      blocking: false,
    })
  })
})

describe('computeSafetyFactorPipeline — happy path', () => {
  it('produces operational required distances, margins, and Go with no violations', () => {
    const r = computeSafetyFactorPipeline(input())

    expect(r.status).toBe('success')
    expect(r.takeoff.appliedOsf).toBe(1.25)
    expect(r.takeoff.groundRollRequired).toBe(375)
    expect(r.takeoff.fullRequired).toBe(750)
    expect(r.takeoff.marginAbsolute).toBe(250)
    expect(r.takeoff.marginPercent).toBeCloseTo(33.3333, 3)
    expect(r.takeoff.insufficient).toBe(false)

    expect(r.landing.appliedOsf).toBe(1.43)
    expect(r.landing.groundRollRequired).toBe(286)
    expect(r.landing.fullRequired).toBe(572)
    expect(r.landing.marginAbsolute).toBe(428)
    expect(r.landing.marginPercent).toBeCloseTo(74.8252, 3)
    expect(r.landing.insufficient).toBe(false)

    expect(r.violations).toEqual([])
    expect(r.goNoGo).toBe(true)
  })

  it('composes ground-roll and full-distance factors per operation', () => {
    const r = computeSafetyFactorPipeline(
      input({
        factors: { friction: 1.2, slope: 1.1, densityAltitude: 1.1, wind: 1.05 },
        osf: { preset: 'custom', customMultiplier: 1.0 },
      }),
    )
    expect(r.takeoff.groundRollRequired).toBeCloseTo(457.38, 4)
    expect(r.takeoff.fullRequired).toBeCloseTo(803.88, 4)
  })
})

describe('computeSafetyFactorPipeline — CRIT-PF-002 (REQ-PF-015)', () => {
  it('blocks Go/No-Go when the takeoff required distance exceeds the runway', () => {
    const r = computeSafetyFactorPipeline(input({ available: { takeoff: 700, landing: 1000 } }))
    expect(r.takeoff.insufficient).toBe(true)
    expect(r.takeoff.marginAbsolute).toBe(-50)
    expect(r.takeoff.marginPercent).toBeCloseTo(-6.6667, 3)
    expect(r.violations).toContainEqual(runwayInsufficientViolation('takeoff'))
    expect(r.violations.some((v) => v.operation === 'landing' && v.type === 'RUNWAY_INSUFFICIENT')).toBe(false)
    expect(r.goNoGo).toBe(false)
  })

  it('treats required exactly equal to available as sufficient (no CRIT)', () => {
    const r = computeSafetyFactorPipeline(input({ available: { takeoff: 750, landing: 1000 } }))
    expect(r.takeoff.insufficient).toBe(false)
    expect(r.takeoff.marginAbsolute).toBe(0)
    expect(r.takeoff.marginPercent).toBe(0)
    expect(r.violations).toEqual([])
    expect(r.goNoGo).toBe(true)
  })

  it('raises CRIT-PF-002 for both operations when both runways are too short', () => {
    const r = computeSafetyFactorPipeline(input({ available: { takeoff: 100, landing: 100 } }))
    expect(r.violations.filter((v) => v.type === 'RUNWAY_INSUFFICIENT')).toHaveLength(2)
    expect(r.violations.every((v) => v.blocking)).toBe(true)
    expect(r.goNoGo).toBe(false)
  })
})

describe('computeSafetyFactorPipeline — WARN-PF-002 (REQ-PF-016)', () => {
  it('warns on a short-field landing factor below the 1.43 baseline but still allows Go', () => {
    const r = computeSafetyFactorPipeline(input({ osf: { preset: 'short-field' } }))
    expect(r.violations).toEqual([osfBelowMinimumViolation('landing')])
    expect(r.violations.every((v) => !v.blocking)).toBe(true)
    expect(r.goNoGo).toBe(true)
  })

  it('warns on both operations for a custom OSF below both baselines', () => {
    const r = computeSafetyFactorPipeline(input({ osf: { preset: 'custom', customMultiplier: 1.0 } }))
    expect(r.violations.filter((v) => v.type === 'OSF_BELOW_MINIMUM')).toHaveLength(2)
    expect(r.goNoGo).toBe(true)
  })

  it('does not warn when poh-afm meets its own mandated factor', () => {
    const r = computeSafetyFactorPipeline(
      input({ osf: { preset: 'poh-afm', pohMandatedFactor: { takeoff: 1.3, landing: 1.5 } } }),
    )
    expect(r.violations).toEqual([])
    expect(r.takeoff.appliedOsf).toBe(1.3)
    expect(r.landing.appliedOsf).toBe(1.5)
  })

  it('emits CRIT before WARN in violation order when both fire', () => {
    const r = computeSafetyFactorPipeline(
      input({ osf: { preset: 'custom', customMultiplier: 1.0 }, available: { takeoff: 100, landing: 1000 } }),
    )
    expect(r.violations[0]).toEqual(runwayInsufficientViolation('takeoff'))
    expect(r.violations.some((v) => v.type === 'OSF_BELOW_MINIMUM')).toBe(true)
    expect(r.goNoGo).toBe(false)
  })
})

describe('computeSafetyFactorPipeline — robustness', () => {
  it('degrades a malformed full < ground-roll profile to fullRequired === groundRollRequired', () => {
    const r = computeSafetyFactorPipeline(
      input({
        base: { takeoffRoll: 400, takeoffDistance50ft: 300, landingRoll: 200, landingDistance50ft: 400 },
        osf: { preset: 'custom', customMultiplier: 1.0 },
      }),
    )
    expect(r.takeoff.fullRequired).toBe(400)
    expect(r.takeoff.fullRequired).toBeGreaterThanOrEqual(r.takeoff.groundRollRequired)
  })

  it('is deterministic for identical inputs', () => {
    expect(computeSafetyFactorPipeline(input())).toEqual(computeSafetyFactorPipeline(input()))
  })
})
