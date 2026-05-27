/**
 * Unit tests for the POH distance facade — trilinear interpolation, sparse
 * data-point → cube pivot, and the Verified-status gate.
 *
 * @see performance.poh-distance.ts
 */

// @UT-PF-CORE-041@ (FROM: @IMP-PF-CORE-002@, @IMP-PF-CORE-003@, @IMP-PF-CORE-004@, @IMP-PF-CORE-005@)

import { describe, it, expect } from 'vitest'
import { AircraftProfileSchema, type AircraftProfile } from '../adapters/aircraft.schema'
import {
  computePohDistances,
  pivotDataPointsToCube,
  trilinearInterpolate,
  type PerformanceCube3D,
  type PohDistanceConditions,
} from './performance.poh-distance'
import type { PerformanceDataPoint } from '../domain/aircraft.types'

// ── Trilinear engine fixtures ────────────────────────────────────────────────

const MASS_AXIS = [850, 1000, 1157]
const ALT_AXIS = [0, 2000, 4000, 6000]
const TEMP_AXIS = [-20, 0, 20, 40]

/**
 * Canonical TOR (Takeoff Roll) 3-D cube — temperature dimension extends the
 * v0.3.0 2-D table with a documented ISA-style scale factor:
 *   slice(-20 °C) = 0.85 × slice(0 °C)
 *   slice(  0 °C) = baseline v0.3.0 TOR table
 *   slice( 20 °C) = 1.15 × slice(0 °C)
 *   slice( 40 °C) = 1.30 × slice(0 °C)
 * Values are aviation-realistic and self-consistent so manual hand-checks
 * cross-validate the trilinear math.
 */
const TOR_CUBE: PerformanceCube3D = {
  massAxis: MASS_AXIS,
  altitudeAxis: ALT_AXIS,
  temperatureAxis: TEMP_AXIS,
  values: [
    // T = -20 °C
    [
      [178.5, 229.5, 289.0],
      [216.75, 276.25, 348.5],
      [259.25, 331.5, 416.5],
      [310.25, 395.25, 497.25],
    ],
    // T = 0 °C — baseline
    [
      [210, 270, 340],
      [255, 325, 410],
      [305, 390, 490],
      [365, 465, 585],
    ],
    // T = 20 °C
    [
      [241.5, 310.5, 391.0],
      [293.25, 373.75, 471.5],
      [350.75, 448.5, 563.5],
      [419.75, 534.75, 672.75],
    ],
    // T = 40 °C
    [
      [273, 351, 442],
      [331.5, 422.5, 533],
      [396.5, 507, 637],
      [474.5, 604.5, 760.5],
    ],
  ],
}

const conditions = (
  mass: number,
  pa: number,
  temperature: number,
): PohDistanceConditions => ({ mass, pressureAltitude: pa, temperature })

// ── trilinearInterpolate ─────────────────────────────────────────────────────

