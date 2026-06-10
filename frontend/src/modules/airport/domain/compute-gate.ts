/**
 * Pre-compute gate for a manually entered runway (REQ-AP-004, H-009).
 * P2 Feature Module — pure function, no framework or P1 imports.
 *
 * Performance computation must not proceed until the pilot has selected a
 * surface condition: an omitted condition selects the wrong friction factor
 * and yields an incorrect required distance (H-009). The gate is fail-safe —
 * it blocks rather than guessing a default.
 */

import type { ManualAirportEntry } from './airport.types'
import { isValidSurfaceCondition } from './surface-conditions'

/** Why a manual-runway computation is blocked. */
export type ComputeBlockReason =
  | 'SURFACE_CONDITION_REQUIRED'
  | 'SURFACE_CONDITION_INVALID'
  | 'RUNWAY_LENGTH_REQUIRED'

export interface ComputeGateResult {
  /** True only when every precondition is satisfied. */
  allowed: boolean
  /** All unmet preconditions; empty when allowed. */
  blockers: readonly ComputeBlockReason[]
  /** Pilot-facing inline rejection message; empty string when allowed. */
  message: string
}

const MESSAGES: Readonly<Record<ComputeBlockReason, string>> = {
  SURFACE_CONDITION_REQUIRED:
    'Select the current runway surface condition before computing performance.',
  SURFACE_CONDITION_INVALID:
    'The selected surface condition is not valid for this runway surface type.',
  RUNWAY_LENGTH_REQUIRED: 'Enter the available runway length (TORA) before computing performance.',
}

/**
 * Evaluate whether a manual airport entry may proceed to performance
 * computation. Returns the full blocker set so the UI can surface every
 * outstanding precondition at once.
 */
// @IMP-AP-STORE-002@ (FROM: @REQ-AP-004@)
export function evaluateComputeGate(entry: ManualAirportEntry): ComputeGateResult {
  const blockers: ComputeBlockReason[] = []
  const { runway } = entry

  if (runway.surfaceConditionId === null) {
    blockers.push('SURFACE_CONDITION_REQUIRED')
  } else if (!isValidSurfaceCondition(runway.baseSurfaceType, runway.surfaceConditionId)) {
    blockers.push('SURFACE_CONDITION_INVALID')
  }

  if (runway.toraM === null || runway.toraM <= 0) {
    blockers.push('RUNWAY_LENGTH_REQUIRED')
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    message: blockers.map((reason) => MESSAGES[reason]).join(' '),
  }
}
