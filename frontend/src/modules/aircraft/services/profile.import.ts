/**
 * Profile Import — parse and validate aircraft profiles from exchange files.
 * P2 Feature Module — uses AircraftProfileSchema for Zod validation.
 *
 * Safety contract:
 * - Imported profiles are always forced to status='draft' regardless of file content.
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
 * - Forces status = 'draft' on the imported profile.
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

  // Force draft status and assign new UUID to prevent collisions
  return {
    ...result.data,
    id: uuidv4(),
    status: 'draft',
  }
}

/**
 * Export an AircraftProfile to a JSON string suitable for exchange.
 * The exported string can be re-imported with importProfileFromJson.
 */
export function exportProfileToJson(profile: AircraftProfile): string {
  return JSON.stringify(profile, null, 2)
}

/**
 * Build a safe filename for an aircraft exchange file.
 *
 * Produces `<sanitized-registration>.aerodash.json`. The registration is
 * stripped of any character outside `[A-Za-z0-9_-]` so the resulting name is
 * safe on every major filesystem. Falls back to `aircraft` when the
 * sanitised registration is empty.
 */
export function buildExchangeFilename(registration: string): string {
  const safe = registration.trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  const base = safe.length > 0 ? safe : 'aircraft'
  return `${base}.aerodash.json`
}

/**
 * Trigger a browser download of the aircraft profile as a `.aerodash.json`
 * exchange file. The emitted file is byte-for-byte compatible with
 * `importProfileFromJson` (round-trip safe).
 *
 * The download is performed via a transient `<a>` element with an object URL.
 * The object URL is revoked after the click to avoid memory leaks.
 */
export function downloadProfileAsJson(profile: AircraftProfile): void {
  const json = exportProfileToJson(profile)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = buildExchangeFilename(profile.registration)
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
