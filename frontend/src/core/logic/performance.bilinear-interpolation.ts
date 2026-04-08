/**
 * Bilinear interpolation engine for aircraft performance data.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * Used by the performance module (v0.4.0) to derive takeoff and landing
 * distances from 2-D POH lookup tables (mass × pressure altitude → distance).
 *
 * @see docs/architecture/performance-bilinear-interpolation-contract.md
 */

// @IMP-PF-CORE-001@ (FROM: @REQ-PF-002@, @DES-ARCH-006@)

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * A 2-D performance lookup table for one distance type (TOR / TOD / LR / LD).
 *
 * Axis ordering requirement:
 *   - massAxis:     sorted ascending (kg)
 *   - altitudeAxis: sorted ascending (ft pressure altitude)
 *
 * Value layout:
 *   values[altitudeIndex][massIndex] = distance (m)
 *
 * Minimum size: 1 altitude row × 1 mass column.
 */
export interface PerformanceTable {
  /** Aircraft mass break-points, ascending, in kg. */
  massAxis: number[]
  /** Pressure altitude break-points, ascending, in ft. */
  altitudeAxis: number[]
  /**
   * Distance values (m).  Row index = altitude index, column index = mass index.
   * Dimensions must be altitudeAxis.length × massAxis.length.
   */
  values: number[][]
}

/** Input to the bilinear lookup. */
export interface BilinearLookupInput {
  /** Aircraft gross mass at the interpolation point (kg). */
  mass: number
  /** Pressure altitude at the interpolation point (ft). */
  pressureAltitude: number
  /** The 2-D performance table to interpolate over. */
  table: PerformanceTable
}

/** Result returned by bilinearInterpolate(). */
export interface BilinearLookupResult {
  /** Interpolated distance (m). */
  distance: number
  /**
   * True when the requested mass was outside the table range and was clamped
   * to the nearest boundary.  A clamped result is still conservative and safe
   * but callers should surface this to the pilot.
   */
  massClamped: boolean
  /**
   * True when the requested pressure altitude was outside the table range and
   * was clamped to the nearest boundary.
   */
  altitudeClamped: boolean
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Bilinear interpolation over a 2-D performance table.
 *
 * **Boundary behaviour (clamping):**
 * When mass or pressure altitude falls outside the table range the input is
 * silently clamped to the nearest boundary and `massClamped` /
 * `altitudeClamped` is set to `true` in the result.  Clamping is the
 * conservative choice for aviation performance: the boundary entry is
 * normally the highest-energy / most-conservative entry in the table.
 *
 * **Algorithm:**
 *  1. Validate table structure (non-empty axes, value dimensions consistent).
 *  2. Clamp mass and altitude to table bounds.
 *  3. Locate the four surrounding grid points.
 *  4. Linearly interpolate along the mass axis at each altitude level.
 *  5. Linearly interpolate the two results along the altitude axis.
 *
 * @param input - Lookup parameters.
 * @returns Interpolated distance and boundary-clamp flags.
 * @throws Error if the table is structurally invalid.
 */
export function bilinearInterpolate(input: BilinearLookupInput): BilinearLookupResult {
  const { mass, pressureAltitude, table } = input
  const { massAxis, altitudeAxis, values } = table

  // ── Validate table structure ──────────────────────────────────────────────
  if (massAxis.length < 1) {
    throw new Error('[PF-BILINEAR] massAxis must have at least 1 entry.')
  }
  if (altitudeAxis.length < 1) {
    throw new Error('[PF-BILINEAR] altitudeAxis must have at least 1 entry.')
  }
  if (values.length !== altitudeAxis.length) {
    throw new Error(
      `[PF-BILINEAR] values row count (${values.length}) must match altitudeAxis length (${altitudeAxis.length}).`,
    )
  }
  for (let i = 0; i < values.length; i++) {
    if (values[i]!.length !== massAxis.length) {
      throw new Error(
        `[PF-BILINEAR] values[${i}] column count (${values[i]!.length}) must match massAxis length (${massAxis.length}).`,
      )
    }
  }

  // ── Clamp inputs to table bounds ──────────────────────────────────────────
  const minMass = massAxis[0]!
  const maxMass = massAxis[massAxis.length - 1]!
  const minAlt = altitudeAxis[0]!
  const maxAlt = altitudeAxis[altitudeAxis.length - 1]!

  const massClamped = mass < minMass || mass > maxMass
  const altitudeClamped = pressureAltitude < minAlt || pressureAltitude > maxAlt

  const clampedMass = clamp(mass, minMass, maxMass)
  const clampedAlt = clamp(pressureAltitude, minAlt, maxAlt)

  // ── 1×1 degenerate table ─────────────────────────────────────────────────
  if (massAxis.length === 1 && altitudeAxis.length === 1) {
    return { distance: values[0]![0]!, massClamped, altitudeClamped }
  }

  // ── Locate bounding grid indices ──────────────────────────────────────────
  const massBound = findBounds(massAxis, clampedMass)
  const altBound = findBounds(altitudeAxis, clampedAlt)

  const { lo: massLo, hi: massHi, t: tMass } = massBound
  const { lo: altLo, hi: altHi, t: tAlt } = altBound

  // ── Bilinear interpolation ────────────────────────────────────────────────
  //
  //  z11 = value at (altLo, massLo)     z12 = value at (altLo, massHi)
  //  z21 = value at (altHi, massLo)     z22 = value at (altHi, massHi)
  //
  //  Step 1: Interpolate along mass axis at each altitude level.
  //  Step 2: Interpolate the two mass-interpolated values along altitude axis.
  //
  const z11 = values[altLo]![massLo]!
  const z12 = values[altLo]![massHi]!
  const z21 = values[altHi]![massLo]!
  const z22 = values[altHi]![massHi]!

  const zAtAltLo = lerp(z11, z12, tMass)
  const zAtAltHi = lerp(z21, z22, tMass)
  const distance = lerp(zAtAltLo, zAtAltHi, tAlt)

  return { distance, massClamped, altitudeClamped }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Finds the lower bound index, upper bound index, and interpolation fraction
 * `t ∈ [0, 1]` for `value` within a sorted ascending `axis`.
 *
 * Preconditions:
 *   - axis.length ≥ 1
 *   - value has already been clamped to [axis[0], axis[last]]
 */
function findBounds(
  axis: number[],
  value: number,
): { lo: number; hi: number; t: number } {
  if (axis.length === 1) {
    return { lo: 0, hi: 0, t: 0 }
  }

  for (let i = 0; i < axis.length - 1; i++) {
    const lo = axis[i]!
    const hi = axis[i + 1]!
    if (value <= hi) {
      const span = hi - lo
      const t = span === 0 ? 0 : (value - lo) / span
      return { lo: i, hi: i + 1, t }
    }
  }

  // value equals axis[last] (clamping guarantees this is the only remaining case).
  const last = axis.length - 1
  return { lo: last - 1, hi: last, t: 1 }
}

/** Linear interpolation between two scalars. */
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

/** Clamp `value` to the closed interval [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
