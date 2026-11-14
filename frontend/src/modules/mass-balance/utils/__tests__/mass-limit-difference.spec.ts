import { describe, it, expect } from 'vitest'
import { massLimitDifference, massLimitDifferenceText } from '../mass-limit-difference'

// Expected values computed by hand (limit − mass), synthetic numbers only.
describe('massLimitDifference', () => {
  it.each([
    [530, 630, 'below', '100.0'],
    [629.9, 630, 'below', '0.1'],
    [629.95, 630, 'below', '<0.1'],
    [629.9999, 630, 'below', '<0.1'],
    [629.85, 630, 'below', '0.1'], // 0.15 margin floors, never rounds up
    [630, 630, 'at', '0.0'],
    [630.0001, 630, 'above', '0.1'], // tiny excess never shown as zero
    [630.11, 630, 'above', '0.2'], // 0.11 excess ceils
    // Raw-conservative boundaries (see rounding-counterexamples): the shown
    // value must never exceed the margin nor undercut the excess.
    [629.90000001, 630, 'below', '<0.1'], // margin 0.09999999 < 0.1
    [630.10000001, 630, 'above', '0.2'], // excess 0.10000001 > 0.1
    [629.99999999, 630, 'below', '<0.1'],
    [630.00000001, 630, 'above', '0.1'],
    [629.89999999, 630, 'below', '0.1'], // margin 0.10000001
    [630.09999999, 630, 'above', '0.1'], // excess 0.09999999
    // Binary doubles: 630.1 and 629.7 are stored marginally on the
    // unfavourable side, so the one-decimal bound is the next conservative step.
    [630.1, 630, 'above', '0.2'],
    [629.7, 630, 'below', '0.2'],
    [700.5, 630, 'above', '70.5'],
  ])('mass %f vs limit %f → %s %s', (mass, limit, relation, magnitude) => {
    expect(massLimitDifference(mass, limit)).toEqual({ relation, magnitude })
  })

  // Independent oracle: shown value vs raw delta, not a restatement of the helper.
  it('never overstates margin nor understates excess against the raw delta', () => {
    for (let i = 0; i < 4000; i++) {
      const limit = 630
      const mass = 600 + i * 0.0137 + (i % 7) * 1e-8
      const d = limit - mass
      const r = massLimitDifference(mass, limit)!
      // Signed shown value: margin positive, excess negative; "at" is 0.
      const sign = r.relation === 'below' ? 1 : -1
      const v = r.magnitude === '<0.1' || r.relation === 'at' ? 0 : sign * Number(r.magnitude)
      // d - v >= 0 means: shown margin <= raw margin, shown excess >= raw excess.
      expect(d - v).toBeGreaterThanOrEqual(0)
      // And it is no coarser than one display step (+1e-9 for the last-digit artefact).
      expect(Math.abs(d - v)).toBeLessThan(0.1 + 1e-9)
    }
  })

  it.each([
    [null, 630], [530, null], [530, undefined], [NaN, 630], [530, NaN],
    [Infinity, 630], [530, Infinity], [530, 0], [530, -5],
  ])('returns null for unusable input (%s, %s)', (mass, limit) => {
    expect(massLimitDifference(mass, limit)).toBeNull()
  })

  it('formats text without relying on colour', () => {
    expect(massLimitDifferenceText({ relation: 'below', magnitude: '100.0' }, 'MTOM')).toBe('Below MTOM by 100.0 kg')
    expect(massLimitDifferenceText({ relation: 'below', magnitude: '<0.1' }, 'MZFM')).toBe('Below MZFM by less than 0.1 kg')
    expect(massLimitDifferenceText({ relation: 'at', magnitude: '0.0' }, 'MTOM')).toBe('Exactly at MTOM')
    expect(massLimitDifferenceText({ relation: 'above', magnitude: '0.1' }, 'MTOM')).toBe('Above MTOM by 0.1 kg')
  })
})
