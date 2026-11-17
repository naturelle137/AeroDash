import { describe, it, expect } from 'vitest'
import { calculateMassBalance } from './mass-balance.adapter'
import { computeMassBalanceCore } from '../logic/mass-balance.logic'
import type { MathCoreInput } from '../domain/mass-balance.math-types'

// Synthetic software vectors only: BEM includes unusable fuel, not POH data.
function input(q: number, u = 10, index = 0, arm = 3): MathCoreInput {
  return {
    basicEmptyMass: 560, emptyCenterOfGravity: 2, maxTakeoffMass: 1000,
    maxZeroFuelMass: null, graphType: 'arm', stations: [],
    envelope: [
      { mass: 500, armOrMoment: 0 }, { mass: 1000, armOrMoment: 0 },
      { mass: 1000, armOrMoment: 4 }, { mass: 500, armOrMoment: 4 },
    ],
    fuelStations: [{ index, mass: q, unusableFuel: u, arm, armLookup: [], burnSequences: [] }],
  }
}
const bem = { mass: 560, moment: 1120, arm: 2 }

describe('fixed-arm total fuel lower boundary', () => {
  it.each([9, 0, 10 - 1e-6])('rejects q=%s without tolerance or result points', (q) => {
    const result = calculateMassBalance(input(q))
    expect(result.success).toBe(false)
    expect(result.violations).toEqual([expect.objectContaining({
      type: 'INVALID_INPUT', code: 'BELOW_UNUSABLE', path: ['fuelStations', 0, 'mass'],
    })])
    expect(result.migrationPath).toEqual([])
    for (const point of [result.takeoffCenterOfGravityPoint, result.landingCenterOfGravityPoint, result.zeroFuelCenterOfGravityPoint]) {
      expect(Object.values(point).every(Number.isNaN)).toBe(true)
    }
    expect(() => computeMassBalanceCore(input(q))).toThrow('invalid total or unusable fuel')
  })

  it.each([[10, 10, bem], [30, 10, { mass: 580, moment: 1180, arm: 1180 / 580 }], [0, 0, bem]] as const)(
    'q=%s/u=%s preserves exact BEM and usable contribution', (q, u, takeoff) => {
      const result = calculateMassBalance(input(q, u))
      expect(result.success).toBe(true)
      expect(result.violations).toEqual([])
      expect(result.takeoffCenterOfGravityPoint).toEqual(takeoff)
      expect(result.landingCenterOfGravityPoint).toEqual(bem)
      expect(result.zeroFuelCenterOfGravityPoint).toEqual(bem)
    },
  )

  it('uses array position for distinct station identities', () => {
    const data = input(10, 10, 2)
    data.fuelStations.push(input(9, 10, 7).fuelStations[0]!)
    const result = calculateMassBalance(data)
    expect(result.success).toBe(false)
    expect(result.violations).toEqual([expect.objectContaining({
      code: 'BELOW_UNUSABLE', path: ['fuelStations', 1, 'mass'],
    })])
  })

  it('checks a zero arm too', () => {
    expect(calculateMassBalance(input(9, 10, 0, 0)).success).toBe(false)
    expect(calculateMassBalance(input(30, 10, 0, 0)).takeoffCenterOfGravityPoint.moment).toBe(1120)
  })

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid raw quantities %s', (value) => {
    expect(calculateMassBalance(input(value)).success).toBe(false)
    expect(calculateMassBalance(input(30, value)).success).toBe(false)
    expect(() => computeMassBalanceCore(input(value))).toThrow('invalid total or unusable fuel')
    expect(() => computeMassBalanceCore(input(30, value))).toThrow('invalid total or unusable fuel')
  })

  it('does not duplicate lookup lower-bound violations', () => {
    const data = input(9)
    data.fuelStations[0]!.arm = null
    data.fuelStations[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }, { massOrVolume: 30, moment: 90 }]
    expect(calculateMassBalance(data).violations).toEqual([expect.objectContaining({
      code: 'BELOW_UNUSABLE', path: ['fuelStations', 0, 'mass'],
    })])
  })
})
