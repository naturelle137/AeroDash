import { describe, expect, it } from 'vitest'
import { calculateElectricEnergy } from './electric-energy'

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
