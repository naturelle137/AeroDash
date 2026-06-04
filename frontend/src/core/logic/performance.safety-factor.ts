/**
 * Performance safety-factor pipeline — pure mathematical core.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * Turns the four base POH distances (TOR/TOD/LR/LD) into operational required
 * distances, the Go/No-Go gate, and a safety margin, applying corrections per
 * REQ-PF-004, the operational safety factor per REQ-PF-006, and emitting
 * CRIT-PF-002 / WARN-PF-002 per REQ-PF-015 / REQ-PF-016.
 *
 * Functions here assume Zod-validated input — callers with raw input must go
 * through `applySafetyFactors` (performance.safety-factor.adapter.ts).
 *
 * @see docs/architecture/performance-safety-factor-pipeline.md
 */

import type {
  OperationalDistanceSet,
  OperationalSafetyFactorInput,
  PerformanceCorrectionFactors,
  PerformanceOperation,
  PerformanceViolation,
  SafetyFactorInput,
  SafetyFactorSuccess,
} from '../domain/performance.math-types'

/** EASA regulatory baseline OSF — takeoff (REQ-PF-006 / REQ-PF-016). */
export const EASA_TAKEOFF_FACTOR = 1.25
/** EASA regulatory baseline OSF — landing (REQ-PF-006 / REQ-PF-016). */
export const EASA_LANDING_FACTOR = 1.43
/** Short-field landing OSF preset value (REQ-PF-006). */
export const SHORT_FIELD_LANDING_FACTOR = 1.15
/** Inclusive lower bound for a custom OSF multiplier (REQ-PF-006). */
export const OSF_MIN = 1.0
/** Inclusive upper bound for a custom OSF multiplier (REQ-PF-006). */
export const OSF_MAX = 3.0

/** Regulatory baseline OSF for the operation. */
export function regulatoryBaseline(operation: PerformanceOperation): number {
  return operation === 'takeoff' ? EASA_TAKEOFF_FACTOR : EASA_LANDING_FACTOR
}

// @IMP-PF-CORE-007@ (FROM: @REQ-PF-006@)
/** Resolve the selected OSF preset to the concrete multiplier for the operation. */
export function resolveOsf(
  osf: OperationalSafetyFactorInput,
  operation: PerformanceOperation,
): number {
  switch (osf.preset) {
    case 'custom':
      return osf.customMultiplier ?? regulatoryBaseline(operation)
    case 'poh-afm':
      return osf.pohMandatedFactor?.[operation] ?? regulatoryBaseline(operation)
    case 'short-field':
      return operation === 'landing' ? SHORT_FIELD_LANDING_FACTOR : EASA_TAKEOFF_FACTOR
    case 'easa-standard':
      return regulatoryBaseline(operation)
    default: {
      const _: never = osf.preset
      return regulatoryBaseline(operation)
    }
  }
}

// @IMP-PF-CORE-008@ (FROM: @REQ-PF-016@)
/**
 * WARN-PF-002 threshold: the greater of the POH-mandated factor and the
 * regulatory baseline for the operation.
 */
export function osfThreshold(
  osf: OperationalSafetyFactorInput,
  operation: PerformanceOperation,
): number {
  const baseline = regulatoryBaseline(operation)
  const poh = osf.pohMandatedFactor?.[operation]
  return poh === undefined ? baseline : Math.max(baseline, poh)
}

/** True when the resolved OSF is below the WARN-PF-002 threshold (REQ-PF-016). */
export function isOsfBelowMinimum(
  osf: OperationalSafetyFactorInput,
  operation: PerformanceOperation,
): boolean {
  return resolveOsf(osf, operation) < osfThreshold(osf, operation)
}

// @IMP-PF-CORE-009@ (FROM: @REQ-PF-004@, @DES-ARCH-019@)
/** Combined ground-roll correction (friction × slope) — REQ-PF-004. */
export function groundRollFactor(factors: PerformanceCorrectionFactors): number {
  return factors.friction * factors.slope
}

/** Combined full-distance correction (density-altitude × wind) — REQ-PF-004. */
export function environmentalFactor(factors: PerformanceCorrectionFactors): number {
  return factors.densityAltitude * factors.wind
}

/** Corrected ground-roll required distance (m): TOR / LR. */
export function correctedGroundRoll(
  groundRollBase: number,
  factors: PerformanceCorrectionFactors,
  appliedOsf: number,
): number {
  return groundRollBase * groundRollFactor(factors) * environmentalFactor(factors) * appliedOsf
}

