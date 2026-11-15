import { describe, it, expect } from 'vitest'
import { fuelLookupUsableMoment } from './mb.arm-lookup'
import { computeMassBalanceCore } from './mass-balance.logic'
import { calculateMassBalance } from '../adapters/mass-balance.adapter'
import type { MathCoreInput } from '../domain/mass-balance.math-types'
import type { ArmLookupEntry } from '../domain/aircraft.types'

// Synthetic software references only (not aircraft data): base 560 kg / 1120 kg·m,
// total tank moment knots (0,0),(10,10),(30,60),(50,150) in kg / kg·m.
const KNOTS: ArmLookupEntry[] = [
  { massOrVolume: 0, moment: 0 },
  { massOrVolume: 10, moment: 10 },
  { massOrVolume: 30, moment: 60 },
  { massOrVolume: 50, moment: 150 },
]
const entries = (pairs: [number, number][]) =>
  pairs.map(([massOrVolume, moment]) => ({ massOrVolume, moment }))

function input(
  mass: number,
  unusableFuel: number,
  armLookup: ArmLookupEntry[] = KNOTS,
  arm: number | null = null,
): MathCoreInput {
  return {
    basicEmptyMass: 560,
    emptyCenterOfGravity: 2,
    maxTakeoffMass: 1000,
    maxZeroFuelMass: null,
    graphType: 'arm',
    envelope: [
      { mass: 500, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 4 },
      { mass: 500, armOrMoment: 4 },
    ],
    stations: [],
    fuelStations: [{ index: 0, mass, unusableFuel, arm, armLookup, burnSequences: [] }],
  }
}

describe('fuelLookupUsableMoment — total-load contribution F(q) − F(u)', () => {
  it.each([
    [50, 40, 140],
    [40, 30, 95],
    [30, 20, 50],
    [20, 10, 25],
    [10, 0, 0],
  ])('q=%s, u=10 → usable %s kg, %s kg·m', (q, mass, moment) => {
    expect(fuelLookupUsableMoment(q, 10, KNOTS)).toEqual({
      ok: true,
      usableMassKg: mass,
      usableMomentKgM: moment,
    })
  })

  it('zero unusable fuel equals F(q) with an origin knot', () => {
    expect(fuelLookupUsableMoment(50, 0, KNOTS)).toMatchObject({ usableMomentKgM: 150 })
  })

  it('does not need an origin knot when u and q are covered', () => {
    const table = entries([
      [10, 10],
      [30, 60],
      [50, 150],
    ])
    expect(fuelLookupUsableMoment(50, 10, table)).toMatchObject({ usableMomentKgM: 140 })
  })

  it('accepts signed and nonmonotonic moments', () => {
    const signed = KNOTS.map((e) => ({ ...e, moment: -e.moment }))
    expect(fuelLookupUsableMoment(30, 10, signed)).toMatchObject({ usableMomentKgM: -50 })
    const wave = entries([
      [0, 0],
      [10, 20],
      [30, -10],
      [50, 40],
    ])
    expect(fuelLookupUsableMoment(30, 10, wave)).toMatchObject({ usableMomentKgM: -30 })
  })

  it('rejects q < u instead of coercing usable fuel to zero', () => {
    expect(fuelLookupUsableMoment(9, 10, KNOTS)).toEqual({ ok: false, reason: 'BELOW_UNUSABLE' })
  })

  it.each([
    ['NaN quantity', NaN, 0],
    ['infinite quantity', Infinity, 0],
    ['negative unusable', 10, -1],
  ])('rejects %s', (_label, q, u) => {
    expect(fuelLookupUsableMoment(q, u, KNOTS)).toEqual({ ok: false, reason: 'INVALID_INPUT' })
  })

  it.each([
    ['empty', []],
    ['singleton', entries([[50, 150]])],
    [
      'duplicate quantity',
      entries([
        [0, 0],
        [30, 60],
        [30, 70],
        [50, 150],
      ]),
    ],
    [
      'unsorted',
      entries([
        [0, 0],
        [50, 150],
        [30, 60],
      ]),
    ],
    [
      'NaN moment',
      entries([
        [0, 0],
        [50, NaN],
      ]),
    ],
    [
      'infinite quantity',
      entries([
        [0, 0],
        [Infinity, 150],
      ]),
    ],
    [
      'negative quantity',
      entries([
        [-1, 0],
        [50, 150],
      ]),
    ],
    [
      'moment beyond SI bound',
      entries([
        [0, 0],
        [50, 20_000_001],
      ]),
    ],
    [
      'quantity beyond SI bound',
      entries([
        [0, 0],
        [200_001, 150],
      ]),
    ],
  ])('rejects %s geometry, even at q = u', (_label, table) => {
    expect(fuelLookupUsableMoment(10, 10, table)).toEqual({
      ok: false,
      reason: 'INVALID_GEOMETRY',
    })
  })

  it('requires coverage of both u and q without clamping or extrapolation', () => {
    const fromTwenty = entries([
      [20, 30],
      [50, 150],
    ])
    expect(fuelLookupUsableMoment(50, 10, fromTwenty)).toEqual({
      ok: false,
      reason: 'LOOKUP_OUT_OF_RANGE',
    })
    expect(fuelLookupUsableMoment(60, 10, KNOTS)).toEqual({
      ok: false,
      reason: 'LOOKUP_OUT_OF_RANGE',
    })
    expect(fuelLookupUsableMoment(25, 25, fromTwenty)).toMatchObject({ usableMomentKgM: 0 })
  })

  it('rejects a difference beyond the SI moment bound', () => {
    const extreme = entries([
      [0, -20_000_000],
      [50, 20_000_000],
    ])
    expect(fuelLookupUsableMoment(50, 0, extreme)).toEqual({
      ok: false,
      reason: 'NUMERIC_OVERFLOW',
    })
  })
})

