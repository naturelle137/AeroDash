/**
 * POH-based take-off & landing distance computation.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * Implements REQ-PF-001 (Distinct Performance Variables — TOR / TOD / LR / LD)
 * and REQ-PF-002 (3-axis linear interpolation over Mass, Pressure Altitude,
 * Temperature) of the aircraft's POH performance tables. Acts as the
 * high-level facade for the v0.4.0 Performance Math Core: callers pass in an
 * `AircraftProfile` plus environmental conditions, and receive either the
 * four interpolated distances or a typed failure indicating *why* no result
 * was produced.
 *
 * Architecture constraint (milestone v0.4.0):
 *   "Performance interpolation must operate solely on pre-validated aircraft
 *    profile data; profile must be in Verified status before performance
 *    computation proceeds."
 *
 * This module is the single enforcement point of that contract — non-Verified
 * profiles are rejected before any math runs. Extrapolation cap, safety-
 * factor application, CAA SSL 07 estimation, and pilot-acknowledgement
 * handling are explicitly OUT of scope here and are implemented in sibling
 * modules so this facade can be composed with them.
 *
 * @see docs/architecture/performance-bilinear-interpolation-contract.md
 */

import { bilinearInterpolate, type PerformanceTable } from './performance.bilinear-interpolation'
import type {
  FlightPhase,
  PerformanceDataPoint,
  PerformanceProfile,
} from '../domain/aircraft.types'
import type { AircraftProfile } from '../adapters/aircraft.schema'

// ── Public types ─────────────────────────────────────────────────────────────

// @IMP-PF-CORE-002@ (FROM: @REQ-PF-002@, @REQ-AD-008@, @REQ-AD-009@)
/**
 * A 3-D performance cube spanning (mass × pressure altitude × temperature).
 *
 * Axis ordering requirement (strictly ascending, no duplicates):
 *   - massAxis        — kg
 *   - altitudeAxis    — ft pressure altitude
 *   - temperatureAxis — °C
 *
 * Value layout:
 *   values[tempIdx][altIdx][massIdx] = distance (m)
 *
 * Each axis must contain at least one entry. A "degenerate" axis with a single
 * entry is supported and reduces interpolation along that axis to a constant
 * — useful for legacy POH tables that publish only one temperature column.
 */
export interface PerformanceCube3D {
  /** Aircraft mass break-points, ascending, in kg. */
  massAxis: number[]
  /** Pressure altitude break-points, ascending, in ft. */
  altitudeAxis: number[]
  /** Temperature break-points, ascending, in °C. */
  temperatureAxis: number[]
  /**
   * Distance values (m). Indexed as values[tempIdx][altIdx][massIdx].
   * Dimensions: temperatureAxis.length × altitudeAxis.length × massAxis.length.
   */
  values: number[][][]
}

/** Input to {@link trilinearInterpolate}. */
export interface TrilinearLookupInput {
  /** Aircraft gross mass (kg). */
  mass: number
  /** Pressure altitude (ft). */
  pressureAltitude: number
  /** Outside air temperature (°C). */
  temperature: number
  /** The 3-D cube to interpolate over. */
  cube: PerformanceCube3D
}

/** Result of {@link trilinearInterpolate}. */
export interface TrilinearLookupResult {
  /** Interpolated distance (m). */
  distance: number
  /** True when the requested mass was outside the cube range and was clamped. */
  massClamped: boolean
  /** True when the requested pressure altitude was outside the cube range and was clamped. */
  altitudeClamped: boolean
  /** True when the requested temperature was outside the cube range and was clamped. */
  temperatureClamped: boolean
}

/** Environmental conditions at the interpolation point. */
export interface PohDistanceConditions {
  /** Aircraft gross mass (kg). */
  mass: number
  /** Pressure altitude (ft). */
  pressureAltitude: number
  /** Outside air temperature (°C). */
  temperature: number
}

/** Per-phase clamping flags. */
export interface PohDistanceClampingFlags {
  massClamped: boolean
  altitudeClamped: boolean
  temperatureClamped: boolean
}

