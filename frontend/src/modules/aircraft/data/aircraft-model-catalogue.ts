/**
 * Static aircraft model catalogue for the model hierarchy selector.
 * P2 Feature Module — static data, no external dependencies.
 *
 * Provides manufacturer → model → ICAO type designator mapping.
 * Supports the AircraftModelSelector component (REQ-UI-001 through REQ-UI-004).
 *
 * @see docs/requirements/user_interface.md REQ-UI-001, REQ-UI-002, REQ-UI-003, REQ-UI-004
 */

// @IMP-AC-VIEW-001@ (FROM: @REQ-UI-001@, @REQ-UI-003@, @REQ-UI-004@)

/**
 * Monotonically increasing catalogue data version string.
 * Incremented whenever entries are added, removed, or corrected.
 * Used by the update pipeline (ADR-007) to detect catalogue changes on app load.
 */
export const CATALOGUE_VERSION = '1.0.0'

export interface AircraftModelEntry {
  manufacturer: string
  model: string
  icaoTypeDesignator: string
}

export const AIRCRAFT_MODEL_CATALOGUE: AircraftModelEntry[] = [
  // Cessna
  { manufacturer: 'Cessna', model: 'C152', icaoTypeDesignator: 'C152' },
  { manufacturer: 'Cessna', model: 'C172S Skyhawk SP', icaoTypeDesignator: 'C172' },
  { manufacturer: 'Cessna', model: 'C182T Skylane', icaoTypeDesignator: 'C182' },
  // Piper
  { manufacturer: 'Piper', model: 'PA-28-161 Warrior III', icaoTypeDesignator: 'PA28' },
  { manufacturer: 'Piper', model: 'PA-28-181 Archer III', icaoTypeDesignator: 'PA28' },
  { manufacturer: 'Piper', model: 'PA-44-180 Seminole', icaoTypeDesignator: 'PA44' },
  // Diamond
  { manufacturer: 'Diamond', model: 'DA40 Diamond Star', icaoTypeDesignator: 'DA40' },
  { manufacturer: 'Diamond', model: 'DA42 Twin Star', icaoTypeDesignator: 'DA42' },
  // Tecnam
  { manufacturer: 'Tecnam', model: 'P2008 JC', icaoTypeDesignator: 'P208' },
  { manufacturer: 'Tecnam', model: 'P2010', icaoTypeDesignator: 'P210' },
  // Robin
  { manufacturer: 'Robin', model: 'DR400/120 Petit Prince', icaoTypeDesignator: 'DR40' },
  { manufacturer: 'Robin', model: 'DR400/140B Major', icaoTypeDesignator: 'DR40' },
]

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
