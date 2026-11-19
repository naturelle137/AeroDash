import { describe, expect, it } from 'vitest'
import { isNonDecreasingInMass, lookupPhaseDistance, lookupPhaseDistanceWithExtrapolation } from './performance.phase-lookup'
import type { PerformanceCube3D } from './performance.poh-distance'

// Synthetic grid: proves software behaviour only, never aircraft performance.
// values[temp][alt][mass]; masses 800/1000 kg, PA 0/2000 ft, temps 0/20 °C.
const cube: PerformanceCube3D = {
  massAxis: [800, 1000],
  altitudeAxis: [0, 2000],
  temperatureAxis: [0, 20],
  values: [
    [[200, 300], [240, 360]],
    [[220, 330], [264, 396]],
  ],
}
const at = (mass: number, pressureAltitude = 0, temperature = 0) =>
  lookupPhaseDistance(cube, { mass, pressureAltitude, temperature })

describe('lookupPhaseDistance mass policy', () => {
  it('returns an exact table point unchanged', () => {
    expect(at(1000, 2000, 20)).toMatchObject({ status: 'success', distance: 396, massTreatment: 'tabulated', lookupMass: 1000 })
  })

  it('interpolates an intermediate in-envelope mass against an independent expectation', () => {
    // mass 900 halfway, PA 1000 halfway, temp 10 halfway: mean of all eight corners.
    const expected = (200 + 300 + 240 + 360 + 220 + 330 + 264 + 396) / 8
    const result = at(900, 1000, 10)
    expect(result.status).toBe('success')
    if (result.status !== 'success') throw new Error('Expected success')
    expect(result.distance).toBeCloseTo(expected, 10)
  })

  it('accepts the table minimum and maximum masses inclusively', () => {
    expect(at(800)).toMatchObject({ status: 'success', distance: 200, massTreatment: 'tabulated' })
    expect(at(1000)).toMatchObject({ status: 'success', distance: 300, massTreatment: 'tabulated' })
  })

  it('caps a below-minimum mass at the minimum-mass distance for the same conditions', () => {
    const result = at(650, 1000, 10)
    const minimum = at(800, 1000, 10)
    expect(result).toMatchObject({ status: 'success', massTreatment: 'benefit-capped', lookupMass: 800 })
    if (result.status !== 'success' || minimum.status !== 'success') throw new Error('Expected success')
    expect(result.distance).toBe(minimum.distance)
    expect(result.distance).toBeCloseTo((200 + 240 + 220 + 264) / 4, 10)
  })

  it('returns the minimum-mass boundary at the requested altitude and temperature', () => {
    const result = at(1, 2000, 20)
    expect(result).toMatchObject({ status: 'success', distance: 264 })
  })

  it('blocks a mass just above the table maximum: upper extrapolation has no accepted source', () => {
    expect(at(1000.001)).toEqual({ status: 'blocked', reason: 'mass-above-table', range: { min: 800, max: 1000 } })
    expect(at(1100)).toMatchObject({ status: 'blocked', reason: 'mass-above-table' })
  })

  it('blocks pressure altitude and temperature outside the table in both directions', () => {
    expect(at(900, -1)).toMatchObject({ status: 'blocked', reason: 'pressure-altitude-outside' })
    expect(at(900, 2001)).toMatchObject({ status: 'blocked', reason: 'pressure-altitude-outside' })
    expect(at(900, 0, -0.1)).toMatchObject({ status: 'blocked', reason: 'temperature-outside', range: { min: 0, max: 20 } })
    expect(at(900, 0, 21)).toMatchObject({ status: 'blocked', reason: 'temperature-outside' })
  })

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('blocks invalid mass %s', (mass) => {
    expect(at(mass)).toEqual({ status: 'blocked', reason: 'invalid-input', range: null })
  })

  it('blocks nonfinite conditions', () => {
    expect(at(900, Number.NaN)).toMatchObject({ reason: 'invalid-input' })
    expect(at(900, 0, Number.POSITIVE_INFINITY)).toMatchObject({ reason: 'invalid-input' })
  })

  it('blocks below-minimum capping when a row decreases with mass', () => {
    const decreasing: PerformanceCube3D = { ...cube, values: [[[200, 190], [240, 360]], [[220, 330], [264, 396]]] }
    expect(isNonDecreasingInMass(decreasing)).toBe(false)
    expect(lookupPhaseDistance(decreasing, { mass: 700, pressureAltitude: 0, temperature: 0 }))
      .toMatchObject({ status: 'blocked', reason: 'mass-below-table-unsupported' })
    // In-envelope interpolation is unaffected by the cap precondition.
    expect(lookupPhaseDistance(decreasing, { mass: 900, pressureAltitude: 0, temperature: 0 }))
      .toMatchObject({ status: 'success', distance: 195 })
  })

  it('treats a single-mass table as its own minimum and maximum', () => {
    const single: PerformanceCube3D = { massAxis: [900], altitudeAxis: [0], temperatureAxis: [15], values: [[[310]]] }
    expect(lookupPhaseDistance(single, { mass: 900, pressureAltitude: 0, temperature: 15 })).toMatchObject({ distance: 310, massTreatment: 'tabulated' })
    expect(lookupPhaseDistance(single, { mass: 850, pressureAltitude: 0, temperature: 15 })).toMatchObject({ distance: 310, massTreatment: 'benefit-capped' })
    expect(lookupPhaseDistance(single, { mass: 901, pressureAltitude: 0, temperature: 15 })).toMatchObject({ reason: 'mass-above-table' })
  })
})

