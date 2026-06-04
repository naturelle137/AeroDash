/**
 * Conservative extrapolation control for POH performance distances.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * Sibling to {@link ./performance.poh-distance}. The trilinear engine *clamps*
 * an out-of-envelope operating point to the nearest POH boundary and only
 * reports a boolean clamp flag; it never decides whether that excursion is
 * survivable. This module is that decision layer:
 *
 *   - Beyond the certified envelope toward *worse* conditions (higher mass, PA,
 *     or temperature) extrapolation is permitted only up to a fixed 10% of the
 *     boundary value, with a fixed +20% distance penalty applied to the clamped
 *     boundary distance (REQ-PF-010 / H-007, H-012).
 *   - Past that 10% band computation is BLOCKED — no distance is returned at all
 *     (REQ-PF-010 / H-012).
 *   - Toward *better* conditions (below the envelope minimum) no benefit is
 *     granted: the distance is floored at the best-case POH value and can never
 *     come out shorter than the documented minimum (REQ-PF-011 / H-013,
 *     "Minimum Distance Rule").
 *   - Any permitted extrapolation flags the result as requiring explicit
 *     pilot-in-command acknowledgment before it may be used (REQ-PF-012 / H-012).
 *
 * Monotonicity assumption: for all four POH distance types required distance is
 * non-decreasing in mass, pressure altitude, and temperature — so "above the
 * axis maximum" is always the conservative-penalty direction and "below the
 * axis minimum" is always the benefit (floor) direction.
 *
 * @see ./performance.poh-distance
 * @see docs/requirements/performance.md
 */

import type { PohDistanceConditions, PerformanceCube3D } from './performance.poh-distance'

// ── Immutable safety constants ───────────────────────────────────────────────

// @IMP-PF-CORE-006@ (FROM: @REQ-PF-010@)
/**
 * Maximum permitted extrapolation past a POH axis boundary, as a fraction of
 * that boundary value (10%). Beyond this, computation is blocked.
 */
export const EXTRAPOLATION_CAP_FRACTION = 0.1

/** Fixed safety penalty applied to any extrapolated distance (+20%). */
export const EXTRAPOLATION_PENALTY_FRACTION = 0.2

/**
 * Frozen aggregate of the two governing constants. These are fixed by
 * regulation intent and MUST NOT be made user-configurable — the freeze makes
 * accidental runtime mutation fail loudly in strict mode.
 */
export const EXTRAPOLATION_LIMITS = Object.freeze({
  capFraction: EXTRAPOLATION_CAP_FRACTION,
  penaltyFraction: EXTRAPOLATION_PENALTY_FRACTION,
} as const)

// ── Public types ─────────────────────────────────────────────────────────────

/** Inclusive min/max of one POH interpolation axis. */
export interface AxisRange {
  /** Lowest tabulated break-point on the axis. */
  readonly min: number
  /** Highest tabulated break-point on the axis. */
  readonly max: number
}

/** The three POH interpolation axes, paired with the requested operating point. */
export interface EnvelopeRanges {
  /** Mass axis range (kg). */
  readonly mass: AxisRange
  /** Pressure altitude axis range (ft). */
  readonly pressureAltitude: AxisRange
  /** Temperature axis range (°C). */
  readonly temperature: AxisRange
}

/** Where a requested value sits relative to one axis. */
export type ExcursionDirection = 'within' | 'worse' | 'better'

/** Classification of a single axis excursion. */
export interface AxisExcursion {
  readonly direction: ExcursionDirection
  /**
   * Excursion past the axis maximum, as a fraction of that maximum. Zero unless
   * `direction === 'worse'`; `Infinity` when the maximum is not strictly
   * positive (no finite extrapolation band can be defined → always blocked).
   */
  readonly worseFraction: number
  /** True when a `worse` excursion exceeds {@link EXTRAPOLATION_CAP_FRACTION}. */
  readonly beyondCap: boolean
}

/** Overall extrapolation state for an operating point. */
export type ExtrapolationState = 'within_envelope' | 'extrapolated' | 'blocked'

