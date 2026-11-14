import { describe, expect, it } from 'vitest'
import { calculateMassBalance } from '@/core/adapters/mass-balance.adapter'
import { syntheticFuelContext, stations } from './synthetic-fuel.fixture'
import { arrivalCgForPlanning } from './arrival-cg'

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
      reason: expect.stringContaining('Variable-arm'),
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
