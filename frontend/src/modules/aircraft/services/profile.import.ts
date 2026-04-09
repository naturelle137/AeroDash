/**
 * Profile Import — parse and validate aircraft profiles from exchange files.
 * P2 Feature Module — uses AircraftProfileSchema for Zod validation.
 *
 * Safety contract:
 * - Imported profiles are always forced to status='Draft' regardless of file content.
 * - On any error the fleet is NOT modified — ImportError is thrown instead.
 * - Round-trip fidelity: export JSON → parse → re-validate must produce identical data.
 *
 * @see docs/requirements/aircraft_management.md REQ-AC-004
 */

import { v4 as uuidv4 } from 'uuid'
import { AircraftProfileSchema } from '@/core/adapters/aircraft.schema'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// @IMP-AC-STORE-004@ (FROM: @REQ-AC-004@)

/**
 * Error thrown when an import operation fails.
 * The fleet is guaranteed to be unmodified when this error is thrown.
 */
export class ImportError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ImportError'
  }
}

/**
 * Parse and validate an aircraft profile from a JSON exchange file string.
 *
 * - Parses the JSON text.
 * - Validates against AircraftProfileSchema.
 * - Forces status = 'Draft' on the imported profile.
 * - Assigns a new UUID to prevent ID collisions with existing fleet entries.
 *
 * @throws ImportError if parsing or validation fails.
 */
export function importProfileFromJson(jsonText: string): AircraftProfile {
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    throw new ImportError('Invalid JSON: could not parse exchange file', err)
  }

  const result = AircraftProfileSchema.safeParse(parsed)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new ImportError(`Profile validation failed: ${issues}`, result.error)
  }

  // Force Draft status and assign new UUID to prevent collisions
  return {
    ...result.data,
    id: uuidv4(),
    status: 'Draft',
  }
}

/**
 * Export an AircraftProfile to a JSON string suitable for exchange.
 * The exported string can be re-imported with importProfileFromJson.
 */
export function exportProfileToJson(profile: AircraftProfile): string {
  return JSON.stringify(profile, null, 2)
}