/** Result of {@link assessExtrapolation}. */
export interface ExtrapolationAssessment {
  readonly state: ExtrapolationState
  /** True iff `state === 'extrapolated'` — the REQ-PF-012 acknowledgment gate. */
  readonly requiresAcknowledgment: boolean
  /** True when at least one axis was floored at its best-case POH value. */
  readonly benefitCapped: boolean
  /** Distance multiplier: `1.2` when extrapolated, otherwise `1`. Never < 1. */
  readonly penaltyFactor: number
  readonly axes: {
    readonly mass: AxisExcursion
    readonly pressureAltitude: AxisExcursion
    readonly temperature: AxisExcursion
  }
}

/** A usable extrapolation result with a concrete distance. */
export interface ExtrapolationResolvedOk {
  readonly state: 'within_envelope' | 'extrapolated'
  /** Penalised distance (m). Never shorter than `baseDistance`. */
  readonly distance: number
  readonly requiresAcknowledgment: boolean
  readonly benefitCapped: boolean
  readonly assessment: ExtrapolationAssessment
}

/** A blocked extrapolation result — by construction it carries no distance. */
export interface ExtrapolationResolvedBlocked {
  readonly state: 'blocked'
  readonly reason: 'extrapolation_exceeds_cap' | 'invalid_input'
  readonly message: string
  /** Present for `extrapolation_exceeds_cap`; `null` when inputs were unusable. */
  readonly assessment: ExtrapolationAssessment | null
}

export type ExtrapolationResolved = ExtrapolationResolvedOk | ExtrapolationResolvedBlocked

// ── Axis classification ──────────────────────────────────────────────────────

// @IMP-PF-CORE-007@ (FROM: @REQ-PF-010@, @REQ-PF-011@)
/**
 * Classify where `value` sits relative to one POH axis.
 *
 * Precondition: `value` is finite and `range.min <= range.max` with finite
 * bounds — a structural violation throws `[PF-EXTRAP]` (mirrors the sibling
 * engine's fail-loud contract for malformed grids).
 */
export function classifyAxisExcursion(value: number, range: AxisRange): AxisExcursion {
  const { min, max } = range
  if (!Number.isFinite(value)) {
    throw new Error('[PF-EXTRAP] axis value must be a finite number.')
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('[PF-EXTRAP] axis range bounds must be finite numbers.')
  }
  if (min > max) {
    throw new Error(`[PF-EXTRAP] axis range min (${min}) must not exceed max (${max}).`)
  }

  if (value > max) {
    // A 10% band is only meaningful relative to a strictly positive bound; a
    // non-positive maximum (degenerate/sea-level axis) admits no extrapolation.
    const worseFraction = max > 0 ? (value - max) / max : Number.POSITIVE_INFINITY
    return { direction: 'worse', worseFraction, beyondCap: worseFraction > EXTRAPOLATION_CAP_FRACTION }
  }
  if (value < min) {
    return { direction: 'better', worseFraction: 0, beyondCap: false }
  }
  return { direction: 'within', worseFraction: 0, beyondCap: false }
}

// ── Aggregate assessment ─────────────────────────────────────────────────────

// @IMP-PF-CORE-008@ (FROM: @REQ-PF-010@, @REQ-PF-011@, @REQ-PF-012@)
/**
 * Assess the combined extrapolation state across all three axes.
 *
 * Aggregation is conservative: a single axis beyond the cap blocks the whole
 * computation; any worse-but-within-cap axis marks the result extrapolated
 * (penalty + acknowledgment); a below-minimum axis only flags `benefitCapped`.
 *
 * Precondition (same as {@link classifyAxisExcursion}): finite conditions and
 * valid ranges. The fail-safe wrapper is {@link resolveExtrapolatedDistance}.
 */
export function assessExtrapolation(
  conditions: PohDistanceConditions,
  ranges: EnvelopeRanges,
): ExtrapolationAssessment {
  const mass = classifyAxisExcursion(conditions.mass, ranges.mass)
  const pressureAltitude = classifyAxisExcursion(conditions.pressureAltitude, ranges.pressureAltitude)
  const temperature = classifyAxisExcursion(conditions.temperature, ranges.temperature)
  const axes = { mass, pressureAltitude, temperature }
  const list = [mass, pressureAltitude, temperature]

  const blocked = list.some((a) => a.direction === 'worse' && a.beyondCap)
  const extrapolated = !blocked && list.some((a) => a.direction === 'worse')
  const benefitCapped = list.some((a) => a.direction === 'better')

  const state: ExtrapolationState = blocked
    ? 'blocked'
    : extrapolated
      ? 'extrapolated'
      : 'within_envelope'

  return {
    state,
    requiresAcknowledgment: extrapolated,
    benefitCapped,
    penaltyFactor: extrapolated ? 1 + EXTRAPOLATION_PENALTY_FRACTION : 1,
    axes,
  }
}

