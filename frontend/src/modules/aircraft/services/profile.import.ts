/**
 * Profile Import — parse and validate aircraft profiles from exchange files.
 * P2 Feature Module — uses AircraftProfileSchema for Zod validation.
 *
 * Safety contract:
 * - Imported profiles are always forced to status='draft' regardless of file content.
 * - On any error the fleet is NOT modified — ImportError is thrown instead.
 * - Round-trip fidelity: export JSON → parse → re-validate must produce identical data.
 *
 * Exchange-file envelope (refs #259, audit finding TECH-022):
 * - New exports wrap the profile in
 *   `{ format: 'aerodash-aircraft', version: 1, profile: {...} }` so the file
 *   identifies its schema family up-front and a future schema bump can be
 *   detected before any field is parsed.
 * - Import accepts BOTH the envelope form (preferred, written by current
 *   builds) AND legacy bare-profile JSON (written by builds before this
 *   wrapper shipped, including AeroDash v0.3.0-alpha). The detector
 *   inspects the top-level keys to decide which shape is on disk.
 *
 * @see docs/requirements/aircraft_management.md REQ-AC-004
 */

import { v4 as uuidv4 } from 'uuid'
import { AircraftProfileSchema } from '@/core/adapters/aircraft.schema'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

// @IMP-AC-STORE-004@ (FROM: @REQ-AC-004@)

/**
 * Maximum accepted size (in bytes) for an aircraft exchange file.
 *
 * Real `.aerodash.json` profiles are a few kilobytes; the schema caps load
 * points at 20 and envelope points at 20, so even a maximal valid profile is
 * well under this bound. 256 KB leaves generous headroom for whitespace-pretty
 * JSON while preventing an attacker-supplied multi-megabyte file from being read
 * wholesale into memory via `File.text()` (CS-003 / TECH-008).
 */
export const MAX_IMPORT_FILE_BYTES = 256 * 1024 // 256 KB

/**
 * Magic `format` marker used in the exchange-file envelope. Distinguishes
 * an aerodash aircraft profile from any other JSON document the user might
 * point the import dialog at by accident.
 */
export const EXCHANGE_FORMAT = 'aerodash-aircraft' as const

/**
 * Current exchange-file envelope version.
 *
 * Bump in lockstep with the {@link AircraftProfileSchema}'s structural
 * version when adding new required fields. Reading code rejects envelopes
 * whose `version` is greater than this constant so a future profile cannot
 * be imported into an older build (PWA-cache rollback semantics).
 */
export const EXCHANGE_VERSION = 1 as const

/** Envelope shape that wraps an exported aircraft profile (since #259). */
export interface ExchangeEnvelope {
  readonly format: typeof EXCHANGE_FORMAT
  readonly version: number
  readonly profile: unknown
}

/**
 * Accepted MIME types for an aircraft exchange file. Browsers report `.json`
 * files as `application/json` (and historically `text/json`); some report an
 * empty string when the OS has no MIME mapping, which we tolerate provided the
 * extension and size checks pass — the JSON parser is the final structural gate.
 */
const ACCEPTED_MIME_TYPES = new Set(['application/json', 'text/json'])

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
 * Fail-closed pre-flight guard for an imported exchange file (CS-003 / TECH-008).
 *
 * Validates the file's size and content-type BEFORE any byte is read into memory
 * (`File.text()`), so a hostile oversized or spoofed payload is rejected early.
 *
 * Rejection rules:
 * - Empty file (0 bytes) → cannot be a valid profile.
 * - Size above {@link MAX_IMPORT_FILE_BYTES} → reject without reading.
 * - Reported MIME type not JSON AND extension not `.json` → reject. An empty
 *   reported type is tolerated only when the `.json` extension is present.
 *
 * @throws ImportError if the file fails any guard; the fleet is never modified.
 */
// @IMP-AC-STORE-007@ (FROM: @REQ-AC-004@)
export function validateImportFile(file: File): void {
  if (file.size === 0) {
    throw new ImportError('Import failed: file is empty')
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    const limitKb = Math.round(MAX_IMPORT_FILE_BYTES / 1024)
    throw new ImportError(
      `Import failed: file is too large (max ${limitKb} KB). Exchange files are only a few KB.`,
    )
  }

  const type = file.type.toLowerCase()
  const hasJsonExtension = file.name.toLowerCase().endsWith('.json')
  const hasJsonMime = ACCEPTED_MIME_TYPES.has(type)

  // Accept when the MIME type is JSON, or when the browser reported no type but
  // the extension is `.json`. Reject any explicitly non-JSON MIME type.
  if (!hasJsonMime && !(type === '' && hasJsonExtension)) {
    throw new ImportError('Import failed: only .json exchange files are accepted')
  }

  if (!hasJsonExtension) {
    throw new ImportError('Import failed: only .json exchange files are accepted')
  }
}

/**
 * Identify whether a parsed JSON tree is the new envelope or a legacy
 * bare-profile document.
 *
 * The detector is intentionally conservative: a tree only counts as an
 * envelope when both the `format` marker and a numeric `version` are present.
 * Any other shape (including a tree that *looks* like an envelope but is
 * missing one of those keys) falls back to the legacy bare-profile path.
 */
// @IMP-AC-STORE-008@ (FROM: @REQ-AC-004@)
export function isExchangeEnvelope(value: unknown): value is ExchangeEnvelope {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  if (obj.format !== EXCHANGE_FORMAT) return false
  if (typeof obj.version !== 'number') return false
  if (!Number.isInteger(obj.version) || obj.version <= 0) return false
  if (!('profile' in obj)) return false
  return true
}

/**
 * Parse and validate an aircraft profile from a JSON exchange file string.
 *
 * - Parses the JSON text.
 * - If the top-level shape is an {@link ExchangeEnvelope}, the envelope's
 *   `version` is checked against {@link EXCHANGE_VERSION} (a newer version
 *   is rejected — the user must update the app). The inner `profile` is
 *   then validated.
 * - Otherwise the entire tree is treated as a legacy bare-profile document
 *   (back-compat with builds that shipped before #259).
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

  let profileDoc: unknown
  if (isExchangeEnvelope(parsed)) {
    if (parsed.version > EXCHANGE_VERSION) {
      throw new ImportError(
        `Import failed: exchange file format version ${parsed.version} is newer than ` +
          `this build can read (max v${EXCHANGE_VERSION}). Update the app to import this profile.`,
      )
    }
    profileDoc = parsed.profile
  } else {
    // Legacy bare-profile JSON — accept for back-compat with pre-#259 exports.
    profileDoc = parsed
  }

  const result = AircraftProfileSchema.safeParse(profileDoc)

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
 *
 * Emits the {@link ExchangeEnvelope} wrapper (since #259). The output is
 * a JSON object with three keys:
 *   - `format`: always `"aerodash-aircraft"` so the file self-identifies.
 *   - `version`: the {@link EXCHANGE_VERSION} number — older builds detect
 *     this and refuse the import rather than silently dropping new fields.
 *   - `profile`: the {@link AircraftProfile} aggregate.
 *
 * The exported string can be re-imported with {@link importProfileFromJson}.
 */
export function exportProfileToJson(profile: AircraftProfile): string {
  const envelope: ExchangeEnvelope = {
    format: EXCHANGE_FORMAT,
    version: EXCHANGE_VERSION,
    profile,
  }
  return JSON.stringify(envelope, null, 2)
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
