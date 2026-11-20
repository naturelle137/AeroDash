import { describe, expect, it } from 'vitest'
import { calculateMassBalance } from '@/core/adapters/mass-balance.adapter'
import { syntheticFuelContext, stations } from './synthetic-fuel.fixture'
import { arrivalCgForPlanning } from './arrival-cg'
import { normalizeFuelQuantityToKg } from '@/core/logic/fuel-mass'
import {
  normalizeArmToM,
  normalizeMomentToSI,
  parseSourceUnit,
} from '@/core/logic/unit-normalization'

// Synthetic BEM includes unusable fuel; no operational aircraft reference data.
function setup() {
  const aircraft = syntheticFuelContext()
  aircraft.sourceUnit = 'kg'
  const mb = calculateMassBalance({
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
    fuelStations: [
      { index: 0, mass: 50, unusableFuel: 10, arm: 1, armLookup: [], burnSequences: [] },
    ],
  })
  return { aircraft, mb }
}
describe('trip arrival CG SI adapter and eligibility', () => {
  it('uses actual M&B moment and retains the existing zero-usable endpoint', () => {
    const { aircraft, mb } = setup()
    const before = structuredClone(mb)
    expect(arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 20)).toEqual({
      ok: true,
      arrivalMomentKgM: 1140,
      arrivalCgM: 1140 / 580,
    })
    expect(arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 0)).toMatchObject({
      ok: true,
      arrivalCgM: mb.takeoffCenterOfGravityPoint.arm,
    })
    expect(arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 40)).toMatchObject({
      ok: true,
      arrivalCgM: mb.landingCenterOfGravityPoint.arm,
    })
    expect(mb).toEqual(before)
  })
  it.each([
    ['lb-in', 1 / 0.0254],
    ['kg-ft', 1 / 0.3048],
  ])('normalizes %s arms at the existing SI boundary', (sourceUnit, arm) => {
    const { aircraft, mb } = setup()
    aircraft.sourceUnit = sourceUnit
    aircraft.loadPoints[0]!.arm = arm
    const result = arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 20)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.reason)
    expect(result.arrivalCgM).toBeCloseTo(1140 / 580, 12)
  })
  it('counts an empty second available tank but ignores category-excluded tanks', () => {
    const { aircraft, mb } = setup()
    aircraft.loadPoints.push({ ...aircraft.loadPoints[0]!, name: 'Empty', defaultQuantity: 10 })
    const loads = [...stations, { ...stations[0]!, index: 1, weight: 10 }]
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('Choose an explicit'),
    })
    aircraft.loadPoints[1]!.allowableCategories = ['Utility']
    expect(arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 20).ok).toBe(true)
  })
  it.each([null, NaN, Infinity])('rejects invalid geometry %s', (arm) => {
    const { aircraft, mb } = setup()
    aircraft.loadPoints[0]!.arm = arm
    expect(arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 20).ok).toBe(false)
  })
  it('rejects lookup geometry even with an explicit fixed arm', () => {
    const { aircraft, mb } = setup()
    aircraft.loadPoints[0]!.armLookup = [{ massOrVolume: 10, moment: 10 }]
    expect(arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 20)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('both a fixed arm and a lookup table'),
    })
  })
  it('rejects unknown source units instead of using the legacy fallback', () => {
    const { aircraft, mb } = setup()
    aircraft.sourceUnit = 'kg-furlong'
    expect(arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 20).ok).toBe(false)
  })
  it('rejects malformed inventory, electric profiles and missing/invalid M&B', () => {
    const { aircraft, mb } = setup()
    for (const loads of [
      [],
      [...stations, ...stations],
      [{ ...stations[0]!, weight: 9 }],
      [{ ...stations[0]!, weight: NaN }],
    ])
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20).ok).toBe(false)
    for (const invalid of [
      null,
      { ...mb, success: false },
      { ...mb, violations: [{ type: 'INVALID_INPUT' as const }] },
    ])
      expect(arrivalCgForPlanning(aircraft, 'Normal', stations, invalid, 20).ok).toBe(false)
    aircraft.powertrain = 'electric'
    expect(arrivalCgForPlanning(aircraft, 'Normal', stations, mb, 20).ok).toBe(false)
  })
})

