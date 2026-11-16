/**
 * Raw per-table lookup; see docs/architecture/performance-flight-prep.md.
 * Below-minimum mass retains the boundary distance only for nondecreasing rows.
 * Unsupported altitude, temperature and upper mass excursions remain blocked.
 */

import { trilinearInterpolate, type PerformanceCube3D, type PohDistanceConditions } from './performance.poh-distance'

export type MassTreatment = 'tabulated' | 'benefit-capped'

export type PhaseLookupBlockReason =
  | 'invalid-input'
  | 'pressure-altitude-outside'
  | 'temperature-outside'
  | 'mass-above-table'
  | 'mass-below-table-unsupported'
  | 'invalid-distance'

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
