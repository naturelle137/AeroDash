/**
 * Performance module — UI state & view-model types.
 * P2 Feature Module. Re-exports the P1 safety-core result vocabulary and adds
 * the presentation-only shapes the store hands to the view. No safety math is
 * defined here — every numeric result originates in `src/core/`.
 */

import type {
  OperationalDistanceSet,
  OperationalSafetyFactorInput,
  OsfPreset,
  PerformanceCorrectionFactors,
} from '@/core/domain/performance.math-types'
import type { Notification } from '@/core/domain/notification.types'

// @IMP-PF-STORE-001@ (FROM: @REQ-PF-007@, @REQ-PF-017@)
export type {
  Notification,
  OperationalDistanceSet,
  OperationalSafetyFactorInput,
  OsfPreset,
  PerformanceCorrectionFactors,
}

/**
 * Performance UI state machine pointer. `evaluateState()` is the sole writer.
 * Priority (high → low): BLOCKED, PENDING_ACK, NO_GO, WARNING, GO.
 */
export type PerformanceUiState =
  | 'INITIAL' // no Verified performance-capable aircraft loaded
  | 'UNCONFIGURED' // mandatory conditions / runway distances not yet entered
  | 'BLOCKED' // computation refused (beyond extrapolation cap, or unusable input)
  | 'PENDING_ACK' // extrapolated result awaiting Pilot-in-Command acknowledgment
  | 'NO_GO' // blocking violation present (CRIT-PF-002 runway insufficient)
  | 'WARNING' // advisory violation present (WARN-PF-002 low OSF)
  | 'GO' // all clear

/** Raw pilot-entered environmental conditions, already in SI (kg, ft, °C). */
export interface PerformanceConditionsInput {
  mass: number | null
  pressureAltitude: number | null
  temperature: number | null
}

/** Manually-entered published runway distances (m): TORA / LDA. */
export interface AvailableDistancesInput {
  takeoff: number | null
  landing: number | null
}

/** The four base POH distances after extrapolation handling (m). */
export interface BaseDistanceView {
  takeoffRoll: number
  takeoffDistance50ft: number
  landingRoll: number
  landingDistance50ft: number
}

/**
 * Per-distance provenance flag — true when the value was derived via the CAA
 * SSL 07 estimation (REQ-PF-005) rather than read from the POH, and must carry
 * the visible `[ESTIMATED]` marker (REQ-PF-017). The estimation engine itself
 * is the CAA SSL 07 feature; until it lands, every flag is false and no marker
 * renders.
 */
export interface EstimatedFlags {
  takeoffRoll: boolean
  takeoffDistance50ft: boolean
  landingRoll: boolean
  landingDistance50ft: boolean
}

/** Aggregate extrapolation state surfaced to the pilot (REQ-PF-010/011/012). */
export interface ExtrapolationView {
  /** REQ-PF-012 gate — an extrapolated result is not finalized until acknowledged. */
  requiresAcknowledgment: boolean
  /** REQ-PF-011 — at least one axis was floored at its best-case POH value. */
  benefitCapped: boolean
  /** REQ-PF-010 — the fixed +20% extrapolation penalty was applied. */
  penaltyApplied: boolean
}

/** The complete view-model the store hands to the performance view. */
export interface PerformanceResultView {
  base: BaseDistanceView
  estimated: EstimatedFlags
  takeoff: OperationalDistanceSet
  landing: OperationalDistanceSet
  /** Aggregate Go/No-Go advisory from the safety-factor pipeline. */
  goNoGo: boolean
  /** True once the result may be acted on (no pending acknowledgment). */
  finalized: boolean
  extrapolation: ExtrapolationView
  /** True when any phase clamped an out-of-envelope input to a POH boundary. */
  clamped: boolean
}