/** The four certified distances returned by {@link computePohDistances}. */
export interface PohDistances {
  /** Takeoff Roll (m). */
  takeoffRoll: number
  /** Takeoff Distance to 50 ft obstacle (m). */
  takeoffDistance50ft: number
  /** Landing Roll (m). */
  landingRoll: number
  /** Landing Distance from 50 ft obstacle (m). */
  landingDistance50ft: number
}

/** Successful result of {@link computePohDistances}. */
export interface PohDistanceSuccess {
  status: 'success'
  distances: PohDistances
  /** Per-phase clamping flags — caller must surface any `true` flag to the pilot. */
  clamping: {
    takeoffRoll: PohDistanceClampingFlags
    takeoffDistance50ft: PohDistanceClampingFlags
    landingRoll: PohDistanceClampingFlags
    landingDistance50ft: PohDistanceClampingFlags
  }
}

/** Why no result was produced. Caller-visible — never escapes as an exception. */
export type PohDistanceFailureReason =
  | 'profile_unverified'
  | 'profile_incomplete'
  | 'invalid_grid'
  | 'invalid_input'

/** Typed failure surface — pure data, no exceptions. */
export interface PohDistanceFailure {
  status: 'failure'
  reason: PohDistanceFailureReason
  /** Free-text diagnostic for the pilot UI / logs. Never includes raw user data. */
  message: string
}

export type PohDistanceResult = PohDistanceSuccess | PohDistanceFailure

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Linear interpolation between two scalars. */
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

/** Clamp `value` to the closed interval [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Locate the surrounding lo/hi indices and interpolation fraction for `value`
 * within a strictly-ascending `axis`. `value` MUST already be clamped to
 * `[axis[0], axis[last]]`. Mirrors {@link findBounds} in the 2-D engine.
 */
function findBounds(axis: number[], value: number): { lo: number; hi: number; t: number } {
  if (axis.length === 1) return { lo: 0, hi: 0, t: 0 }
  for (let i = 0; i < axis.length - 1; i++) {
    const lo = axis[i]!
    const hi = axis[i + 1]!
    if (value <= hi) {
      const span = hi - lo
      const t = span === 0 ? 0 : (value - lo) / span
      return { lo: i, hi: i + 1, t }
    }
  }
  const last = axis.length - 1
  return { lo: last - 1, hi: last, t: 1 }
}

// ── Trilinear interpolation ──────────────────────────────────────────────────

// @IMP-PF-CORE-003@ (FROM: @REQ-PF-002@)
/**
 * Trilinear interpolation over a 3-D performance cube — composes the existing
 * 2-D {@link bilinearInterpolate} engine across the temperature axis.
 *
 * Boundary behaviour: each axis is clamped independently to its [min, max].
 * The clamping flags allow the caller to surface "outside the certified
 * envelope" notifications to the pilot per the milestone's H-007/H-012
 * mitigation track (REQ-PF-010, REQ-PF-012 — handled by sibling modules).
 *
 * Algorithm:
 *   1. Validate cube structure (axis lengths, value-array shape).
 *   2. Clamp inputs to cube bounds; flag any clamping.
 *   3. Resolve the temperature lo/hi slice indices and the t_temp fraction.
 *   4. Run `bilinearInterpolate` on each slice (lo, hi).
 *   5. Lerp the two resulting distances along the temperature axis.
 */
