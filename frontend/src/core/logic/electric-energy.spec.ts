import { describe, expect, it } from 'vitest'
import { calculateElectricAddedReserve, calculateElectricEndurance, calculateElectricEnergy } from './electric-energy'

describe('manual electric energy budget', () => {
  it('calculates a synthetic trip and reserve difference', () => {
    expect(calculateElectricEnergy(30, 5, 20, 12, 60)).toEqual({ trip: 12, remaining: 8, margin: 3 })
    expect(calculateElectricEnergy(30, 5, 20, 20, 60)?.margin).toBe(-5)
  })
  it('rejects missing, invalid, out-of-capacity and overflow inputs', () => {
    for (const args of [[30, 5, NaN, 12, 60], [30, 5, 31, 12, 60], [30, 30, 20, 12, 60], [30, 5, 20, 0, 60], [30, 5, 20, 12, -1], [30, 5, 20, Number.MAX_VALUE, Number.MAX_VALUE]]) {
      expect(calculateElectricEnergy(args[0]!, args[1]!, args[2]!, args[3]!, args[4]!)).toBeNull()
    }
  })
})

describe('electric endurance', () => {
  it('calculates finite minutes and clamps time above reserve', () => {
    expect(calculateElectricEndurance(30, 5, 20, 20)).toEqual({ depletion: 60, aboveReserve: 45 })
    expect(calculateElectricEndurance(30, 5, 0, 20)).toEqual({ depletion: 0, aboveReserve: 0 })
    expect(calculateElectricEndurance(30, 5, 3, 20)).toEqual({ depletion: 9, aboveReserve: 0 })
  })
  it('rejects invalid profiles, inputs and overflow', () => {
    for (const args of [[30, 5, NaN, 20], [30, 5, Infinity, 20], [30, 5, 31, 20], [30, 30, 20, 20], [30, 5, 20, 0], [30, 5, 20, Infinity], [30, 5, 20, Number.MIN_VALUE]]) {
      expect(calculateElectricEndurance(args[0]!, args[1]!, args[2]!, args[3]!)).toBeNull()
    }
  })
})

describe('pilot-added reserve', () => {
  it('calculates zero, exact floor and shortfall without clamping', () => {
    expect(calculateElectricAddedReserve(12, 0, 8, 5)).toEqual({ reserve: 0, afterReserve: 8, margin: 3 })
    expect(calculateElectricAddedReserve(12, 15, 8, 5)).toEqual({ reserve: 3, afterReserve: 5, margin: 0 })
    expect(calculateElectricAddedReserve(12, 30, 8, 5)).toEqual({ reserve: 6, afterReserve: 2, margin: -3 })
  })
  it('rejects invalid and overflowing input', () => {
    for (const minutes of [NaN, Infinity, -1, Number.MAX_VALUE]) expect(calculateElectricAddedReserve(12, minutes, 8, 5)).toBeNull()
  })
})
