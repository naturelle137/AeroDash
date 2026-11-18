import { describe, expect, it } from 'vitest'
import { applyTecnamS9Corrections, TECNAM_S9_RULES } from './performance.tecnam-s9-corrections'

// Reference values: AFM Doc. 2008/100 Ed. 2 Rev. 18, S9 p. MT5-7 (650 kg, T/O flaps, grass) S.L. 25 °C:
// ground roll 231 m, 50 ft 401 m; p. MT5-14 (650 kg) S.L. 25 °C: roll 179 m, 50 ft 388 m.
const TO = { operation: 'takeoff', groundRoll: 231, distanceOver50ft: 401, surface: 'grass', headwindKt: 0, slopePercent: 0 } as const
const LD = { operation: 'landing', groundRoll: 179, distanceOver50ft: 388, surface: 'grass', headwindKt: 0, slopePercent: 0 } as const

describe('Tecnam P2008 JC S9 corrections', () => {
  it('calm grass applies only the source in-service factor', () => {
    const t = applyTecnamS9Corrections(TO)
    expect(t.groundRoll).toBe(231)
    expect(t.factoredDistanceOver50ft).toBeCloseTo(441.1, 6)
    const l = applyTecnamS9Corrections(LD)
    expect(l.factoredDistanceOver50ft).toBeCloseTo(388 * 1.67, 6)
  })

  it('adds 15 m/kt takeoff and 13 m/kt landing tailwind to both rows', () => {
    const t = applyTecnamS9Corrections({ ...TO, headwindKt: -4 })
    expect(t.groundRoll).toBe(231 + 60)
    expect(t.distanceOver50ft).toBe(401 + 60)
    const l = applyTecnamS9Corrections({ ...LD, headwindKt: -3 })
    expect(l.groundRoll).toBe(179 + 39)
    expect(l.distanceOver50ft).toBe(388 + 39)
  })

  it('paved runway cuts ground roll by 10% and the same metres from the total', () => {
    const t = applyTecnamS9Corrections({ ...TO, surface: 'paved' })
    expect(t.groundRoll).toBeCloseTo(207.9, 9)
    expect(t.distanceOver50ft).toBeCloseTo(401 - 23.1, 9)
  })

  it('applies adverse slope only: +7%/% uphill takeoff, +3%/% downhill landing', () => {
    expect(applyTecnamS9Corrections({ ...TO, slopePercent: 2 }).groundRoll).toBeCloseTo(231 * 1.14, 9)
    expect(applyTecnamS9Corrections({ ...LD, slopePercent: -2 }).groundRoll).toBeCloseTo(179 * 1.06, 9)
    const credit = applyTecnamS9Corrections({ ...TO, slopePercent: -2 })
    expect(credit.groundRoll).toBe(231)
    expect(credit.notCredited).toEqual(['favourable-slope'])
    expect(applyTecnamS9Corrections({ ...LD, slopePercent: 2 }).notCredited).toEqual(['favourable-slope'])
  })

  it('reports headwind as not credited and leaves distances unchanged', () => {
    const t = applyTecnamS9Corrections({ ...TO, headwindKt: 10 })
    expect(t.distanceOver50ft).toBe(401)
    expect(t.notCredited).toEqual(['headwind'])
  })

  it('combines paved, slope and tailwind in source order', () => {
    const t = applyTecnamS9Corrections({ ...TO, surface: 'paved', slopePercent: 1, headwindKt: -2 })
    const roll = 231 * 0.9 * 1.07 + 30
    expect(t.groundRoll).toBeCloseTo(roll, 9)
    expect(t.factoredDistanceOver50ft).toBeCloseTo((roll + 170) * TECNAM_S9_RULES.takeoff.inServiceFactor, 9)
  })

  it('rejects non-finite or inconsistent input', () => {
    expect(() => applyTecnamS9Corrections({ ...TO, headwindKt: Number.NaN })).toThrow(RangeError)
    expect(() => applyTecnamS9Corrections({ ...TO, distanceOver50ft: 100 })).toThrow(RangeError)
  })
})