/**
 * Corrected full required distance (m): TOD / LD. Friction/slope correct only
 * the ground-roll portion — the airborne climb segment is exempt (REQ-PF-004).
 * Density-altitude/wind and the OSF apply to the whole distance. The `max(0, …)`
 * guard keeps a malformed `full < groundRoll` profile from inverting.
 */
export function correctedFullDistance(
  groundRollBase: number,
  fullBase: number,
  factors: PerformanceCorrectionFactors,
  appliedOsf: number,
): number {
  const airborne = Math.max(0, fullBase - groundRollBase)
  const correctedGroundRollPortion = groundRollBase * groundRollFactor(factors)
  return (correctedGroundRollPortion + airborne) * environmentalFactor(factors) * appliedOsf
}

// @IMP-PF-CORE-010@ (FROM: @REQ-PF-007@)
/** Safety margin: absolute (m) and as a percentage of the required distance. */
export function safetyMargin(
  available: number,
  required: number,
): { absolute: number; percent: number | null } {
  const absolute = available - required
  const percent = required > 0 ? (absolute / required) * 100 : null
  return { absolute, percent }
}

// @IMP-PF-CORE-011@ (FROM: @REQ-PF-015@, @REQ-PF-016@)
/** RUNWAY_INSUFFICIENT violation → CRIT-PF-002 (blocking). */
export function runwayInsufficientViolation(operation: PerformanceOperation): PerformanceViolation {
  return {
    type: 'RUNWAY_INSUFFICIENT',
    notificationId: 'CRIT-PF-002',
    severity: 'CRITICAL',
    blocking: true,
    operation,
  }
}

/** OSF_BELOW_MINIMUM violation → WARN-PF-002 (advisory). */
export function osfBelowMinimumViolation(operation: PerformanceOperation): PerformanceViolation {
  return {
    type: 'OSF_BELOW_MINIMUM',
    notificationId: 'WARN-PF-002',
    severity: 'WARNING',
    blocking: false,
    operation,
  }
}

/** INVALID_INPUT violation → ERR-SYS-001 (validation failure). */
export function invalidInputViolation(): PerformanceViolation {
  return {
    type: 'INVALID_INPUT',
    notificationId: 'ERR-SYS-001',
    severity: 'ERROR',
    blocking: false,
  }
}

/** Compute one operation's required distances and margin. */
function computeOperation(
  operation: PerformanceOperation,
  groundRollBase: number,
  fullBase: number,
  available: number,
  factors: PerformanceCorrectionFactors,
  osf: OperationalSafetyFactorInput,
): OperationalDistanceSet {
  const appliedOsf = resolveOsf(osf, operation)
  const groundRollRequired = correctedGroundRoll(groundRollBase, factors, appliedOsf)
  const fullRequired = correctedFullDistance(groundRollBase, fullBase, factors, appliedOsf)
  const { absolute, percent } = safetyMargin(available, fullRequired)
  return {
    groundRollRequired,
    fullRequired,
    available,
    marginAbsolute: absolute,
    marginPercent: percent,
    insufficient: fullRequired > available,
    appliedOsf,
  }
}

// @IMP-PF-CORE-012@ (FROM: @REQ-PF-004@, @REQ-PF-006@, @REQ-PF-007@, @REQ-PF-015@, @REQ-PF-016@)
/**
 * Apply the full safety-factor pipeline to validated input. Pure and
 * deterministic — no I/O, no exceptions for valid call sites. Emits CRIT-PF-002
 * per insufficient operation and WARN-PF-002 per operation whose OSF is below
 * the recommended minimum; `goNoGo` is false when any blocking violation exists.
 */
export function computeSafetyFactorPipeline(input: SafetyFactorInput): SafetyFactorSuccess {
  const { base, factors, osf, available } = input
  const violations: PerformanceViolation[] = []

  const takeoff = computeOperation(
    'takeoff',
    base.takeoffRoll,
    base.takeoffDistance50ft,
    available.takeoff,
    factors,
    osf,
  )
  const landing = computeOperation(
    'landing',
    base.landingRoll,
    base.landingDistance50ft,
    available.landing,
    factors,
    osf,
  )

  const operations: { name: PerformanceOperation; set: OperationalDistanceSet }[] = [
    { name: 'takeoff', set: takeoff },
    { name: 'landing', set: landing },
  ]

  for (const { name, set } of operations) {
    if (set.insufficient) {
      violations.push(runwayInsufficientViolation(name))
    }
    if (isOsfBelowMinimum(osf, name)) {
      violations.push(osfBelowMinimumViolation(name))
    }
  }

  const goNoGo = !violations.some((v) => v.blocking)

  return { status: 'success', takeoff, landing, violations, goNoGo }
}
