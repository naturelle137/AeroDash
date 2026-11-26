import { describe, expect, it } from 'vitest'
import { modelQnh } from './model-qnh'

describe('model pressure ISA reduction', () => {
  it('reduces surface pressure at the matching elevation, including below sea level', () => {
    expect(modelQnh(1013.25, 0)).toBeCloseTo(1013.3, 0)
    expect(modelQnh(898.75, 1000)).toBeCloseTo(1013.2, 0)
    expect(modelQnh(1025.3, -100)).toBeCloseTo(1013.2, 0)
  })
  it('rejects invalid values and results outside the supported domain', () => {
    for (const [pressure, height] of [[NaN, 0], [0, 0], [1000, NaN], [1000, 3001], [500, 0]]) expect(modelQnh(pressure!, height!)).toBeNull()
  })
})
