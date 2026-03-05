/**
 * Mass & Balance Math Types.
 * P1 Safety Core.
 */

import type { EnvelopePoint, ArmLookupEntry, BurnSequenceEntry } from '../aircraft/aircraft.types'

/** Criticality of a safety violation. */
export type ViolationSeverity = 'WARNING' | 'CRITICAL'

// @IMP-MATH-001@ (FROM: @DES-ARCH-005@)
/** Raw safety violation emitted by the math core to keep isolation from notification bus. */
export interface Violation {
  type:
    | 'MTOM_EXCEEDED'
    | 'MZFM_EXCEEDED'
    | 'CG_OUT_OF_ENVELOPE'
    | 'CG_MIGRATION_EXCEEDED'
    | 'STATION_LIMIT_EXCEEDED'
  severity: ViolationSeverity
  stationIndex?: number
}

/** Input assembled by the store, sent to the math core. */
export interface MathCoreInput {
  stations: {
    index: number
    weight: number
    arm: number | null
    armLookup: ArmLookupEntry[] | null
  }[]
  basicEmptyMass: number
  emptyCenterOfGravity: number
  maxTakeoffMass: number
  maxZeroFuelMass: number | null
  envelope: EnvelopePoint[]
  graphType: 'arm' | 'moment'
  fuelStations: {
    index: number
    weight: number
    arm: number | null
    armLookup: ArmLookupEntry[] | null
    unusableFuel: number
    burnSequences: BurnSequenceEntry[]
  }[]
}

export interface CgPoint {
  arm: number
  mass: number
}

export interface MigrationPoint {
  arm: number
  mass: number
  label?: string
}

export interface MathCoreResult {
  takeoffMass: number
  zeroFuelMass: number
  centerOfGravityPosition: number
  landingMass: number
  takeoffCenterOfGravity: CgPoint
  landingCenterOfGravity: CgPoint
  migrationPath: MigrationPoint[]
  violations: Violation[]
}
