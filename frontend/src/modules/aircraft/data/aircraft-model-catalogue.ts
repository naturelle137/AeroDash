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

export interface AircraftModelEntry {
  /** Stable key for list rendering (unique per catalogue row). */
  id: string
  manufacturer: string
  model: string
  icaoTypeDesignator: string
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
