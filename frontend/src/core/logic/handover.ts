import {
  CURRENT_HANDOVER_VERSION,
  HANDOVER_FORMAT,
  HandoverFileSchema,
  MAX_HANDOVER_BYTES,
  type HandoverFile,
} from '../domain/handover.schema'

export type HandoverParseResult =
  | { readonly ok: true; readonly file: HandoverFile }
  | { readonly ok: false; readonly error: string }

type HandoverContent = Pick<HandoverFile, 'aircraft' | 'massBalance' | 'entries'>

/** Serialise typed entries as an unreviewed, unsigned handover file. */
export function buildHandoverFile(content: HandoverContent, exportedAt: Date): string {
  const file: HandoverFile = {
    format: HANDOVER_FORMAT,
    version: CURRENT_HANDOVER_VERSION,
    exportedAt: exportedAt.toISOString(),
    review: 'unreviewed',
    ...content,
  }
  return JSON.stringify(file, null, 2)
}

/** Validate untrusted text; nothing is applied here. */
export function parseHandoverFile(text: string): HandoverParseResult {
  if (new TextEncoder().encode(text).byteLength > MAX_HANDOVER_BYTES) {
    return { ok: false, error: 'Handover file is larger than 256 KB.' }
  }
  let doc: unknown
  try { doc = JSON.parse(text) } catch { return { ok: false, error: 'Handover file is not valid JSON.' } }
  if (typeof doc === 'object' && doc !== null && (doc as { version?: unknown }).version !== undefined
      && (doc as { version?: unknown }).version !== CURRENT_HANDOVER_VERSION) {
    return { ok: false, error: 'Handover file version is not supported by this build.' }
  }
  const parsed = HandoverFileSchema.safeParse(doc)
  return parsed.success
    ? { ok: true, file: parsed.data }
    : { ok: false, error: 'Handover file is not a valid unreviewed AeroDash handover.' }
}

/**
 * Null when the file belongs to the loaded aircraft; otherwise the reason it
 * must not be applied. Weights are matched by station, so the layout must be
 * identical to the one the file was written for.
 */
export function handoverMismatch(
  file: HandoverFile,
  aircraft: { registration: string; stationNames: readonly string[]; categories: readonly string[] },
): string | null {
  if (file.aircraft.registration.trim().toUpperCase() !== aircraft.registration.trim().toUpperCase()) {
    return `The file is for ${file.aircraft.registration}. Load that aircraft first.`
  }
  const names = file.massBalance.stations.map((s) => s.name)
  if (names.length !== aircraft.stationNames.length || names.some((n, i) => n !== aircraft.stationNames[i])) {
    return 'The loading stations differ from this device\'s profile of the aircraft; nothing was imported.'
  }
  if (!aircraft.categories.includes(file.massBalance.activeCategory)) {
    return 'The certification category in the file is not in this device\'s profile; nothing was imported.'
  }
  return null
}