describe('M&B core with a nonzero-unusable lookup tank', () => {
  it.each([
    [50, 600, 1260],
    [40, 590, 1215],
    [30, 580, 1170],
    [20, 570, 1145],
    [10, 560, 1120],
  ])('current load %s kg → takeoff %s kg / %s kg·m', (q, mass, moment) => {
    const result = computeMassBalanceCore(input(q, 10))
    expect(result.takeoffCenterOfGravityPoint.mass).toBe(mass)
    expect(result.takeoffCenterOfGravityPoint.moment).toBe(moment)
    expect(result.takeoffCenterOfGravityPoint.arm).toBe(moment / mass)
    // Unusable fuel stays in BEM exactly once: all-usable-burned endpoint is BEM.
    expect(result.landingCenterOfGravityPoint).toEqual({ arm: 2, mass: 560, moment: 1120 })
  })

  it('keeps the zero-unusable lookup results unchanged', () => {
    expect(computeMassBalanceCore(input(50, 0)).takeoffCenterOfGravityPoint.moment).toBe(1270)
  })

  it('keeps the fixed-arm contribution (q − u)·arm', () => {
    const result = computeMassBalanceCore(input(50, 10, [], 1))
    expect(result.takeoffCenterOfGravityPoint).toEqual({ arm: 1160 / 600, mass: 600, moment: 1160 })
  })

  it('subtracts the corrected lookup contribution at a named-sequence waypoint', () => {
    const core = input(50, 10)
    core.fuelStations[0]!.burnSequences = [{ sequenceName: 'Main', ordinalPosition: 1 }]
    core.fuelStations.push({
      index: 1,
      mass: 20,
      unusableFuel: 0,
      arm: 1,
      armLookup: [],
      burnSequences: [{ sequenceName: 'Main', ordinalPosition: 2 }],
    })
    const result = computeMassBalanceCore(core)
    expect(result.takeoffCenterOfGravityPoint.moment).toBe(1280)
    expect(result.migrationPath.map((p) => [p.label, p.mass, p.moment])).toEqual([
      ['Takeoff', 620, 1280],
      ['Main #1', 580, 1140],
      ['Landing', 560, 1120],
    ])
  })

  it('checks the arm-mode and moment-mode envelope against the corrected point', () => {
    // Envelope arm limit 2.09 m sits between the legacy 1240/600 and corrected 1260/600 CG.
    const arm = input(50, 10)
    arm.envelope = [
      { mass: 500, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 2.09 },
      { mass: 500, armOrMoment: 2.09 },
    ]
    expect(computeMassBalanceCore(arm).violations).toContainEqual({ type: 'CG_OUT_OF_ENVELOPE' })
    const moment = input(50, 10)
    moment.graphType = 'moment'
    moment.envelope = [
      { mass: 500, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 1250 },
      { mass: 500, armOrMoment: 1250 },
    ]
    expect(computeMassBalanceCore(moment).violations).toContainEqual({
      type: 'CG_OUT_OF_ENVELOPE',
    })
  })
})

describe('M&B adapter validation of lookup fuel tanks', () => {
  it.each([
    ['BELOW_UNUSABLE', input(9, 10), 'mass'],
    ['INVALID_GEOMETRY', input(50, 10, entries([[50, 150]])), 'armLookup'],
    [
      'INVALID_GEOMETRY',
      input(
        50,
        10,
        entries([
          [0, 0],
          [50, 150],
          [30, 60],
        ]),
      ),
      'armLookup',
    ],
    ['LOOKUP_OUT_OF_RANGE', input(60, 10), 'armLookup'],
    [
      'LOOKUP_OUT_OF_RANGE',
      input(
        50,
        10,
        entries([
          [20, 30],
          [50, 150],
        ]),
      ),
      'armLookup',
    ],
    [
      'NUMERIC_OVERFLOW',
      input(
        50,
        0,
        entries([
          [0, -20_000_000],
          [50, 20_000_000],
        ]),
      ),
      'armLookup',
    ],
  ])('blocks %s with a typed violation', (code, raw, field) => {
    const result = calculateMassBalance(raw)
    expect(result.success).toBe(false)
    expect(result.violations).toContainEqual(
      expect.objectContaining({ type: 'INVALID_INPUT', code, path: ['fuelStations', 0, field] }),
    )
  })

  it('reports an arm plus lookup tank as NOT_ALLOWED without choosing a geometry', () => {
    const result = calculateMassBalance(input(50, 10, KNOTS, 1))
    expect(result.success).toBe(false)
    expect(result.violations).toEqual([
      expect.objectContaining({ code: 'NOT_ALLOWED', path: ['fuelStations', 0, 'arm'] }),
    ])
  })

  it('accepts q = u as a zero usable contribution', () => {
    const result = calculateMassBalance(input(10, 10))
    expect(result.success).toBe(true)
    expect(result.takeoffCenterOfGravityPoint).toEqual({ arm: 2, mass: 560, moment: 1120 })
  })
})
