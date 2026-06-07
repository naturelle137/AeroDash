/**
 * CAA SSL 07 missing-distance estimation.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * Sibling to {@link ./performance.poh-distance}. When an aircraft POH omits the
 * 50 ft obstacle-clearance distance for a phase but publishes the ground roll,
 * the missing base value is estimated from the roll using the fixed UK CAA
 * Safety Sense Leaflet 07 conversion factors (REQ-PF-005):
 *
 *   Take-off:  TOD = TOR × 1.9
 *   Landing:   LD  = LR  × 1.67
 *
 * The estimate is a conservative, airframe-generic substitute — never certified
 * data. Every resolved distance therefore carries an explicit provenance marker
 * (`'poh'` vs `'estimated'`) so an estimated value can never be silently treated
 * as authoritative POH data downstream, in persistence, or in transmission
 * (REQ-PF-017). A POH-published value always takes precedence over the estimate.
 *
 * Direction: estimation runs ground-roll → obstacle-distance only. The CAA SSL
 * 07 factors are defined in that direction; inverting them (distance → roll)
 * would shorten the result and is optimistic-unsafe, so a missing ground roll
 * yields a typed `insufficient_data` failure rather than a fabricated value.
 *
 * @see docs/requirements/performance.md
 * @see ./performance.poh-distance
 */

import type {
  PerformanceBaseDistances,
  PerformanceOperation,
} from '../domain/performance.math-types'

// ── Immutable CAA SSL 07 conversion ratios ───────────────────────────────────

// @IMP-PF-CORE-024@ (FROM: @REQ-PF-005@)
/**
 * UK CAA Safety Sense Leaflet 07 ground-roll → obstacle-distance conversion
 * factors. Fixed by regulation intent; MUST NOT be made user-configurable. The
 * freeze makes accidental runtime mutation fail loudly in strict mode.
 */
export const CAA_SSL_07_RATIOS = Object.freeze({
  takeoff: 1.9,
  landing: 1.67,
} as const)

/**
 * Stable provenance label surfaced to the pilot and carried into export
 * documentation (REQ-PF-017). The UI/export layer renders this verbatim; it is
 * defined here so on-screen and on-paper provenance share a single source.
 */
export const ESTIMATION_METHOD_LABEL = 'ESTIMATED (CAA SSL 07)' as const

// ── Provenance model ─────────────────────────────────────────────────────────

/** Where a resolved base distance came from. */
export type DistanceProvenance = 'poh' | 'estimated'

/** Conversion method tag; `null` for authoritative POH values. */
export type EstimationMethod = 'caa-ssl-07' | null

/**
 * A single base distance plus its data provenance — the serialisable unit that
 * is persisted (IndexedDB) and transmitted (REQ-PF-017). Plain data only, so it
 * round-trips through the structured-clone and JSON boundaries unchanged.
 */
export interface ProvenancedDistance {
  /** Base distance in metres (pre-Operational-Safety-Factor). */
  readonly value: number
  /** `'poh'` for authoritative published data; `'estimated'` for a CAA SSL 07 derivation. */
  readonly provenance: DistanceProvenance
  /** Conversion method — present only when `provenance === 'estimated'`; `null` for POH. */
  readonly method: EstimationMethod
}

/** The four base distances, each carrying its provenance. */
export interface EstimatedBaseDistances {
  readonly takeoffRoll: ProvenancedDistance
  readonly takeoffDistance50ft: ProvenancedDistance
  readonly landingRoll: ProvenancedDistance
  readonly landingDistance50ft: ProvenancedDistance
}

/** Optionally-published POH base values; an absent field is a gap to be resolved. */
export interface EstimationInput {
  /** Published take-off ground-roll base distance (m), when present. */
  readonly takeoffRoll?: number
  /** Published take-off 50 ft distance base value (m), when present. */
  readonly takeoffDistance50ft?: number
  /** Published landing ground-roll base distance (m), when present. */
  readonly landingRoll?: number
  /** Published landing 50 ft distance base value (m), when present. */
  readonly landingDistance50ft?: number
}

/** Successful resolution of all four base distances. */
export interface EstimationSuccess {
  readonly status: 'success'
  readonly distances: EstimatedBaseDistances
  /** True when at least one obstacle distance was CAA SSL 07-estimated. */
  readonly anyEstimated: boolean
}

/** Why no result was produced. Caller-visible — never escapes as an exception. */
export type EstimationFailureReason = 'insufficient_data' | 'invalid_input'

/** Typed failure surface — pure data, no exceptions. */
export interface EstimationFailure {
  readonly status: 'failure'
  readonly reason: EstimationFailureReason
  /** Free-text diagnostic for the pilot UI / logs. Never includes raw user data. */
  readonly message: string
}

export type EstimationResult = EstimationSuccess | EstimationFailure

// ── Pure estimator ───────────────────────────────────────────────────────────

