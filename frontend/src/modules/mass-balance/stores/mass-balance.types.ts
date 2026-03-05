/**
 * Mass & Balance module — type definitions.
 *
 * This file re-exports global P1 core types and defines module-specific structures
 * for the Pinia store and UI.
 */

// Re-export core types for module consumption
export * from '@/core/notifications/notification.types'
export * from '@/core/aircraft/aircraft.types'
export * from '@/core/math/mass-balance.math-types'

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

/**
 * Single state pointer for the Mass & Balance module.
 */
// @IMP-UI-001@ (FROM: @DES-ARCH-003@)
export type MassBalanceState =
  | 'INITIAL'
  | 'LOADING'
  | 'UNCONFIGURED'
  | 'UNVERIFIED'
  | 'VERIFIED_SAFE'
  | 'WARNING'
  | 'ERROR_CRITICAL'

// ---------------------------------------------------------------------------
// Store — Raw Input State
// ---------------------------------------------------------------------------

/** User-entered weight for a single load station. */
// @IMP-UI-002@ (FROM: @DES-UX-008@)
export interface StationInput {
  /** Index into the AircraftContext.loadPoints array. */
  index: number
  /** Human-readable name (mirrored from LoadPointDefinition). */
  name: string
  /** Current weight entered by the pilot. */
  weight: number
  /** Whether the pilot has explicitly verified this field (REQ-UI-014). */
  verified: boolean
  /** Whether this station is mandatory (must be > 0 for UNCONFIGURED → UNVERIFIED). */
  mandatory: boolean
}
