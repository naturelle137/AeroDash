import { describe, expect, it } from 'vitest'
import { resolveDistance } from './performance.estimation'

describe('resolveDistance', () => {
  it('uses published data before an estimate', () => {
    expect(resolveDistance(320, 220, 'takeoff', 'distance')).toEqual({ distance: 320, provenance: 'poh' })
  })
  it.each([
    ['takeoff', 'distance', 300, 570], ['takeoff', 'roll', 570, 300],
    ['landing', 'distance', 200, 334], ['landing', 'roll', 334, 200],
  ] as const)('estimates %s %s', (operation, missing, input, expected) => {
    const result = resolveDistance(null, input, operation, missing)
    expect(result.provenance).toBe('estimated')
    expect(result.distance).toBeCloseTo(expected)
  })
})