// ── Penalty application ──────────────────────────────────────────────────────

// @IMP-PF-CORE-009@ (FROM: @REQ-PF-010@, @REQ-PF-011@)
/**
 * Apply an assessment's penalty to a base (clamped) POH distance.
 *
 * The `Math.max` floor is belt-and-braces enforcement of REQ-PF-011: with
 * `penaltyFactor >= 1` always, the result can never undercut `baseDistance`.
 * Throws `[PF-EXTRAP]` on a non-finite `baseDistance`.
 */
export function applyExtrapolationPenalty(
  baseDistance: number,
  assessment: ExtrapolationAssessment,
): number {
  if (!Number.isFinite(baseDistance)) {
    throw new Error('[PF-EXTRAP] baseDistance must be a finite number.')
  }
  return Math.max(baseDistance, baseDistance * assessment.penaltyFactor)
}

// ── Cube → ranges helper ─────────────────────────────────────────────────────

// @IMP-PF-CORE-010@ (FROM: @REQ-PF-010@)
/**
 * Derive {@link EnvelopeRanges} from a {@link PerformanceCube3D} so the
 * extrapolation layer can compose directly with the trilinear engine's cubes.
 */
export function cubeEnvelopeRanges(cube: PerformanceCube3D): EnvelopeRanges {
  return {
    mass: { min: cube.massAxis[0]!, max: cube.massAxis[cube.massAxis.length - 1]! },
    pressureAltitude: { min: cube.altitudeAxis[0]!, max: cube.altitudeAxis[cube.altitudeAxis.length - 1]! },
    temperature: { min: cube.temperatureAxis[0]!, max: cube.temperatureAxis[cube.temperatureAxis.length - 1]! },
  }
}

// ── Fail-safe facade ─────────────────────────────────────────────────────────

// @IMP-PF-CORE-011@ (FROM: @REQ-PF-010@, @REQ-PF-011@, @REQ-PF-012@)
/**
 * Resolve a base (clamped) POH distance into either a usable penalised distance
 * or a typed `blocked` result — never throws, never returns a distance for a
 * blocked operating point.
 *
 * This is the safety boundary of the module: a `blocked` state cannot, by
 * construction of {@link ExtrapolationResolved}, carry a distance into a
 * Go/No-Go decision.
 */
export function resolveExtrapolatedDistance(
  baseDistance: number,
  conditions: PohDistanceConditions,
  ranges: EnvelopeRanges,
): ExtrapolationResolved {
  if (
    !Number.isFinite(baseDistance) ||
    !Number.isFinite(conditions.mass) ||
    !Number.isFinite(conditions.pressureAltitude) ||
    !Number.isFinite(conditions.temperature)
  ) {
    return {
      state: 'blocked',
      reason: 'invalid_input',
      message: 'baseDistance and all conditions must be finite numbers.',
      assessment: null,
    }
  }

  let assessment: ExtrapolationAssessment
  try {
    assessment = assessExtrapolation(conditions, ranges)
  } catch (err) {
    return {
      state: 'blocked',
      reason: 'invalid_input',
      message: err instanceof Error ? err.message : String(err),
      assessment: null,
    }
  }

  if (assessment.state === 'blocked') {
    return {
      state: 'blocked',
      reason: 'extrapolation_exceeds_cap',
      message: `Operating point exceeds the ${EXTRAPOLATION_CAP_FRACTION * 100}% extrapolation boundary; computation blocked.`,
      assessment,
    }
  }

  return {
    state: assessment.state,
    distance: applyExtrapolationPenalty(baseDistance, assessment),
    requiresAcknowledgment: assessment.requiresAcknowledgment,
    benefitCapped: assessment.benefitCapped,
    assessment,
  }
}
