/**
 * Mass & Balance Math Types.
 * P1 Safety Core.
 */

import type { EnvelopePoint, ArmLookupEntry, BurnSequenceEntry } from './aircraft.types'

// @IMP-MB-CORE-013@ (FROM: @DES-ARCH-005@)
/** Raw safety violation emitted by the math core to keep isolation from notification bus. */
export interface Violation {
  type:
    | 'MTOM_EXCEEDED'
    | 'MZFM_EXCEEDED'
    | 'CG_OUT_OF_ENVELOPE'
    | 'CG_MIGRATION_EXCEEDED'
    | 'STATION_LIMIT_EXCEEDED'
    | 'INVALID_INPUT'
  /** Backwards-compatible stringified path (`STATIONS[0].MASS`). Prefer `path`. */
  field?: string
  /**
   * Structured Zod issue path (TECH-015). Each entry is a property key
   * (`'stations'`) or an array index (`0`). Populated alongside `field` so
   * consumers can dispatch on the path tail without regex-parsing the string.
   */
  path?: readonly (string | number)[]
  code?:
    | 'REQUIRED'
    | 'NOT_A_NUMBER'
    | 'NEGATIVE_VALUE'
    | 'NOT_ALLOWED'
    | 'OUT_OF_RANGE'
    | 'TOO_MANY_ITEMS'
    | 'DUPLICATE_INDEX'
  stationIndex?: number
}

/** Input assembled by the store, sent to the math core. */
export interface MathCoreInput {
  stations: {
    index: number
    mass: number
    arm: number | null
    armLookup: ArmLookupEntry[]
  }[]
  basicEmptyMass: number
  emptyCenterOfGravity: number
  maxTakeoffMass: number
  maxZeroFuelMass: number | null
  envelope: EnvelopePoint[]
  graphType: 'arm' | 'moment'
  fuelStations: {
    index: number
    mass: number
    arm: number | null
    armLookup: ArmLookupEntry[]
    unusableFuel: number
    burnSequences: BurnSequenceEntry[]
  }[]
}

export interface CgPoint {
  arm: number
  mass: number
  moment: number
}

export interface MigrationPoint {
  arm: number
  mass: number
  /**
   * Moment in kg·m, i.e. `arm × mass`. Carried alongside `arm` so the
   * CG-envelope chart (and any moment-graph consumer) can render the
   * migration path on a moment x-axis without recomputing `arm × mass`
   * downstream (TECH-012).
   */
  moment: number
  label?: string
}

export interface MathCoreResult {
  zeroFuelCenterOfGravityPoint: CgPoint
  takeoffCenterOfGravityPoint: CgPoint
  landingCenterOfGravityPoint: CgPoint
  migrationPath: MigrationPoint[]
  violations: Violation[]
  success: boolean
}
