/**
 * Static aircraft model catalogue for the model hierarchy selector.
 * P2 Feature Module — data loaded from JSON; pure lookup helpers (no framework).
 *
 * Provides manufacturer → model → ICAO type designator mapping.
 * Supports the AircraftModelSelector component (REQ-UI-001 through REQ-UI-004).
 *
 * @see docs/requirements/user_interface.md REQ-UI-001, REQ-UI-002, REQ-UI-003, REQ-UI-004
 */

// @IMP-AC-VIEW-001@ (FROM: @REQ-UI-001@, @REQ-UI-003@, @REQ-UI-004@)

import rawCatalogue from './aircraft-model-catalogue.json'

/**
 * Monotonically increasing catalogue data version string.
 * Incremented whenever entries are added, removed, or corrected.
 * Used by the update pipeline (ADR-007) to detect catalogue changes on app load.
 *
 * v1.1.0 — added Pipistrel Velis Electro (ICAO `PIVE`) and the optional
 * `powertrain` hint so the wizard can pre-select the electric path.
 */
export const CATALOGUE_VERSION = '1.1.0'

/**
 * Optional powertrain hint persisted alongside catalogue entries. The wizard
 * uses this to pre-select the powertrain after the pilot picks a known model
 * — `'electric'` for battery-electric airframes (Pipistrel Velis Electro,
 * future Bristell Energic, eFlyer 2…), `'combustion'` (or omitted) for the
 * piston/turbine majority. Pilots can still override the choice.
 */
export type CataloguePowertrainHint = 'combustion' | 'electric'

export interface AircraftModelEntry {
  /** Stable key for list rendering (unique per catalogue row). */
  id: string
  manufacturer: string
  model: string
  icaoTypeDesignator: string
  /**
   * Optional pre-selection for the wizard's powertrain step. Absent on every
   * legacy combustion entry so the wizard's combustion default still applies
   * without a backfill of the catalogue JSON.
   */
  powertrain?: CataloguePowertrainHint
}

export const AIRCRAFT_MODEL_CATALOGUE: AircraftModelEntry[] = rawCatalogue as AircraftModelEntry[]

/**
 * Get unique manufacturer names from the catalogue, sorted alphabetically.
 * The special 'Other' entry is appended last (REQ-UI-002).
 */
export function getManufacturers(): string[] {
  const manufacturers = [...new Set(AIRCRAFT_MODEL_CATALOGUE.map((e) => e.manufacturer))].sort()
  return [...manufacturers, 'Other']
}

/**
 * Get all model entries for a given manufacturer.
 * Returns empty array for 'Other' — caller should show free text input (REQ-UI-002).
 */
export function getModelsByManufacturer(manufacturer: string): AircraftModelEntry[] {
  if (manufacturer === 'Other') return []
  return AIRCRAFT_MODEL_CATALOGUE.filter((e) => e.manufacturer === manufacturer)
}

/**
 * Look up matching catalogue entries by ICAO type designator.
 * Returns all matches (multiple manufacturers may share a designator).
 * Supports bidirectional lookup (REQ-UI-004).
 */
export function findByIcaoDesignator(icaoTypeDesignator: string): AircraftModelEntry[] {
  const normalized = icaoTypeDesignator.trim().toUpperCase()
  return AIRCRAFT_MODEL_CATALOGUE.filter(
    (e) => e.icaoTypeDesignator.toUpperCase() === normalized,
  )
}

/**
 * When ICAO input is a complete 4-character designator with exactly one catalogue
 * match, return that entry for auto-fill (REQ-UI-003, REQ-UI-004).
 */
export function findUniqueByIcaoDesignator(icaoTypeDesignator: string): AircraftModelEntry | null {
  const normalized = icaoTypeDesignator.trim().toUpperCase()
  if (normalized.length !== 4) return null
  const matches = findByIcaoDesignator(normalized)
  return matches.length === 1 ? matches[0]! : null
}

/**
 * Look up the powertrain hint for a (manufacturer, model) pair.
 * Returns `undefined` when the entry isn't in the catalogue, the manufacturer
 * is `'Other'`, or the entry has no explicit powertrain hint (legacy entries).
 *
 * Callers should treat `undefined` as "no opinion" — typically by falling back
 * to the wizard's existing combustion default (see ADR-009).
 */
export function getPowertrainHintFor(
  manufacturer: string,
  model: string,
): CataloguePowertrainHint | undefined {
  if (manufacturer === 'Other') return undefined
  const entry = AIRCRAFT_MODEL_CATALOGUE.find(
    (e) => e.manufacturer === manufacturer && e.model === model,
  )
  return entry?.powertrain
}