describe('multi-tank adapter', () => {
  function multi() {
    const { aircraft, mb } = setup()
    aircraft.loadPoints[0]!.defaultQuantity = 30
    aircraft.loadPoints.push({ ...structuredClone(aircraft.loadPoints[0]!), name: 'B', arm: 3 })
    aircraft.loadPoints.forEach((tank, i) => {
      tank.fuelTank!.burnSequences = [
        { sequenceName: 'A first', ordinalPosition: i + 1 },
        { sequenceName: 'B first', ordinalPosition: 2 - i },
      ]
    })
    const loads = [0, 1].map((index) => ({ ...stations[0]!, index, weight: 30 }))
    return { aircraft, mb, loads }
  }
  it.each(['kg-m', 'lb-in'])(
    'retains unusable fuel and normalizes shared inventory/geometry in %s',
    (unit) => {
      const { aircraft, mb, loads } = multi()
      aircraft.sourceUnit = unit
      if (unit === 'lb-in') {
        aircraft.loadPoints.forEach((tank, i) => {
          tank.arm = (i === 0 ? 1 : 3) / 0.0254
          tank.unit = 'lb'
          tank.fuelTank!.unusableFuel = 10 / 0.45359237
          loads[i]!.weight = 30 / 0.45359237
        })
      }
      for (const [name, moment] of [
        ['A first', 1110],
        ['B first', 1090],
      ] as const) {
        const result = arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 30, name)
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error(result.reason)
        expect(result.arrivalCgM).toBeCloseTo(moment / 570, 12)
      }
    },
  )
  it('rejects unknown/incomplete/duplicate schedules and excluded references', () => {
    const { aircraft, mb, loads } = multi()
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 30, 'unknown').ok).toBe(false)
    aircraft.loadPoints[1]!.fuelTank!.burnSequences = []
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 30, 'A first').ok).toBe(false)
    aircraft.loadPoints[1]!.fuelTank!.burnSequences = [
      { sequenceName: 'A first', ordinalPosition: 2 },
      { sequenceName: 'A first', ordinalPosition: 3 },
    ]
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 30, 'A first').ok).toBe(false)
    aircraft.loadPoints[1]!.fuelTank!.burnSequences.pop()
    aircraft.loadPoints.push({
      ...structuredClone(aircraft.loadPoints[0]!),
      allowableCategories: ['Utility'],
    })
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 30, 'A first')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('category-excluded'),
    })
  })
})