describe('trilinearInterpolate — temperature axis', () => {
  it('VEC-TRI-001: exact grid point in all 3 axes (850 kg, 0 ft, 0 °C) → 210 m', () => {
    const r = trilinearInterpolate({
      mass: 850,
      pressureAltitude: 0,
      temperature: 0,
      cube: TOR_CUBE,
    })
    expect(r.distance).toBeCloseTo(210, 5)
    expect(r.massClamped).toBe(false)
    expect(r.altitudeClamped).toBe(false)
    expect(r.temperatureClamped).toBe(false)
  })

  it('VEC-TRI-002: exact grid in mass/PA, temperature midpoint 0–20 °C at (850 kg, 0 ft, 10 °C)', () => {
    // slice(0): 210; slice(20): 241.5 → lerp(210, 241.5, 0.5) = 225.75
    const r = trilinearInterpolate({
      mass: 850,
      pressureAltitude: 0,
      temperature: 10,
      cube: TOR_CUBE,
    })
    expect(r.distance).toBeCloseTo(225.75, 5)
    expect(r.temperatureClamped).toBe(false)
  })

  it('VEC-TRI-003: full trilinear at (925 kg, 1000 ft, 10 °C)', () => {
    // slice(0)  bilinear(925,1000) = 265
    // slice(20) bilinear(925,1000) = 304.75
    // lerp(265, 304.75, 0.5) = 284.875
    const r = trilinearInterpolate({
      mass: 925,
      pressureAltitude: 1000,
      temperature: 10,
      cube: TOR_CUBE,
    })
    expect(r.distance).toBeCloseTo(284.875, 5)
    expect(r.massClamped).toBe(false)
    expect(r.altitudeClamped).toBe(false)
    expect(r.temperatureClamped).toBe(false)
  })

  it('VEC-TRI-004: temperature above max (1000 kg, 2000 ft, 50 °C) clamps to slice(40 °C)', () => {
    // slice(40) bilinear(1000, 2000) = exact grid 422.5
    const r = trilinearInterpolate({
      mass: 1000,
      pressureAltitude: 2000,
      temperature: 50,
      cube: TOR_CUBE,
    })
    expect(r.distance).toBeCloseTo(422.5, 5)
    expect(r.temperatureClamped).toBe(true)
    expect(r.massClamped).toBe(false)
    expect(r.altitudeClamped).toBe(false)
  })

  it('VEC-TRI-005: temperature below min (1000 kg, 2000 ft, -30 °C) clamps to slice(-20 °C)', () => {
    const r = trilinearInterpolate({
      mass: 1000,
      pressureAltitude: 2000,
      temperature: -30,
      cube: TOR_CUBE,
    })
    expect(r.distance).toBeCloseTo(276.25, 5)
    expect(r.temperatureClamped).toBe(true)
  })

  it('VEC-TRI-006: all three axes clamped (1300 kg, 9000 ft, 100 °C) → upper-corner value', () => {
    // upper-corner = values[3][3][2] = 760.5
    const r = trilinearInterpolate({
      mass: 1300,
      pressureAltitude: 9000,
      temperature: 100,
      cube: TOR_CUBE,
    })
    expect(r.distance).toBeCloseTo(760.5, 5)
    expect(r.massClamped).toBe(true)
    expect(r.altitudeClamped).toBe(true)
    expect(r.temperatureClamped).toBe(true)
  })

  it('VEC-TRI-007: degenerate temperature axis (single slice) — behaves like 2-D bilinear', () => {
    const cube: PerformanceCube3D = {
      massAxis: MASS_AXIS,
      altitudeAxis: ALT_AXIS,
      temperatureAxis: [15],
      values: [
        [
          [210, 270, 340],
          [255, 325, 410],
          [305, 390, 490],
          [365, 465, 585],
        ],
      ],
    }
    const r = trilinearInterpolate({
      mass: 925,
      pressureAltitude: 1000,
      temperature: 999, // any temperature: degenerate axis ignores it after clamp
      cube,
    })
    expect(r.distance).toBeCloseTo(265, 5)
    expect(r.temperatureClamped).toBe(true)
  })

  it('VEC-TRI-008: rejects non-finite inputs', () => {
    expect(() =>
      trilinearInterpolate({
        mass: Number.NaN,
        pressureAltitude: 0,
        temperature: 0,
        cube: TOR_CUBE,
      }),
    ).toThrow('[PF-TRILINEAR]')
    expect(() =>
      trilinearInterpolate({
        mass: 1000,
        pressureAltitude: Number.POSITIVE_INFINITY,
        temperature: 0,
        cube: TOR_CUBE,
      }),
    ).toThrow('[PF-TRILINEAR]')
    expect(() =>
      trilinearInterpolate({
        mass: 1000,
        pressureAltitude: 0,
        temperature: Number.NaN,
        cube: TOR_CUBE,
      }),
    ).toThrow('[PF-TRILINEAR]')
  })

  it('VEC-TRI-009: rejects malformed cube — empty mass axis', () => {
    expect(() =>
      trilinearInterpolate({
        mass: 1000,
        pressureAltitude: 0,
        temperature: 0,
        cube: { massAxis: [], altitudeAxis: [0], temperatureAxis: [0], values: [[[]]] },
      }),
    ).toThrow('[PF-TRILINEAR]')
  })

  it('VEC-TRI-010: rejects malformed cube — empty altitude axis', () => {
    expect(() =>
      trilinearInterpolate({
        mass: 1000,
        pressureAltitude: 0,
        temperature: 0,
        cube: { massAxis: [1000], altitudeAxis: [], temperatureAxis: [0], values: [[]] },
      }),
    ).toThrow('[PF-TRILINEAR]')
  })

  it('VEC-TRI-011: rejects malformed cube — empty temperature axis', () => {
    expect(() =>
      trilinearInterpolate({
        mass: 1000,
        pressureAltitude: 0,
        temperature: 0,
        cube: { massAxis: [1000], altitudeAxis: [0], temperatureAxis: [], values: [] },
      }),
    ).toThrow('[PF-TRILINEAR]')
  })

  it('VEC-TRI-012: rejects malformed cube — wrong temperature dimension count', () => {
    expect(() =>
      trilinearInterpolate({
        mass: 1000,
        pressureAltitude: 0,
        temperature: 0,
        cube: {
          massAxis: [1000],
          altitudeAxis: [0],
          temperatureAxis: [0, 20],
          values: [[[300]]], // only 1 slice but 2 temperatures
        },
      }),
    ).toThrow('[PF-TRILINEAR]')
  })

  it('VEC-TRI-013: rejects malformed cube — wrong altitude dimension per slice', () => {
    expect(() =>
      trilinearInterpolate({
        mass: 1000,
        pressureAltitude: 0,
        temperature: 0,
        cube: {
          massAxis: [1000],
          altitudeAxis: [0, 2000],
          temperatureAxis: [0],
          values: [[[300]]], // 1 alt row but axis declares 2
        },
      }),
    ).toThrow('[PF-TRILINEAR]')
  })

  it('VEC-TRI-014: rejects malformed cube — wrong mass dimension per row', () => {
    expect(() =>
      trilinearInterpolate({
        mass: 1000,
        pressureAltitude: 0,
        temperature: 0,
        cube: {
          massAxis: [850, 1157],
          altitudeAxis: [0],
          temperatureAxis: [0],
          values: [[[300]]], // 1 col but axis declares 2
        },
      }),
    ).toThrow('[PF-TRILINEAR]')
  })
})