function ratioFor(operation: PerformanceOperation): number {
  return operation === 'takeoff' ? CAA_SSL_07_RATIOS.takeoff : CAA_SSL_07_RATIOS.landing
}

// @IMP-PF-CORE-023@ (FROM: @REQ-PF-005@)
/**
 * Estimate the 50 ft obstacle-clearance distance for `operation` from its ground
 * roll via the CAA SSL 07 factor (TOD = TOR × 1.9, LD = LR × 1.67).
 *
 * Throws `[PF-ESTIMATE]` on a non-finite or non-positive roll — a zero/negative
 * roll has no physical meaning and must never silently yield a fabricated
 * distance. The fail-safe boundary that converts this to a typed result is
 * {@link estimateBaseDistances} (and the Zod-validated `applyEstimation`).
 */
export function estimateObstacleDistance(
  operation: PerformanceOperation,
  groundRoll: number,
): number {
  if (!Number.isFinite(groundRoll)) {
    throw new Error('[PF-ESTIMATE] ground roll must be a finite number.')
  }
  if (groundRoll <= 0) {
    throw new Error('[PF-ESTIMATE] ground roll must be strictly positive.')
  }
  return groundRoll * ratioFor(operation)
}

// ── Provenance constructors ──────────────────────────────────────────────────

function poh(value: number): ProvenancedDistance {
  return { value, provenance: 'poh', method: null }
}

function estimated(value: number): ProvenancedDistance {
  return { value, provenance: 'estimated', method: 'caa-ssl-07' }
}

/** Present-but-malformed values are a hard error — never silently dropped. */
function isMalformed(value: number | undefined): boolean {
  return value !== undefined && !(Number.isFinite(value) && value > 0)
}

/** Narrowing guard for a published (present) field; its validity is enforced by {@link isMalformed}. */
function isPresent(value: number | undefined): value is number {
  return value !== undefined
}

type PhaseResolution =
  | {
      status: 'ok'
      groundRoll: ProvenancedDistance
      obstacleDistance50ft: ProvenancedDistance
    }
  | EstimationFailure

function resolvePhase(
  operation: PerformanceOperation,
  roll: number | undefined,
  obstacle: number | undefined,
): PhaseResolution {
  if (isMalformed(roll) || isMalformed(obstacle)) {
    return {
      status: 'failure',
      reason: 'invalid_input',
      message: `${operation} base distances must be finite, strictly-positive numbers when present.`,
    }
  }
  if (!isPresent(roll)) {
    return {
      status: 'failure',
      reason: 'insufficient_data',
      message: `${operation} ground roll is required; it cannot be estimated from the 50 ft distance.`,
    }
  }
  const obstacleDistance50ft = isPresent(obstacle)
    ? poh(obstacle)
    : estimated(estimateObstacleDistance(operation, roll))
  return { status: 'ok', groundRoll: poh(roll), obstacleDistance50ft }
}

// ── Facade ───────────────────────────────────────────────────────────────────

// @IMP-PF-CORE-022@ (FROM: @REQ-PF-005@, @REQ-PF-017@)
/**
 * Resolve the four base distances, estimating a missing 50 ft distance from its
 * ground roll (CAA SSL 07) and tagging every value with its provenance.
 *
 * Pure and total: identical inputs always produce identical outputs, no I/O, and
 * it never throws — malformed or insufficient input yields a typed `failure`.
 * POH-published values always take precedence over the estimate, so an estimate
 * is never substituted for authoritative data.
 */
export function estimateBaseDistances(input: EstimationInput): EstimationResult {
  const takeoff = resolvePhase('takeoff', input.takeoffRoll, input.takeoffDistance50ft)
  if (takeoff.status === 'failure') return takeoff
  const landing = resolvePhase('landing', input.landingRoll, input.landingDistance50ft)
  if (landing.status === 'failure') return landing

  const distances: EstimatedBaseDistances = {
    takeoffRoll: takeoff.groundRoll,
    takeoffDistance50ft: takeoff.obstacleDistance50ft,
    landingRoll: landing.groundRoll,
    landingDistance50ft: landing.obstacleDistance50ft,
  }
  const anyEstimated =
    distances.takeoffDistance50ft.provenance === 'estimated' ||
    distances.landingDistance50ft.provenance === 'estimated'

  return { status: 'success', distances, anyEstimated }
}

// @IMP-PF-CORE-021@ (FROM: @REQ-PF-005@)
/**
 * Extract the plain SI base distances for the downstream safety-factor pipeline.
 * The provenance markers stay on {@link EstimatedBaseDistances} so the pipeline
 * consumes only numbers while the caller retains the estimated/POH flags for
 * persistence, transmission, and UI marking.
 */
export function toBaseDistances(distances: EstimatedBaseDistances): PerformanceBaseDistances {
  return {
    takeoffRoll: distances.takeoffRoll.value,
    takeoffDistance50ft: distances.takeoffDistance50ft.value,
    landingRoll: distances.landingRoll.value,
    landingDistance50ft: distances.landingDistance50ft.value,
  }
}