describe('lookupPhaseDistanceWithExtrapolation', () => {
  const ext = (mass: number, pressureAltitude = 1000, temperature = 10, table = cube) =>
    lookupPhaseDistanceWithExtrapolation(table, { mass, pressureAltitude, temperature }, true)

  it('blocks every upper excursion unless the source supports extrapolation', () => {
    const conditions = { mass: 1050, pressureAltitude: 1000, temperature: 10 }
    expect(lookupPhaseDistanceWithExtrapolation(cube, conditions)).toEqual(lookupPhaseDistance(cube, conditions))
    expect(lookupPhaseDistanceWithExtrapolation(cube, conditions).status).toBe('blocked')
  })

  it('matches the raw lookup for every in-envelope or below-minimum-mass point', () => {
    for (const [m, pa, t] of [[900, 1000, 10], [1000, 2000, 20], [800, 0, 0], [650, 1000, 10]] as const) {
      expect(ext(m, pa, t)).toEqual(at(m, pa, t))
    }
  })

  it('penalises the clamped boundary distance by exactly 20 % for each upper axis', () => {
    // Independent expectation: boundary corner means taken by hand from the grid above.
    expect(ext(1100, 2000, 20)).toMatchObject({ status: 'success', distance: 396 * 1.2, extrapolation: { penaltyFactor: 1.2, axes: [{ axis: 'mass', value: 1100, max: 1000, fraction: expect.closeTo(0.1, 12) }] } })
    expect(ext(1000, 2200, 20)).toMatchObject({ distance: 396 * 1.2, extrapolation: { axes: [{ axis: 'pressureAltitude' }] } })
    expect(ext(1000, 2000, 22)).toMatchObject({ distance: 396 * 1.2, extrapolation: { axes: [{ axis: 'temperature' }] } })
    const all = ext(1050, 2100, 21)
    expect(all).toMatchObject({ distance: 396 * 1.2 })
    expect(all.status === 'success' && all.extrapolation?.axes.map((a) => a.axis)).toEqual(['mass', 'pressureAltitude', 'temperature'])
  })

  it('never returns a distance shorter than the unpenalised boundary', () => {
    for (const mass of [1000.001, 1050, 1100]) {
      const result = ext(mass, 2000, 20)
      if (result.status !== 'success') throw new Error('Expected success')
      expect(result.distance).toBeGreaterThan(396)
    }
  })

  it('blocks the first value past 10 % on any axis with the offending axis named', () => {
    expect(ext(1100.001)).toMatchObject({ status: 'blocked', reason: 'extrapolation-beyond-cap', axis: 'mass', range: { min: 800, max: 1000 } })
    expect(ext(900, 2200.001)).toMatchObject({ status: 'blocked', reason: 'extrapolation-beyond-cap', axis: 'pressureAltitude' })
    expect(ext(900, 1000, 22.001)).toMatchObject({ status: 'blocked', reason: 'extrapolation-beyond-cap', axis: 'temperature' })
    // One axis beyond the band blocks even when another is acceptably extrapolated.
    expect(ext(1050, 2300)).toMatchObject({ status: 'blocked', reason: 'extrapolation-beyond-cap' })
  })

  it('keeps lower pressure altitude and temperature blocked, also beside an upper extrapolation', () => {
    expect(ext(900, -1)).toMatchObject({ status: 'blocked', reason: 'pressure-altitude-outside' })
    expect(ext(900, 1000, -1)).toMatchObject({ status: 'blocked', reason: 'temperature-outside' })
    expect(ext(1050, -1)).toMatchObject({ status: 'blocked', reason: 'pressure-altitude-outside' })
  })

  it('blocks a nonpositive axis maximum, where no 10 % band exists', () => {
    const cold: PerformanceCube3D = { ...cube, temperatureAxis: [-20, 0] }
    expect(ext(900, 1000, 0.5, cold)).toMatchObject({ status: 'blocked', reason: 'extrapolation-beyond-cap', axis: 'temperature' })
  })

  it.each([
    ['mass', [[[200, 150], [240, 360]], [[220, 330], [264, 396]]]],
    ['altitude', [[[200, 300], [240, 360]], [[220, 330], [200, 396]]]],
    ['temperature', [[[200, 300], [240, 360]], [[190, 330], [264, 396]]]],
  ] as const)('refuses extrapolation for a table decreasing along %s', (_axis, values) => {
    const table: PerformanceCube3D = { ...cube, values: values.map((a) => a.map((r) => [...r])) }
    expect(ext(1050, 1000, 10, table)).toMatchObject({ status: 'blocked', reason: 'extrapolation-unsupported-table' })
  })

  it('blocks invalid input through the raw policy', () => {
    expect(ext(Number.NaN)).toMatchObject({ status: 'blocked', reason: 'invalid-input' })
    expect(ext(0)).toMatchObject({ status: 'blocked', reason: 'invalid-input' })
  })
})