// ── pivotDataPointsToCube ────────────────────────────────────────────────────

describe('pivotDataPointsToCube', () => {
  function makeRegularGrid(): PerformanceDataPoint[] {
    const out: PerformanceDataPoint[] = []
    const masses = [850, 1000]
    const alts = [0, 2000]
    const temps = [0, 20]
    let i = 0
    for (const t of temps) {
      for (const a of alts) {
        for (const m of masses) {
          out.push({ mass: m, pressureAltitude: a, temperature: t, distance: 100 + i })
          i++
        }
      }
    }
    return out
  }

  it('pivots a regular 2×2×2 grid in any order', () => {
    const points = makeRegularGrid()
    // Shuffle deterministically
    const shuffled = [
      points[7]!,
      points[2]!,
      points[5]!,
      points[0]!,
      points[6]!,
      points[1]!,
      points[4]!,
      points[3]!,
    ]
    const cube = pivotDataPointsToCube(shuffled)
    expect(cube.massAxis).toEqual([850, 1000])
    expect(cube.altitudeAxis).toEqual([0, 2000])
    expect(cube.temperatureAxis).toEqual([0, 20])
    // values[t][a][m] — original index = t*4 + a*2 + m
    expect(cube.values[0]![0]![0]).toBe(100)
    expect(cube.values[0]![0]![1]).toBe(101)
    expect(cube.values[0]![1]![0]).toBe(102)
    expect(cube.values[0]![1]![1]).toBe(103)
    expect(cube.values[1]![0]![0]).toBe(104)
    expect(cube.values[1]![0]![1]).toBe(105)
    expect(cube.values[1]![1]![0]).toBe(106)
    expect(cube.values[1]![1]![1]).toBe(107)
  })

  it('rejects an empty data-point list', () => {
    expect(() => pivotDataPointsToCube([])).toThrow('[PF-PIVOT]')
  })

  it('rejects a data point with a non-finite numeric field', () => {
    const points: PerformanceDataPoint[] = [
      { mass: 850, pressureAltitude: 0, temperature: 0, distance: Number.NaN },
    ]
    expect(() => pivotDataPointsToCube(points)).toThrow('[PF-PIVOT]')
  })

  it('rejects an irregular grid (missing one combination)', () => {
    const points = makeRegularGrid().slice(0, -1) // 7/8 points
    expect(() => pivotDataPointsToCube(points)).toThrow('[PF-PIVOT]')
  })

  it('rejects an irregular grid that has the right count but wrong shape', () => {
    // 2×2 mass + 2 alt + 2 temp would be 8 — substitute one (mass, alt, temp)
    // with a brand-new mass value, producing 9 unique masses÷but only 8 points.
    const points = makeRegularGrid()
    points[0] = { ...points[0]!, mass: 999 } // introduces a 3rd mass; total points still 8
    expect(() => pivotDataPointsToCube(points)).toThrow('[PF-PIVOT]')
  })

  it('rejects duplicate (mass, PA, temperature) entries', () => {
    const points = makeRegularGrid()
    points[7] = { ...points[0]! } // duplicate the first point
    expect(() => pivotDataPointsToCube(points)).toThrow('[PF-PIVOT]')
  })

  it('accepts a 1×1×1 degenerate grid', () => {
    const points: PerformanceDataPoint[] = [
      { mass: 1000, pressureAltitude: 0, temperature: 15, distance: 300 },
    ]
    const cube = pivotDataPointsToCube(points)
    expect(cube.values).toEqual([[[300]]])
  })

  it('round-trips through trilinearInterpolate at an exact grid point', () => {
    const points = makeRegularGrid()
    const cube = pivotDataPointsToCube(points)
    const r = trilinearInterpolate({
      mass: 1000,
      pressureAltitude: 2000,
      temperature: 20,
      cube,
    })
    expect(r.distance).toBe(107)
  })
})

