/**
 * Raw per-table lookup; see docs/architecture/performance-flight-prep.md.
 * Below-minimum mass retains the boundary distance only for nondecreasing rows.
 * Unsupported altitude, temperature and upper mass excursions remain blocked.
 */

import { trilinearInterpolate, type PerformanceCube3D, type PohDistanceConditions } from './performance.poh-distance'
import { applyExtrapolationPenalty, assessExtrapolation, cubeEnvelopeRanges, EXTRAPOLATION_CAP_FRACTION, type EnvelopeRanges } from './performance.extrapolation'

export type MassTreatment = 'tabulated' | 'benefit-capped'

export type PhaseLookupBlockReason =
  | 'invalid-input'
  | 'pressure-altitude-outside'
  | 'temperature-outside'
  | 'mass-above-table'
  | 'mass-below-table-unsupported'
  | 'invalid-distance'

export type ExtrapolationAxis = keyof EnvelopeRanges

/** One axis requested above its table maximum but within the fixed extrapolation band. */
export interface AxisExtrapolation {
  readonly axis: ExtrapolationAxis
  readonly value: number
  readonly max: number
  /** Excess over the maximum as a fraction of the maximum. */
  readonly fraction: number
}

export type ExtrapolatedLookupBlockReason =
  | PhaseLookupBlockReason
  | 'extrapolation-beyond-cap'
  | 'extrapolation-unsupported-table'

export type PhaseLookupResult =
  | {
    readonly status: 'success'
    /** Metres; unrounded. */
    readonly distance: number
    readonly massTreatment: MassTreatment
    /** Mass actually used for the table lookup (kg). */
    readonly lookupMass: number
    readonly massRange: { readonly min: number; readonly max: number }
  }
  | {
    readonly status: 'blocked'
    readonly reason: PhaseLookupBlockReason
    readonly range: { readonly min: number; readonly max: number } | null
  }

function axisRange(axis: readonly number[]): { min: number; max: number } {
  return { min: axis[0]!, max: axis[axis.length - 1]! }
}

/** True when every (pressure altitude, temperature) row never decreases with mass. */
export function isNonDecreasingInMass(cube: PerformanceCube3D): boolean {
  return cube.values.every((byAltitude) => byAltitude.every((row) =>
    row.every((distance, index) => index === 0 || distance >= row[index - 1]!)))
}

/** Look up one validated, normalized table (kg, ft, °C, m). Never throws for finite grids. */
export function lookupPhaseDistance(cube: PerformanceCube3D, conditions: PohDistanceConditions): PhaseLookupResult {
  const { mass, pressureAltitude, temperature } = conditions
  if (![mass, pressureAltitude, temperature].every(Number.isFinite) || mass <= 0) {
    return { status: 'blocked', reason: 'invalid-input', range: null }
  }
  const altitude = axisRange(cube.altitudeAxis)
  if (pressureAltitude < altitude.min || pressureAltitude > altitude.max) {
    return { status: 'blocked', reason: 'pressure-altitude-outside', range: altitude }
  }
  const temperatures = axisRange(cube.temperatureAxis)
  if (temperature < temperatures.min || temperature > temperatures.max) {
    return { status: 'blocked', reason: 'temperature-outside', range: temperatures }
  }
  const massRange = axisRange(cube.massAxis)
  if (mass > massRange.max) return { status: 'blocked', reason: 'mass-above-table', range: massRange }
  const capped = mass < massRange.min
  if (capped && !isNonDecreasingInMass(cube)) {
    return { status: 'blocked', reason: 'mass-below-table-unsupported', range: massRange }
  }
  const lookupMass = capped ? massRange.min : mass
  const { distance } = trilinearInterpolate({ mass: lookupMass, pressureAltitude, temperature, cube })
  if (!Number.isFinite(distance) || distance <= 0) return { status: 'blocked', reason: 'invalid-distance', range: null }
  return { status: 'success', distance, massTreatment: capped ? 'benefit-capped' : 'tabulated', lookupMass, massRange }
}

function isNonDecreasingAlong(cube: PerformanceCube3D, axis: 'temperature' | 'altitude'): boolean {
  return cube.values.every((byAltitude, t) => byAltitude.every((row, a) => row.every((distance, m) =>
    (axis === 'temperature' ? t === 0 || distance >= cube.values[t - 1]![a]![m]! : a === 0 || distance >= byAltitude[a - 1]![m]!))))
}

export type ExtrapolatedLookupResult =
  | (Extract<PhaseLookupResult, { status: 'success' }> & {
    /** Present only when an upper axis was extrapolated; the distance already includes the penalty. */
    readonly extrapolation?: { readonly penaltyFactor: number; readonly axes: readonly AxisExtrapolation[] }
  })
  | {
    readonly status: 'blocked'
    readonly reason: ExtrapolatedLookupBlockReason
    readonly range: { readonly min: number; readonly max: number } | null
    readonly axis?: ExtrapolationAxis
  }

/**
 * Look up one table and extrapolate above the maximum of mass, pressure altitude or temperature by at most
 * the fixed 10 % band, applying the fixed 20 % penalty to the boundary distance. Lower pressure altitude
 * and temperature stay blocked, below-minimum mass keeps the benefit cap, and extrapolation is refused
 * unless the table never decreases along any axis (the assumption that makes the penalty conservative).
 */
export function lookupPhaseDistanceWithExtrapolation(cube: PerformanceCube3D, conditions: PohDistanceConditions): ExtrapolatedLookupResult {
  const { mass, pressureAltitude, temperature } = conditions
  if (![mass, pressureAltitude, temperature].every(Number.isFinite) || mass <= 0) return lookupPhaseDistance(cube, conditions)
  const ranges = cubeEnvelopeRanges(cube)
  const assessment = assessExtrapolation(conditions, ranges)
  const axes = (['mass', 'pressureAltitude', 'temperature'] as const).flatMap((axis): AxisExtrapolation[] => {
    const { direction, worseFraction } = assessment.axes[axis]
    return direction === 'worse' ? [{ axis, value: conditions[axis], max: ranges[axis].max, fraction: worseFraction }] : []
  })
  if (axes.length === 0) return lookupPhaseDistance(cube, conditions)
  const beyond = axes.find((item) => item.fraction > EXTRAPOLATION_CAP_FRACTION)
  if (beyond) return { status: 'blocked', reason: 'extrapolation-beyond-cap', range: ranges[beyond.axis], axis: beyond.axis }
  if (!isNonDecreasingInMass(cube) || !isNonDecreasingAlong(cube, 'temperature') || !isNonDecreasingAlong(cube, 'altitude')) {
    return { status: 'blocked', reason: 'extrapolation-unsupported-table', range: null }
  }
  const clamped = {
    mass: Math.min(mass, ranges.mass.max),
    pressureAltitude: Math.min(pressureAltitude, ranges.pressureAltitude.max),
    temperature: Math.min(temperature, ranges.temperature.max),
  }
  const base = lookupPhaseDistance(cube, clamped)
  if (base.status === 'blocked') return base
  return {
    ...base,
    distance: applyExtrapolationPenalty(base.distance, assessment),
    extrapolation: { penaltyFactor: assessment.penaltyFactor, axes },
  }
}