export function trilinearInterpolate(input: TrilinearLookupInput): TrilinearLookupResult {
  const { mass, pressureAltitude, temperature, cube } = input

  if (!Number.isFinite(mass) || !Number.isFinite(pressureAltitude) || !Number.isFinite(temperature)) {
    throw new Error('[PF-TRILINEAR] mass, pressureAltitude, and temperature must be finite numbers.')
  }

  const { massAxis, altitudeAxis, temperatureAxis, values } = cube

  if (massAxis.length < 1) {
    throw new Error('[PF-TRILINEAR] massAxis must have at least 1 entry.')
  }
  if (altitudeAxis.length < 1) {
    throw new Error('[PF-TRILINEAR] altitudeAxis must have at least 1 entry.')
  }
  if (temperatureAxis.length < 1) {
    throw new Error('[PF-TRILINEAR] temperatureAxis must have at least 1 entry.')
  }
  if (values.length !== temperatureAxis.length) {
    throw new Error(
      `[PF-TRILINEAR] values temperature dimension (${values.length}) must match temperatureAxis length (${temperatureAxis.length}).`,
    )
  }
  for (let t = 0; t < values.length; t++) {
    const slice = values[t]!
    if (slice.length !== altitudeAxis.length) {
      throw new Error(
        `[PF-TRILINEAR] values[${t}] altitude dimension (${slice.length}) must match altitudeAxis length (${altitudeAxis.length}).`,
      )
    }
    for (let a = 0; a < slice.length; a++) {
      if (slice[a]!.length !== massAxis.length) {
        throw new Error(
          `[PF-TRILINEAR] values[${t}][${a}] mass dimension (${slice[a]!.length}) must match massAxis length (${massAxis.length}).`,
        )
      }
    }
  }

  const minTemp = temperatureAxis[0]!
  const maxTemp = temperatureAxis[temperatureAxis.length - 1]!
  const minMass = massAxis[0]!
  const maxMass = massAxis[massAxis.length - 1]!
  const minAlt = altitudeAxis[0]!
  const maxAlt = altitudeAxis[altitudeAxis.length - 1]!

  const massClamped = mass < minMass || mass > maxMass
  const altitudeClamped = pressureAltitude < minAlt || pressureAltitude > maxAlt
  const temperatureClamped = temperature < minTemp || temperature > maxTemp

  const clampedMass = clamp(mass, minMass, maxMass)
  const clampedAlt = clamp(pressureAltitude, minAlt, maxAlt)
  const clampedTemp = clamp(temperature, minTemp, maxTemp)

  const { lo: tLoIdx, hi: tHiIdx, t: tTemp } = findBounds(temperatureAxis, clampedTemp)

  // Re-use the 2-D bilinear engine per temperature slice.
  const tableLo: PerformanceTable = {
    massAxis,
    altitudeAxis,
    values: values[tLoIdx]!,
  }
  const tableHi: PerformanceTable = {
    massAxis,
    altitudeAxis,
    values: values[tHiIdx]!,
  }

  const dLo = bilinearInterpolate({
    mass: clampedMass,
    pressureAltitude: clampedAlt,
    table: tableLo,
  }).distance
  const dHi = bilinearInterpolate({
    mass: clampedMass,
    pressureAltitude: clampedAlt,
    table: tableHi,
  }).distance

  const distance = lerp(dLo, dHi, tTemp)

  return { distance, massClamped, altitudeClamped, temperatureClamped }
}

// ── Data-point → cube pivot ──────────────────────────────────────────────────

// @IMP-PF-CORE-004@ (FROM: @REQ-AD-009@, @REQ-PF-002@)
/**
 * Pivot a sparse list of {@link PerformanceDataPoint}s (the storage shape on
 * `AircraftProfile`) into a dense {@link PerformanceCube3D} suitable for
 * trilinear interpolation.
 *
 * Constraints (enforced via thrown `[PF-PIVOT]` errors — caller should catch
 * via the {@link computePohDistances} facade which converts them to typed
 * `failure` results):
 *  - At least one data point per phase.
 *  - All numeric fields finite (NaN/Infinity rejected).
 *  - Every (mass, PA, temp) combination appears at most once (no duplicates).
 *  - The data must form a *regular* 3-D grid: |dataPoints| ===
 *    |unique mass| × |unique PA| × |unique temp|. Irregular layouts are
 *    rejected here in v1 (a follow-up will lift this restriction with a
 *    documented strategy for sparse POH data).
 */
