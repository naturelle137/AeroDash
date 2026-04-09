/**
 * Profile Validator — ICAO registration validation and duplicate detection.
 * P2 Feature Module — pure TypeScript utilities, no Vue/Pinia dependencies.
 *
 * @see docs/requirements/aircraft_management.md REQ-AC-002, REQ-AC-003
 */

import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// @IMP-AC-STORE-002@ (FROM: @REQ-AC-002@)

/**
 * ICAO aircraft registration format:
 * - Must start with a letter (country prefix)
 * - Followed by alphanumeric characters and hyphens
 * - 2–7 characters total length
 * Examples: D-EBPN, N12345, G-ABCD, VH-ABC
 */
const ICAO_REGISTRATION_REGEX = /^[A-Z][A-Z0-9-]{1,6}$/i

/**
 * Validate an ICAO aircraft registration string.
 * Accepts alphanumeric characters and hyphens, 2–7 characters.
 */
export function validateIcaoRegistration(registration: string): boolean {
  if (!registration || registration.length < 2 || registration.length > 7) {
    return false
  }
  return ICAO_REGISTRATION_REGEX.test(registration)
}

// @IMP-AC-STORE-003@ (FROM: @REQ-AC-003@)

/**
 * Check whether a registration already exists within a collection of profiles.
 * Case-insensitive comparison.
 *
 * @param registration - The registration string to check.
 * @param profiles - The collection of profiles to check against.
 * @param excludeId - Optionally exclude a profile by id (used when editing an existing profile).
 * @returns true if a duplicate exists (excluding the optional excludeId).
 */
export function hasDuplicateRegistration(
  registration: string,
  profiles: ReadonlyArray<Pick<AircraftProfile, 'id' | 'registration'>>,
  excludeId?: string,
): boolean {
  const normalizedReg = registration.trim().toUpperCase()
  return profiles.some(
    (p) => p.id !== excludeId && p.registration.trim().toUpperCase() === normalizedReg,
  )
}