// ── computePohDistances (Verified gate + facade) ─────────────────────────────

/** Synthesize a 2×2×2 cube for one phase by scaling a base value. */
function phaseDataPoints(base: number): PerformanceDataPoint[] {
  const out: PerformanceDataPoint[] = []
  const masses = [850, 1000]
  const alts = [0, 2000]
  const temps = [0, 20]
  for (const t of temps) {
    for (const a of alts) {
      for (const m of masses) {
        // Distance grows with mass, altitude, and temperature in a
        // deterministic, monotone way — produces a unique value per cell.
        const d = base * (m / 850) * (1 + a / 10000) * (1 + t / 200)
        out.push({ mass: m, pressureAltitude: a, temperature: t, distance: d })
      }
    }
  }
  return out
}

function buildVerifiedProfile(): AircraftProfile {
  const raw = {
    id: '00000000-0000-4000-a000-000000000099',
    ownerId: 'user-perf',
    registration: 'D-TEST',
    manufacturer: 'Test',
    model: 'PF Trainer',
    icaoTypeDesignator: 'C172',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Datum',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'verified',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 700, emptyCg: 1.5, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 110,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 1157,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.4, mass: 600 },
          { armOrMoment: 1.4, mass: 1157 },
          { armOrMoment: 2.0, mass: 1157 },
          { armOrMoment: 2.0, mass: 600 },
        ],
      },
    ],
    performanceProfiles: [
      { flightPhase: 'TakeoffRoll', dataPoints: phaseDataPoints(210) },
      { flightPhase: 'TakeoffDistance50ft', dataPoints: phaseDataPoints(340) },
      { flightPhase: 'LandingRoll', dataPoints: phaseDataPoints(185) },
      { flightPhase: 'LandingDistance50ft', dataPoints: phaseDataPoints(315) },
    ],
  }
  return AircraftProfileSchema.parse(raw)
}