export function pivotDataPointsToCube(dataPoints: readonly PerformanceDataPoint[]): PerformanceCube3D {
  if (dataPoints.length === 0) {
    throw new Error('[PF-PIVOT] dataPoints must contain at least one entry.')
  }

  for (let i = 0; i < dataPoints.length; i++) {
    const dp = dataPoints[i]!
    if (
      !Number.isFinite(dp.distance) ||
      !Number.isFinite(dp.mass) ||
      !Number.isFinite(dp.pressureAltitude) ||
      !Number.isFinite(dp.temperature)
    ) {
      throw new Error(`[PF-PIVOT] dataPoints[${i}] contains a non-finite numeric field.`)
    }
  }

  const massSet = new Set<number>()
  const altSet = new Set<number>()
  const tempSet = new Set<number>()
  for (const dp of dataPoints) {
    massSet.add(dp.mass)
    altSet.add(dp.pressureAltitude)
    tempSet.add(dp.temperature)
  }

  const massAxis = [...massSet].sort((a, b) => a - b)
  const altitudeAxis = [...altSet].sort((a, b) => a - b)
  const temperatureAxis = [...tempSet].sort((a, b) => a - b)

  const expectedCount = massAxis.length * altitudeAxis.length * temperatureAxis.length
  if (dataPoints.length !== expectedCount) {
    throw new Error(
      `[PF-PIVOT] data points do not form a regular grid: expected ${expectedCount} (${temperatureAxis.length}×${altitudeAxis.length}×${massAxis.length}) but found ${dataPoints.length}.`,
    )
  }

  const massIdx = new Map(massAxis.map((v, i) => [v, i]))
  const altIdx = new Map(altitudeAxis.map((v, i) => [v, i]))
  const tempIdx = new Map(temperatureAxis.map((v, i) => [v, i]))

  // values[t][a][m] — NaN-fill so any missing cell is detectable after pivot.
  const values: number[][][] = Array.from({ length: temperatureAxis.length }, () =>
    Array.from({ length: altitudeAxis.length }, () =>
      Array.from({ length: massAxis.length }, () => Number.NaN),
    ),
  )

  for (const dp of dataPoints) {
    const t = tempIdx.get(dp.temperature)!
    const a = altIdx.get(dp.pressureAltitude)!
    const m = massIdx.get(dp.mass)!
    if (!Number.isNaN(values[t]![a]![m])) {
      throw new Error(
        `[PF-PIVOT] duplicate data point at (mass=${dp.mass}, pressureAltitude=${dp.pressureAltitude}, temperature=${dp.temperature}).`,
      )
    }
    values[t]![a]![m] = dp.distance
  }

  // Defensive — a regular-count grid with no duplicates should be fully filled,
  // but explicitly catch malformed sets where pivot somehow left holes.
  for (let t = 0; t < values.length; t++) {
    for (let a = 0; a < values[t]!.length; a++) {
      for (let m = 0; m < values[t]![a]!.length; m++) {
        if (Number.isNaN(values[t]![a]![m]!)) {
          throw new Error(
            `[PF-PIVOT] missing data point at (mass=${massAxis[m]}, pressureAltitude=${altitudeAxis[a]}, temperature=${temperatureAxis[t]}).`,
          )
        }
      }
    }
  }

  return { massAxis, altitudeAxis, temperatureAxis, values }
}

// ── High-level facade (Verified-only) ────────────────────────────────────────

// @IMP-PF-CORE-005@ (FROM: @REQ-PF-001@, @REQ-PF-002@, @REQ-AC-005@)
/**
 * Compute the four certified POH distances (TOR, TOD, LR, LD) for the
 * requested operating point.
 *
 * Preconditions enforced here (each yields a typed `failure`, never throws):
 *  - `profile.status === 'verified'` — Draft profiles are rejected with
 *    `profile_unverified`. This is the single architectural enforcement
 *    point of the milestone constraint and the H-004 / H-011 mitigation
 *    boundary.
 *  - All four `performanceProfiles` entries (`TakeoffRoll`,
 *    `TakeoffDistance50ft`, `LandingRoll`, `LandingDistance50ft`) must be
 *    present with at least one data point each. Missing phases yield
 *    `profile_incomplete` — CAA SSL 07 estimation (REQ-PF-005) covers the
 *    "missing TOR↔TOD or LR↔LD" case in a sibling module and is composed by
 *    P2 before invoking this facade.
 *  - `conditions.{mass, pressureAltitude, temperature}` must all be finite —
 *    a non-finite value yields `invalid_input`.
 *  - Each phase's data points must form a regular 3-D grid (see
 *    {@link pivotDataPointsToCube}). Anything else yields `invalid_grid`.
 *
 * The function is pure: identical inputs always produce identical outputs.
 * It performs no I/O, never throws on valid call sites, and never returns
 * NaN/Infinity distances for any input that survives validation.
 */
