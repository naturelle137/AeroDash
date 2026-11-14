import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { ImportError, importProfileFromJson, validateImportFile } from './profile.import'
import { validateIcaoRegistration } from './profile.validator'

export const MAX_FLEET_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_FLEET_IMPORT_PROFILES = 100

export function validateFleetImportFile(file: File): void {
  validateImportFile(file, MAX_FLEET_IMPORT_BYTES)
}

/** Shared by preview and the transaction, including rows unreadable by this build. */
export function assertNoRegistrationConflicts(
  incoming: readonly Pick<AircraftProfile, 'registration'>[],
  existing: readonly { registration?: unknown }[],
): void {
  const seen = new Set(existing.flatMap((p) =>
    typeof p.registration === 'string' ? [p.registration.trim().toUpperCase()] : [],
  ))
  for (const p of incoming) {
    if (!validateIcaoRegistration(p.registration)) {
      throw new ImportError(`Restore failed: invalid registration "${p.registration}".`)
    }
    const key = p.registration.trim().toUpperCase()
    if (seen.has(key)) {
      throw new ImportError(`Restore conflict: registration "${p.registration}" already exists. No aircraft were imported.`)
    }
    seen.add(key)
  }
}

/** No writes: migrate every record before exposing a confirmable preview. */
export function previewFleetRestore(json: string): AircraftProfile[] {
  if (new TextEncoder().encode(json).byteLength > MAX_FLEET_IMPORT_BYTES) {
    throw new ImportError('Restore failed: backup exceeds the 5 MB limit.')
  }
  let doc: unknown
  try { doc = JSON.parse(json) } catch (err) {
    throw new ImportError('Restore failed: invalid JSON.', err)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new ImportError('Restore failed: expected a fleet backup envelope.')
  }
  const envelope = doc as Record<string, unknown>
  if (envelope.exportSchemaVersion !== 1) {
    throw new ImportError('Restore failed: unsupported fleet backup version. Update the app for newer backups.')
  }
  if (!Array.isArray(envelope.profiles) || !Number.isInteger(envelope.profileCount) ||
      (envelope.profileCount as number) < 1 ||
      (envelope.profileCount as number) > MAX_FLEET_IMPORT_PROFILES ||
      envelope.profiles.length !== envelope.profileCount) {
    throw new ImportError('Restore failed: profile count must match all records (1–100).')
  }
  if (typeof envelope.exportedAt !== 'string' || !Number.isFinite(Date.parse(envelope.exportedAt))) {
    throw new ImportError('Restore failed: invalid export timestamp.')
  }
  const profiles = envelope.profiles.map((p: unknown) => importProfileFromJson(JSON.stringify(p)))
  assertNoRegistrationConflicts(profiles, [])
  return profiles
}
