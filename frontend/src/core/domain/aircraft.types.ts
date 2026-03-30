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

export interface CategoryDefinition {
  category: 'Normal' | 'Utility' | 'Aerobatic'
  maxTakeoffMass: number
  maxZeroFuelMass: number | null
  graphType: 'arm' | 'moment'
  envelope: EnvelopePoint[]
}

export interface WeighingReport {
  basicEmptyMass: number
  emptyCg: number
  weighingDate: string
  validFrom: string
}

/**
 * Subset of AircraftProfile required for Mass & Balance calculations.
 */
export interface AircraftContext {
  id: string
  registration: string
  manufacturer: string
  model: string
  sourceUnit: string
  weighingReports: WeighingReport[]
  loadPoints: LoadPointDefinition[]
  certificationCategories: CategoryDefinition[]
}
