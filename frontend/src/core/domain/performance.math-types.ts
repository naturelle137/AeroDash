/**
 * Performance Safety-Factor Math Types.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * @see docs/architecture/performance-safety-factor-pipeline.md
 */

import type { NotificationSeverity } from './notification.types'

/** Take-off or landing — selects regulatory baselines and which factors apply. */
export type PerformanceOperation = 'takeoff' | 'landing'

/** Operational Safety Factor selection (REQ-PF-006). */
export type OsfPreset = 'easa-standard' | 'poh-afm' | 'short-field' | 'custom'

/** Per-operation POH/AFM-mandated safety factor, when the profile carries one. */
export interface PohMandatedFactor {
  takeoff?: number
  landing?: number
}

/** OSF selection plus the data needed to resolve presets and the WARN threshold. */
export interface OperationalSafetyFactorInput {
  preset: OsfPreset
  /** Required for `custom`; multiplier in [1.00, 3.00]. */
  customMultiplier?: number
  /** Drives the `poh-afm` preset and raises the WARN-PF-002 threshold (REQ-PF-016). */
  pohMandatedFactor?: PohMandatedFactor
}

/**
 * Correction multipliers (dimensionless). Friction and slope are applied to the
 * ground-roll segment only; density-altitude and wind to the full distance
 * (REQ-PF-004). The values are derived upstream (REQ-PF-003) — this pipeline
 * only applies them.
 */
export interface PerformanceCorrectionFactors {
  friction: number
  slope: number
  densityAltitude: number
  wind: number
}

/** The four base POH distances (m), as produced by `computePohDistances`. */
export interface PerformanceBaseDistances {
  takeoffRoll: number
  takeoffDistance50ft: number
  landingRoll: number
  landingDistance50ft: number
}

/** Published runway distances available for each operation (m): TORA / LDA. */
export interface AvailableDistances {
  takeoff: number
  landing: number
}

/** Unvalidated input to the safety-factor pipeline. */
export interface SafetyFactorInput {
  base: PerformanceBaseDistances
  factors: PerformanceCorrectionFactors
  osf: OperationalSafetyFactorInput
  available: AvailableDistances
}

/** Domain vocabulary for the violations this pipeline can emit. */
export type PerformanceViolationType =
  | 'RUNWAY_INSUFFICIENT'
  | 'OSF_BELOW_MINIMUM'
  | 'INVALID_INPUT'

// @IMP-PF-CORE-006@ (FROM: @REQ-PF-007@, @REQ-PF-015@, @REQ-PF-016@, @DES-ARCH-019@)
/**
 * Raw safety violation emitted by the math core, kept independent of the
 * notification bus (P2 maps `notificationId` to the centralised contract).
 */
export interface PerformanceViolation {
  type: PerformanceViolationType
  /** Stable notification-contract id (docs/architecture/notification_schema.md). */
  notificationId: 'CRIT-PF-002' | 'WARN-PF-002' | 'ERR-SYS-001'
  severity: NotificationSeverity
  /** True only for hard Go/No-Go blockers (CRIT-PF-002). */
  blocking: boolean
  /** Operation the violation concerns; absent for input-validation failures. */
  operation?: PerformanceOperation
}

/** Per-operation operational required distances and safety margin (REQ-PF-007). */
export interface OperationalDistanceSet {
  /** Ground-roll operational required distance (m): TOR (takeoff) / LR (landing). */
  groundRollRequired: number
  /** Full operational required distance (m): TOD (takeoff) / LD (landing) — the Go/No-Go gate. */
  fullRequired: number
  /** Available runway distance for this operation (m). */
  available: number
  /** Safety margin: available − fullRequired (m); negative when insufficient. */
  marginAbsolute: number
  /** Margin as a percentage of fullRequired; null when fullRequired ≤ 0. */
  marginPercent: number | null
  /** True when fullRequired > available (drives CRIT-PF-002). */
  insufficient: boolean
  /** Operational safety factor actually applied to this operation. */
  appliedOsf: number
}

/** Successful pipeline result. */
export interface SafetyFactorSuccess {
  status: 'success'
  takeoff: OperationalDistanceSet
  landing: OperationalDistanceSet
  violations: PerformanceViolation[]
  /** Aggregate Go/No-Go advisory: false when any blocking violation is present. */
  goNoGo: boolean
}

/** Validation failure — carries an INVALID_INPUT violation, never throws. */
export interface SafetyFactorFailure {
  status: 'failure'
  violations: PerformanceViolation[]
}

export type SafetyFactorResult = SafetyFactorSuccess | SafetyFactorFailure
