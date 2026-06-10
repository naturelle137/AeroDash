/**
 * Manual airport-entry domain types.
 * P2 Feature Module — plain TypeScript, no framework or P1 imports.
 *
 * @see docs/requirements/airport_database.md REQ-AP-003, REQ-AP-004, REQ-AP-006
 */

/** Whether the airport is resolved from a database or entered by hand (REQ-AP-003). */
export type AirportMode = 'idle' | 'manual-entry'

/** Base runway surface family — drives the context-aware condition list (REQ-AP-004). */
export type BaseSurfaceType = 'paved' | 'grass'

/** A selectable surface-condition option, specific to a {@link BaseSurfaceType}. */
export interface SurfaceConditionOption {
  /** Stable machine id, unique within a base surface type. */
  readonly id: string
  /** Pilot-facing label. */
  readonly label: string
}

/**
 * Editable runway parameters a pilot can override (REQ-AP-006).
 * Distances in metres, heading in °M, slope in percent. A field is `null`
 * until the pilot supplies it, so the compute gate can distinguish
 * "not entered" from a real zero.
 */
export interface ManualRunwayOverrides {
  designator: string
  magneticHeadingDeg: number | null
  baseSurfaceType: BaseSurfaceType
  slopePercent: number | null
  toraM: number | null
  todaM: number | null
  asdaM: number | null
  ldaM: number | null
  /** Selected surface-condition id; `null` until the mandatory selection is made (REQ-AP-004). */
  surfaceConditionId: string | null
}

/** A persisted manual airport entry (REQ-AP-003, REQ-AP-006). */
export interface ManualAirportEntry {
  id: string
  icao: string
  name: string
  elevationFt: number | null
  runway: ManualRunwayOverrides
  schemaVersion: number
}
