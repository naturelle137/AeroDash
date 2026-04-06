/**
 * Mass & Balance module — type definitions.
 *
 * This file re-exports global P1 core types and defines module-specific structures
 * for the Pinia store and UI.
 */

// Re-export core types for module consumption
export * from '@/core/domain/notification.types'
export * from '@/core/domain/aircraft.types'
export * from '@/core/domain/mass-balance.math-types'

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

/**
 * Single state pointer for the Mass & Balance module.
 */
// @IMP-MB-STORE-001@ (FROM: @DES-ARCH-003@)
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
// @IMP-MB-STORE-002@ (FROM: @DES-UX-008@, @REQ-UQ-004@)
export interface StationInput {
  /** Index into the AircraftContext.loadPoints array. */
  index: number
  /** Human-readable name (mirrored from LoadPointDefinition). */
  name: string
  /** Current weight entered by the pilot. */
  weight: number
  /**
   * Whether the pilot has explicitly verified this field (REQ-UI-014).
   * Retained for future modules with externally-populated data (airport DB, weather).
   */
  verified: boolean
  /** Whether this station is mandatory (must be touched for state progression). */
  mandatory: boolean
  /** Whether the pilot has interacted with this field or it was loaded with a non-zero default. */
  touched: boolean
  /** Whether this station currently has a validation error (e.g. negative value). */
  hasError: boolean
}
