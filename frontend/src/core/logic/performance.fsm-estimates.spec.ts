import { describe, expect, it } from 'vitest'
import { estimateFsmTakeoff } from './performance.fsm-estimates'

// Synthetic vectors for the arithmetic only; not aircraft data.
const base = { groundRoll: 400, distanceOver50ft: 700, surface: 'paved:dry', headwindKt: 0, slopePercent: 0 }

describe('estimateFsmTakeoff', () => {
  it('changes nothing on level dry paved ground with calm wind', () => {
    expect(estimateFsmTakeoff(base)).toEqual({ status: 'estimated', groundRoll: 400, distanceOver50ft: 700, notCredited: [] })
  })

  it('chains slope then grass on the ground roll and keeps the airborne part', () => {
    const result = estimateFsmTakeoff({ ...base, surface: 'unpaved:dry-short-grass', slopePercent: 2 })
    if (result.status !== 'estimated') throw new Error('expected estimate')
    expect(result.groundRoll).toBeCloseTo(400 * 1.2 * 1.2)
    expect(result.distanceOver50ft - result.groundRoll).toBeCloseTo(300)
  })

  it('never credits headwind or downhill slope and reports both', () => {
    expect(estimateFsmTakeoff({ ...base, headwindKt: 10, slopePercent: -2 })).toEqual({
      status: 'estimated', groundRoll: 400, distanceOver50ft: 700, notCredited: ['headwind', 'favourable-slope'],
    })
  })

  it('refuses tailwind and surfaces without an unambiguous source row', () => {
    expect(estimateFsmTakeoff({ ...base, headwindKt: -1 })).toEqual({ status: 'unsupported', reason: 'tailwind' })
    for (const surface of ['unpaved:wet-soft-ground', 'paved:wet', 'unpaved:long-grass', 'paved:ice']) {
      expect(estimateFsmTakeoff({ ...base, surface })).toEqual({ status: 'unsupported', reason: 'surface' })
    }
  })

  it('rejects non-finite input and inconsistent distances', () => {
    expect(() => estimateFsmTakeoff({ ...base, slopePercent: Number.NaN })).toThrow(RangeError)
    expect(() => estimateFsmTakeoff({ ...base, distanceOver50ft: 300 })).toThrow(RangeError)
  })
})