describe('computePohDistances — Verified-status gate', () => {
  it('rejects a Draft profile with reason "profile_unverified"', () => {
    const verified = buildVerifiedProfile()
    const draft: AircraftProfile = { ...verified, status: 'draft' }
    const result = computePohDistances(draft, conditions(925, 1000, 10))
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('profile_unverified')
    expect(result.message).toContain('Verified')
  })

  it('accepts a Verified profile and returns all four distances', () => {
    const profile = buildVerifiedProfile()
    const result = computePohDistances(profile, conditions(850, 0, 0))
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.distances.takeoffRoll).toBeCloseTo(210, 5)
    expect(result.distances.takeoffDistance50ft).toBeCloseTo(340, 5)
    expect(result.distances.landingRoll).toBeCloseTo(185, 5)
    expect(result.distances.landingDistance50ft).toBeCloseTo(315, 5)
  })

  it('returns per-phase clamping flags when inputs are outside the cube', () => {
    const profile = buildVerifiedProfile()
    const result = computePohDistances(profile, conditions(2000, 12000, 80))
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    for (const phase of [
      'takeoffRoll',
      'takeoffDistance50ft',
      'landingRoll',
      'landingDistance50ft',
    ] as const) {
      expect(result.clamping[phase].massClamped).toBe(true)
      expect(result.clamping[phase].altitudeClamped).toBe(true)
      expect(result.clamping[phase].temperatureClamped).toBe(true)
    }
  })

  it('does not flag clamping when inputs fall inside every cube axis', () => {
    const profile = buildVerifiedProfile()
    const result = computePohDistances(profile, conditions(900, 500, 5))
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.clamping.takeoffRoll.massClamped).toBe(false)
    expect(result.clamping.takeoffRoll.altitudeClamped).toBe(false)
    expect(result.clamping.takeoffRoll.temperatureClamped).toBe(false)
  })
})

describe('computePohDistances — profile_incomplete', () => {
  it('returns "profile_incomplete" when performanceProfiles is undefined', () => {
    const profile = buildVerifiedProfile()
    const incomplete: AircraftProfile = { ...profile, performanceProfiles: undefined }
    const result = computePohDistances(incomplete, conditions(900, 0, 15))
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('profile_incomplete')
  })

  it('returns "profile_incomplete" when a phase is missing', () => {
    const profile = buildVerifiedProfile()
    const incomplete: AircraftProfile = {
      ...profile,
      performanceProfiles: profile.performanceProfiles!.filter(
        (p) => p.flightPhase !== 'LandingRoll',
      ),
    }
    const result = computePohDistances(incomplete, conditions(900, 0, 15))
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('profile_incomplete')
    expect(result.message).toContain('LandingRoll')
  })

  it('returns "profile_incomplete" when a phase has zero data points', () => {
    const profile = buildVerifiedProfile()
    const incomplete: AircraftProfile = {
      ...profile,
      performanceProfiles: profile.performanceProfiles!.map((p) =>
        p.flightPhase === 'TakeoffRoll' ? { ...p, dataPoints: [] } : p,
      ),
    }
    const result = computePohDistances(incomplete, conditions(900, 0, 15))
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('profile_incomplete')
    expect(result.message).toContain('TakeoffRoll')
  })
})

describe('computePohDistances — invalid input + grid', () => {
  it('returns "invalid_input" for NaN mass', () => {
    const result = computePohDistances(buildVerifiedProfile(), conditions(Number.NaN, 0, 0))
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('invalid_input')
  })

  it('returns "invalid_input" for Infinity pressureAltitude', () => {
    const result = computePohDistances(
      buildVerifiedProfile(),
      conditions(900, Number.POSITIVE_INFINITY, 0),
    )
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('invalid_input')
  })

  it('returns "invalid_input" for NaN temperature', () => {
    const result = computePohDistances(buildVerifiedProfile(), conditions(900, 0, Number.NaN))
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('invalid_input')
  })

  it('returns "invalid_grid" when a phase has an irregular data-point set', () => {
    const profile = buildVerifiedProfile()
    const broken: AircraftProfile = {
      ...profile,
      performanceProfiles: profile.performanceProfiles!.map((p) =>
        p.flightPhase === 'TakeoffRoll'
          ? { ...p, dataPoints: p.dataPoints.slice(0, -1) } // drop one cell
          : p,
      ),
    }
    const result = computePohDistances(broken, conditions(900, 0, 10))
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('invalid_grid')
  })
})
