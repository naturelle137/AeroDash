import { describe, it, expect } from 'vitest'
import type { ArmLookupEntry } from '../domain/aircraft.types'
import { interpolateArmFromLookup } from './mb.arm-lookup'

const CG_PRECISION = 4

type InterpolationScenario = {
  description: string
  mass: number
  lookup: ArmLookupEntry[]
  expected: number
}

/**
 * No test for { massOrVolume: 0, moment: > 0 }, because the adapter must not
 * accept and propagate physically impossible entries (moment > 0 for zero mass)
 */
const interpolationScenarios: InterpolationScenario[] = [
  // @UT-MB-CORE-043@ (FROM: @IMP-MB-CORE-012@)
  {
    description: 'interpolates arm at midpoint between two entries',
    mass: 50,
    lookup: [
      { massOrVolume: 0, moment: 0 },
      { massOrVolume: 100, moment: 200 },
    ],
    expected: 2.0,
  },
  // @UT-MB-CORE-044@ (FROM: @IMP-MB-CORE-012@)
  {
    description: 'returns arm at exact upper boundary entry',
    mass: 100,
    lookup: [
      { massOrVolume: 0, moment: 0 },
      { massOrVolume: 100, moment: 200 },
    ],
    expected: 2.0,
  },
  // @UT-MB-CORE-045@ (FROM: @IMP-MB-CORE-012@)
  {
    description: 'clamps to first entry for mass below lowest entry',
    mass: 10,
    lookup: [
      { massOrVolume: 50, moment: 100 },
      { massOrVolume: 100, moment: 200 },
    ],
    expected: 2.0,
  },
  // @UT-MB-CORE-046@ (FROM: @IMP-MB-CORE-012@)
  {
    description: 'clamps to last entry for mass above highest entry',
    mass: 150,
    lookup: [
      { massOrVolume: 0, moment: 0 },
      { massOrVolume: 100, moment: 200 },
    ],
    expected: 2.0,
  },
  // @UT-MB-CORE-047@ (FROM: @IMP-MB-CORE-012@)
  {
    description: 'returns arm of 0 for zero mass when lookup starts at zero',
    mass: 0,
    lookup: [
      { massOrVolume: 0, moment: 0 },
      { massOrVolume: 100, moment: 200 },
    ],
    expected: 0,
  },
  // @UT-MB-CORE-048@ (FROM: @IMP-MB-CORE-012@)
  {
    description: 'returns arm of lowest entry for zero mass when lookup starts above zero',
    mass: 0,
    lookup: [
      { massOrVolume: 50, moment: 100 },
      { massOrVolume: 100, moment: 200 },
    ],
    expected: 2.0,
  },
]

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('interpolateArmFromLookup', () => {
  it.each(interpolationScenarios)('$description', ({ mass, lookup, expected }) => {
    expect(interpolateArmFromLookup(mass, lookup)).toBeCloseTo(expected, CG_PRECISION)
  })

  // @UT-MB-CORE-049@ (FROM: @IMP-MB-CORE-012@)
  it('handles single entry lookup', () => {
    expect(interpolateArmFromLookup(50, [{ massOrVolume: 50, moment: 100 }])).toBeCloseTo(
      2.0,
      CG_PRECISION,
    )
  })

  // @UT-MB-CORE-050@ (FROM: @IMP-MB-CORE-012@)
  it('sorts unsorted lookup entries before interpolating', () => {
    const lookup = [
      { massOrVolume: 100, moment: 200 },
      { massOrVolume: 50, moment: 100 },
      { massOrVolume: 200, moment: 400 },
    ]
    expect(interpolateArmFromLookup(150, lookup)).toBeCloseTo(2.0, CG_PRECISION)
  })

  // @UT-MB-CORE-051@ (FROM: @IMP-MB-CORE-012@)
  it('throws for empty lookup', () => {
    expect(() => interpolateArmFromLookup(50, [])).toThrow(
      'Invalid Input: armLookup has an invalid input.',
    )
  })

  // @UT-MB-CORE-052@ (FROM: @IMP-MB-CORE-012@)
  it('throws for NaN mass input', () => {
    const lookup = [
      { massOrVolume: 0, moment: 0 },
      { massOrVolume: 100, moment: 200 },
    ]
    expect(() => interpolateArmFromLookup(NaN, lookup)).toThrow(
      'Invalid Input: armLookup has an invalid input.',
    )
  })
})