// Synthetic nonlinear total-moment tables, not aircraft data. The kg/kg·m knots
// (0,0),(10,10),(30,60),(50,150) are also expressed in other supported raw units.
const LB = 0.45359237
const LB_IN = LB * 0.0254
const KG_KNOTS: [number, number][] = [
  [0, 0],
  [10, 10],
  [30, 60],
  [50, 150],
]
function variable(
  unit = 'kg',
  sourceUnit = 'kg-m',
  table = KG_KNOTS,
  quantity = 50,
  mbQuantity = quantity,
  unusable = 0,
) {
  const aircraft = syntheticFuelContext()
  const tank = aircraft.loadPoints[0]!
  aircraft.sourceUnit = sourceUnit
  tank.arm = null
  tank.unit = unit
  tank.operationalLimit = null
  tank.fuelTank!.unusableFuel = unusable
  tank.armLookup = table.map(([massOrVolume, moment]) => ({ massOrVolume, moment }))
  const loads = [{ ...stations[0]!, weight: quantity }]
  // Mirrors the store's existing SI boundary for the M&B input.
  const { massUnit, armUnit } = parseSourceUnit(sourceUnit)
  const toKg = (v: number) =>
    normalizeFuelQuantityToKg(v, unit as 'kg', tank.fuelTank!.permissibleFuelTypes)
  const mb = calculateMassBalance({
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
    fuelStations: [
      {
        index: 0,
        mass: toKg(mbQuantity),
        unusableFuel: toKg(unusable),
        arm: null,
        armLookup: tank.armLookup.map((e) => ({
          massOrVolume: toKg(e.massOrVolume),
          moment: normalizeMomentToSI(e.moment, massUnit, armUnit),
        })),
        burnSequences: [],
      },
    ],
  })
  return { aircraft, mb, loads }
}
const cg = (r: ReturnType<typeof arrivalCgForPlanning>) => {
  if (!r.ok) throw new Error(r.reason)
  return r
}
describe('single variable-arm tank adapter (zero unusable fuel)', () => {
  it.each([
    [0, 1270, 610],
    [10, 1225, 600],
    [20, 1180, 590],
    [30, 1155, 580],
    [50, 1120, 560],
  ])('burn %s kg gives %s kg·m at %s kg from actual M&B', (burn, moment, mass) => {
    const { aircraft, mb, loads } = variable()
    expect(mb.takeoffCenterOfGravityPoint.moment).toBe(1270)
    const result = cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, burn))
    expect(result.arrivalMomentKgM).toBeCloseTo(moment, 9)
    expect(result.arrivalCgM).toBeCloseTo(moment / mass, 12)
  })
  it('matches the takeoff point at zero burn and the zero-fuel point at full burn', () => {
    const { aircraft, mb, loads } = variable()
    const before = structuredClone(mb)
    expect(cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 0)).arrivalCgM).toBe(
      mb.takeoffCenterOfGravityPoint.arm,
    )
    expect(cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 50)).arrivalCgM).toBeCloseTo(
      mb.landingCenterOfGravityPoint.arm,
      12,
    )
    expect(mb).toEqual(before)
  })
  it.each([
    ['lb', 'lb-in', LB, LB_IN],
    ['L', 'kg-m', 0.72, 1],
    ['USG', 'lb-in', 3.785411784 * 0.72, LB_IN],
    ['gal', 'lb-in', 3.785411784 * 0.72, LB_IN],
    ['IMPgal', 'kg', 4.54609 * 0.72, 1],
    ['kg', 'kg-ft', 1, 0.3048],
  ])('normalizes a %s axis with %s moments once each', (unit, sourceUnit, axis, moment) => {
    const table = KG_KNOTS.map(([x, m]) => [x / axis, m / moment] as [number, number])
    const { aircraft, mb, loads } = variable(unit, sourceUnit, table, 50 / axis)
    const result = cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20))
    expect(result.arrivalMomentKgM).toBeCloseTo(1180, 9)
    expect(result.arrivalCgM).toBeCloseTo(1180 / 590, 12)
  })
  it.each([
    ['lb', 'lb-in', LB, LB_IN],
    ['L', 'kg-m', 0.72, 1],
  ])('normalizes nonzero unusable fuel in %s', (unit, sourceUnit, axis, moment) => {
    const table = KG_KNOTS.map(([x, m]) => [x / axis, m / moment] as [number, number])
    const { aircraft, mb, loads } = variable(unit, sourceUnit, table, 50 / axis, 50 / axis, 10 / axis)
    const result = cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20))
    expect(result.arrivalMomentKgM).toBeCloseTo(1170, 8)
    expect(result.arrivalCgM).toBeCloseTo(1170 / 580, 10)
  })
  it('supports an empty current tank only at zero burn', () => {
    const { aircraft, mb, loads } = variable('kg', 'kg-m', KG_KNOTS, 0)
    expect(cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 0)).arrivalCgM).toBe(2)
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 1).ok).toBe(false)
  })
  it('accepts signed datum-relative moments', () => {
    const table = KG_KNOTS.map(([x, m]) => [x, -m] as [number, number])
    const { aircraft, mb, loads } = variable('kg', 'kg-m', table)
    expect(
      cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20)).arrivalMomentKgM,
    ).toBeCloseTo(1060, 9)
  })
  it.each([[0, 1260, 600], [20, 1170, 580], [40, 1120, 560]])(
    'retains unusable fuel for %s kg burn', (burn, moment, mass) => {
      const { aircraft, loads } = variable()
      aircraft.loadPoints[0]!.fuelTank!.unusableFuel = 10
      const mb = calculateMassBalance({
        ...setupInput(),
        fuelStations: [{ index: 0, mass: 50, unusableFuel: 10, arm: null,
          armLookup: KG_KNOTS.map(([massOrVolume, moment]) => ({ massOrVolume, moment })),
          burnSequences: [] }],
      })
      const result = cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, burn))
      expect(result.arrivalMomentKgM).toBeCloseTo(moment)
      expect(result.arrivalCgM).toBeCloseTo(moment / mass)
    },
  )
  it('rejects a fixed arm combined with a lookup table', () => {
    const { aircraft, mb, loads } = variable()
    aircraft.loadPoints[0]!.arm = 3
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('both a fixed arm'),
    })
  })
  describe('mixed fixed-arm and lookup sequence', () => {
    // Tank A: lookup (kg-m table above). Tank B: fixed arm 1 m. Both zero unusable fuel.
    function mixed(loadA = 30, loadB = 20, unit = 'kg', sourceUnit = 'kg-m', unusableA = 0) {
      const { aircraft, loads } = variable(
        unit,
        sourceUnit,
        unit === 'lb' ? KG_KNOTS.map(([q, m]) => [q / LB, m / LB_IN]) : KG_KNOTS,
        loadA,
        loadA,
        unusableA,
      )
      const fixed = structuredClone(aircraft.loadPoints[0]!)
      fixed.name = 'B'
      fixed.armLookup = []
      fixed.arm = unit === 'lb' ? 1 / 0.0254 : 1
      fixed.fuelTank!.unusableFuel = 0
      aircraft.loadPoints.push(fixed)
      aircraft.loadPoints.forEach((tank, i) => {
        tank.fuelTank!.burnSequences = [
          { sequenceName: 'A first', ordinalPosition: i + 1 },
          { sequenceName: 'B first', ordinalPosition: 2 - i },
        ]
      })
      const all = [...loads, { ...loads[0]!, index: 1, weight: loadB }]
      const toKg = (v: number) => (unit === 'lb' ? v * LB : v)
      const { massUnit, armUnit } = parseSourceUnit(sourceUnit)
      const lookup = aircraft.loadPoints[0]!.armLookup.map((e) => ({
        massOrVolume: toKg(e.massOrVolume),
        moment: normalizeMomentToSI(e.moment, massUnit, armUnit),
      }))
      const mb = calculateMassBalance({
        ...setupInput(),
        fuelStations: [
          {
            index: 0,
            mass: toKg(loadA),
            unusableFuel: toKg(unusableA),
            arm: null,
            armLookup: lookup,
            burnSequences: [],
          },
          {
            index: 1,
            mass: toKg(loadB),
            unusableFuel: 0,
            arm: normalizeArmToM(fixed.arm, armUnit),
            armLookup: [],
            burnSequences: [],
          },
        ],
      })
      return { aircraft, mb, loads: all }
    }
    // Takeoff moment: BEM 560×2 + F(30)=60 + 20×1 = 1200 kg·m at 610 kg.
    // Hand-derived burns: F(30)−F(20)=25, F(30)−F(0)=60, F(30)−F(10)=50; B arm 1 m.
    it.each([
      ['A first', 0, 1200, 610],
      ['A first', 10, 1175, 600],
      ['A first', 30, 1140, 580],
      ['A first', 40, 1130, 570],
      ['A first', 50, 1120, 560],
      ['B first', 10, 1190, 600],
      ['B first', 20, 1180, 590],
      ['B first', 40, 1130, 570],
      ['B first', 50, 1120, 560],
    ] as const)('%s with %s kg burned', (name, burn, moment, mass) => {
      const { aircraft, mb, loads } = mixed()
      const r = cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, burn, name))
      expect(r.arrivalMomentKgM).toBeCloseTo(moment, 9)
      expect(r.arrivalCgM).toBeCloseTo(moment / mass, 12)
    })
    // Tank A holds 10 kg unusable + 20 kg usable. M&B takeoff: 600 kg, 1120 + (F(30) − F(10)) + 20 = 1190 kg·m;
    // unusable fuel is never burned, so arrival subtracts F(30) − F(30 − burn) from tank A.
    it.each([
      ['A first', 10, 1165, 590],
      ['A first', 20, 1140, 580],
      ['A first', 40, 1120, 560],
      ['B first', 30, 1145, 570],
    ] as const)('keeps unusable lookup fuel aboard: %s, %s kg', (name, burn, moment, mass) => {
      const { aircraft, mb, loads } = mixed(30, 20, 'kg', 'kg-m', 10)
      const r = cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, burn, name))
      expect(r.arrivalMomentKgM).toBeCloseTo(moment, 9)
      expect(r.arrivalCgM).toBeCloseTo(moment / mass, 12)
    })
    it('rejects a nonzero-unusable burn beyond usable fuel', () => {
      const { aircraft, mb, loads } = mixed(30, 20, 'kg', 'kg-m', 10)
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 41, 'A first').ok).toBe(false)
    })
    it('normalizes lb-in tables, arms and loads', () => {
      const { aircraft, mb, loads } = mixed(30 / LB, 20 / LB, 'lb', 'lb-in')
      const r = cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 40, 'A first'))
      expect(r.arrivalCgM).toBeCloseTo(1130 / 570, 9)
    })
    it('treats an empty lookup tank as burning nothing', () => {
      const { aircraft, mb, loads } = mixed(0, 20)
      const r = cg(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20, 'A first'))
      expect(r.arrivalMomentKgM).toBeCloseTo(560 * 2, 9)
    })
    it('requires a selected sequence and rejects bad sequences', () => {
      const { aircraft, mb, loads } = mixed()
      for (const name of ['', 'Unknown'])
        expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20, name).ok).toBe(false)
      aircraft.loadPoints[1]!.fuelTank!.burnSequences[0]!.ordinalPosition = 1
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20, 'A first').ok).toBe(false)
    })
    it('rejects both geometries and bad tables', () => {
      const bad = [
        (a: ReturnType<typeof mixed>['aircraft']) => (a.loadPoints[0]!.arm = 3),
        (a: ReturnType<typeof mixed>['aircraft']) => (a.loadPoints[0]!.armLookup[0]!.moment = 1),
        (a: ReturnType<typeof mixed>['aircraft']) => a.loadPoints[0]!.armLookup.reverse(),
        (a: ReturnType<typeof mixed>['aircraft']) => a.loadPoints[0]!.armLookup.splice(2),
        (a: ReturnType<typeof mixed>['aircraft']) => (a.loadPoints[0]!.unit = 'bogus'),
        (a: ReturnType<typeof mixed>['aircraft']) => (a.sourceUnit = 'nonsense'),
      ]
      for (const mutate of bad) {
        const { aircraft, mb, loads } = mixed()
        mutate(aircraft)
        expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20, 'A first').ok).toBe(false)
      }
    })
    it('accepts fractional loads despite float summation order, still rejecting stale M&B', () => {
      const { aircraft, mb, loads } = mixed(0.1, 0.2)
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 0.1, 'A first').ok).toBe(true)
      const stale = structuredClone(mb)
      stale.takeoffCenterOfGravityPoint.mass += 0.001
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, stale, 0.1, 'A first').ok).toBe(false)
    })
    it('rejects burns beyond inventory and stale M&B without clamping', () => {
      const { aircraft, mb, loads } = mixed()
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 51, 'A first').ok).toBe(false)
      const stale = structuredClone(mb)
      stale.takeoffCenterOfGravityPoint.mass += 1
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, stale, 20, 'A first').ok).toBe(false)
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, null, 20, 'A first').ok).toBe(false)
    })
    it('recomputes when inputs change', () => {
      const a = mixed(30, 20)
      const b = mixed(50, 20)
      const first = cg(arrivalCgForPlanning(a.aircraft, 'Normal', a.loads, a.mb, 20, 'A first'))
      const second = cg(arrivalCgForPlanning(b.aircraft, 'Normal', b.loads, b.mb, 20, 'A first'))
      expect(second.arrivalCgM).not.toBe(first.arrivalCgM)
    })
  })
  it.each([
    [
      'negative raw quantity (clamped by normalization)',
      [
        [-1, 0],
        [0, 0],
        [50, 150],
      ],
    ],
    ['singleton', [[50, 150]]],
    [
      'duplicate',
      [
        [0, 0],
        [30, 60],
        [30, 65],
        [50, 150],
      ],
    ],
    [
      'unsorted',
      [
        [0, 0],
        [50, 150],
        [30, 60],
      ],
    ],
    [
      'missing origin',
      [
        [10, 10],
        [50, 150],
      ],
    ],
    [
      'nonzero origin moment',
      [
        [0, 1],
        [50, 150],
      ],
    ],
  ])('rejects %s geometry with a visible reason', (_, table) => {
    const { aircraft, mb, loads } = variable()
    aircraft.loadPoints[0]!.armLookup = (table as number[][]).map(([massOrVolume, moment]) => ({
      massOrVolume: massOrVolume!,
      moment: moment!,
    }))
    const result = arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20)
    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringContaining('Variable-arm lookup geometry'),
    })
  })
  it.each([
    [0, Infinity],
    [NaN, 150],
  ])('rejects nonfinite raw knot (%s, %s) at the profile schema', (x, m) => {
    const { aircraft, mb, loads } = variable()
    aircraft.loadPoints[0]!.armLookup[3] = { massOrVolume: x, moment: m }
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20).ok).toBe(false)
  })
  it('rejects loads beyond the table and conversion overflow without clamping', () => {
    // M&B itself now blocks an uncovered load, so arrival has no current result to use.
    const { aircraft, mb, loads } = variable('kg', 'kg-m', KG_KNOTS, 60)
    expect(mb.success).toBe(false)
    expect(mb.violations).toContainEqual(expect.objectContaining({ code: 'LOOKUP_OUT_OF_RANGE' }))
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('Valid current Mass & Balance'),
    })
    // A stale valid q50 result offered for the q60 loading is also refused.
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, variable().mb, 20).ok).toBe(false)
    const usg = variable(
      'USG',
      'kg-m',
      [
        [0, 0],
        [10, 10],
      ],
      5,
    )
    usg.aircraft.loadPoints[0]!.armLookup.push({ massOrVolume: 1e308, moment: 20 })
    // The current valid M&B was computed from the finite table; the overflowing knot is refused.
    expect(arrivalCgForPlanning(usg.aircraft, 'Normal', usg.loads, usg.mb, 1)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('numeric limits'),
    })
  })
  it('rejects unknown source units and stale or invalid M&B', () => {
    const { aircraft, mb, loads } = variable()
    aircraft.sourceUnit = 'kg-furlong'
    expect(arrivalCgForPlanning(aircraft, 'Normal', loads, mb, 20).ok).toBe(false)
    aircraft.sourceUnit = 'kg-m'
    const stale = variable('kg', 'kg-m', KG_KNOTS, 50, 40).mb
    for (const invalid of [stale, null, { ...mb, success: false }])
      expect(arrivalCgForPlanning(aircraft, 'Normal', loads, invalid, 20)).toMatchObject({
        ok: false,
        reason: expect.stringContaining('Valid current Mass & Balance'),
      })
  })
})
function setupInput() {
  return {
    basicEmptyMass: 560,
    emptyCenterOfGravity: 2,
    maxTakeoffMass: 1000,
    maxZeroFuelMass: null,
    graphType: 'arm' as const,
    envelope: [
      { mass: 500, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 4 },
      { mass: 500, armOrMoment: 4 },
    ],
    stations: [],
  }
}
