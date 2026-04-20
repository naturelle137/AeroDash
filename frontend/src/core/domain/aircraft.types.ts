/**
 * Aircraft Data Model Types.
 * P1 Safety Core - Agnostic of UI/Feature layers.
 *
 * @see docs/architecture/aircraft_data_model.md
 */

// Re-export the canonical AircraftProfile aggregate-root type from the Zod schema.
// All runtime validation of stored profiles must use AircraftProfileSchema.
export type { AircraftProfile } from '../adapters/aircraft.schema'

// @IMP-AD-CORE-001@ (FROM: @DES-ARCH-002@)
export interface EnvelopePoint {
  armOrMoment: number
  mass: number
}

export interface ArmLookupEntry {
  massOrVolume: number
  moment: number
}

export interface BurnSequenceEntry {
  sequenceName: string
  ordinalPosition: number
}

export interface FuelTankDefinition {
  unusableFuel: number
  permissibleFuelTypes: string[]
  burnSequences: BurnSequenceEntry[]
}

// @IMP-AD-CORE-020@ (FROM: @REQ-AD-020@)
/**
 * Powertrain discriminator. Drives a large chunk of the downstream UX —
 * combustion profiles show fuel tanks, burn sequences and fuel-mass based
 * endurance; electric profiles show a battery pack and energy-based
 * endurance. See ADR-009 (powertrain-discriminator) for the rationale.
 */
export type PowertrainType = 'combustion' | 'electric'

// @IMP-AD-CORE-021@ (FROM: @REQ-AD-021@)
export interface BatteryPackDefinition {
  usableEnergyKwh: number
  reserveFloorKwh: number
  nominalVoltage?: number
  chemistry?: string
}

export interface LoadPointDefinition {
  name: string
  arm: number | null
  armLookup: ArmLookupEntry[]
  operationalLimit: number | null
  defaultQuantity: number
  unit: string
  allowableCategories: ('Normal' | 'Utility' | 'Aerobatic')[] | null
  fuelTank: FuelTankDefinition | null
}

// @IMP-AD-CORE-006@ (FROM: @REQ-MB-010@)
export interface CategoryDefinition {
  category: 'Normal' | 'Utility' | 'Aerobatic'
  maxTakeoffMass: number
  maxZeroFuelMass: number | null
  graphType: 'arm' | 'moment'
  envelope: EnvelopePoint[]
}

// @IMP-AD-CORE-007@ (FROM: @REQ-AD-004@)
export interface WeighingReport {
  basicEmptyMass: number
  emptyCg: number
  weighingDate: string
  validFrom: string
}

// @IMP-AD-CORE-017@ (FROM: @REQ-AD-008@, @REQ-AD-009@)
export type FlightPhase =
  | 'TakeoffRoll'
  | 'TakeoffDistance50ft'
  | 'LandingRoll'
  | 'LandingDistance50ft'

export interface PerformanceDataPoint {
  distance: number
  mass: number
  pressureAltitude: number
  temperature: number
}

export interface PerformanceProfile {
  flightPhase: FlightPhase
  dataPoints: PerformanceDataPoint[]
}

/**
 * Subset of AircraftProfile required for Mass & Balance calculations.
 *
 * `status` follows the fleet FSM (`draft` | `verified`). Omitted in input data is
 * treated as `verified` at validation time (legacy catalogue entries).
 */
export interface AircraftContext {
  id: string
  registration: string
  manufacturer: string
  model: string
  sourceUnit: string
  /** Fleet verification state; drives WARN-AC-002 when `draft` (REQ-AC-005). */
  status?: 'draft' | 'verified'
  /**
   * Powertrain discriminator. Omitted on legacy records; callers must treat
   * `undefined` as `'combustion'` (the legacy default) for backwards-compat.
   */
  powertrain?: PowertrainType
  /** Present when `powertrain === 'electric'`. */
  batteryPack?: BatteryPackDefinition
  weighingReports: WeighingReport[]
  loadPoints: LoadPointDefinition[]
  certificationCategories: CategoryDefinition[]
}