export function computePohDistances(
  profile: AircraftProfile,
  conditions: PohDistanceConditions,
): PohDistanceResult {
  if (profile.status !== 'verified') {
    return {
      status: 'failure',
      reason: 'profile_unverified',
      message:
        'Performance computation requires a Verified aircraft profile (current status: ' +
        profile.status +
        ').',
    }
  }

  if (
    !Number.isFinite(conditions.mass) ||
    !Number.isFinite(conditions.pressureAltitude) ||
    !Number.isFinite(conditions.temperature)
  ) {
    return {
      status: 'failure',
      reason: 'invalid_input',
      message: 'mass, pressureAltitude, and temperature must all be finite numbers.',
    }
  }

  const profiles = profile.performanceProfiles ?? []
  const byPhase = new Map<FlightPhase, PerformanceProfile>()
  for (const pp of profiles) {
    byPhase.set(pp.flightPhase, pp)
  }

  const requiredPhases: FlightPhase[] = [
    'TakeoffRoll',
    'TakeoffDistance50ft',
    'LandingRoll',
    'LandingDistance50ft',
  ]
  for (const phase of requiredPhases) {
    const pp = byPhase.get(phase)
    if (!pp || pp.dataPoints.length === 0) {
      return {
        status: 'failure',
        reason: 'profile_incomplete',
        message: `Performance profile for phase "${phase}" is missing or empty.`,
      }
    }
  }

  try {
    const phaseResults: Record<FlightPhase, TrilinearLookupResult> = {
      TakeoffRoll: trilinearInterpolate({
        mass: conditions.mass,
        pressureAltitude: conditions.pressureAltitude,
        temperature: conditions.temperature,
        cube: pivotDataPointsToCube(byPhase.get('TakeoffRoll')!.dataPoints),
      }),
      TakeoffDistance50ft: trilinearInterpolate({
        mass: conditions.mass,
        pressureAltitude: conditions.pressureAltitude,
        temperature: conditions.temperature,
        cube: pivotDataPointsToCube(byPhase.get('TakeoffDistance50ft')!.dataPoints),
      }),
      LandingRoll: trilinearInterpolate({
        mass: conditions.mass,
        pressureAltitude: conditions.pressureAltitude,
        temperature: conditions.temperature,
        cube: pivotDataPointsToCube(byPhase.get('LandingRoll')!.dataPoints),
      }),
      LandingDistance50ft: trilinearInterpolate({
        mass: conditions.mass,
        pressureAltitude: conditions.pressureAltitude,
        temperature: conditions.temperature,
        cube: pivotDataPointsToCube(byPhase.get('LandingDistance50ft')!.dataPoints),
      }),
    }

    return {
      status: 'success',
      distances: {
        takeoffRoll: phaseResults.TakeoffRoll.distance,
        takeoffDistance50ft: phaseResults.TakeoffDistance50ft.distance,
        landingRoll: phaseResults.LandingRoll.distance,
        landingDistance50ft: phaseResults.LandingDistance50ft.distance,
      },
      clamping: {
        takeoffRoll: extractClamping(phaseResults.TakeoffRoll),
        takeoffDistance50ft: extractClamping(phaseResults.TakeoffDistance50ft),
        landingRoll: extractClamping(phaseResults.LandingRoll),
        landingDistance50ft: extractClamping(phaseResults.LandingDistance50ft),
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'failure',
      reason: 'invalid_grid',
      message,
    }
  }
}

function extractClamping(r: TrilinearLookupResult): PohDistanceClampingFlags {
  return {
    massClamped: r.massClamped,
    altitudeClamped: r.altitudeClamped,
    temperatureClamped: r.temperatureClamped,
  }
}
