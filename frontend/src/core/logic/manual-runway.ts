import { z } from 'zod'
import { FT_TO_M } from './unit-conversion-constants'

/**
 * Pilot-declared runway inputs. Pure validation, normalization and storage-record
 * recovery; no runway assessment, correction factor or airport-data lookup.
 */

export const RUNWAY_LENGTH_UNITS = ['m', 'ft'] as const
export const FIELD_ELEVATION_UNITS = ['m', 'ft'] as const
export type RunwayLengthUnit = (typeof RUNWAY_LENGTH_UNITS)[number]
export type FieldElevationUnit = (typeof FIELD_ELEVATION_UNITS)[number]

export const SURFACE_TYPES = ['paved', 'unpaved'] as const
export type SurfaceType = (typeof SURFACE_TYPES)[number]

/** Condition lists follow REQ-AP-004 (paved) and REQ-AP-008 (grass/unpaved). */
export const SURFACE_CONDITIONS = {
  paved: [
    { value: 'dry', label: 'Dry' },
    { value: 'wet', label: 'Wet' },
    { value: 'standing-water', label: 'Standing water' },
    { value: 'slush', label: 'Slush' },
    { value: 'snow', label: 'Snow' },
    { value: 'ice', label: 'Ice' },
  ],
  unpaved: [
    { value: 'dry-short-grass', label: 'Dry (short grass ≤3 cm)' },
    { value: 'long-grass', label: 'Long grass (>3–8 cm)' },
    { value: 'wet-soft-ground', label: 'Wet / soft ground' },
    { value: 'damaged-turf', label: 'Damaged turf' },
    { value: 'snow-ice', label: 'Snow / ice' },
  ],
} as const satisfies Record<SurfaceType, readonly { value: string; label: string }[]>
export type SurfaceCondition = (typeof SURFACE_CONDITIONS)[SurfaceType][number]['value']

export const MAX_AERODROME_LENGTH = 40
export const MAX_DESIGNATOR_LENGTH = 20

/** Raw form state: every field is text so an empty field can never become zero. */
export type ManualRunwayDraft = {
  aerodrome: string
  designator: string
  tora: string
  toraUnit: string
  lda: string
  ldaUnit: string
  fieldElevation: string
  fieldElevationUnit: string
  surfaceType: string
  surfaceCondition: string
}
export type ManualRunwayField = keyof ManualRunwayDraft

export const EMPTY_MANUAL_RUNWAY_DRAFT: Readonly<ManualRunwayDraft> = Object.freeze({
  aerodrome: '', designator: '', tora: '', toraUnit: '', lda: '', ldaUnit: '',
  fieldElevation: '', fieldElevationUnit: '', surfaceType: '', surfaceCondition: '',
})

/** Control characters are never part of a runway or aerodrome identity. */
function hasControlCharacter(text: string): boolean {
  return [...text].some((char) => {
    const code = char.codePointAt(0)!
    return code < 0x20 || code === 0x7f
  })
}
function isIdentity(text: string, max: number): boolean {
  return text.length > 0 && text.length <= max && !hasControlCharacter(text)
}
const identity = (max: number) => z.string().refine((text) => text.trim() === text && isIdentity(text, max))
const positiveDistance = z.object({
  value: z.number().finite().positive(),
  unit: z.enum(RUNWAY_LENGTH_UNITS),
}).strict()

export const ManualRunwaySchema = z.object({
  aerodrome: identity(MAX_AERODROME_LENGTH),
  designator: identity(MAX_DESIGNATOR_LENGTH),
  tora: positiveDistance,
  lda: positiveDistance,
  fieldElevation: z.object({
    value: z.number().finite(),
    unit: z.enum(FIELD_ELEVATION_UNITS),
  }).strict(),
  surface: z.object({
    type: z.enum(SURFACE_TYPES),
    condition: z.string(),
  }).strict().refine(
    (surface) => SURFACE_CONDITIONS[surface.type].some((option) => option.value === surface.condition),
    { message: 'Surface condition does not belong to the surface type.' },
  ),
}).strict()
export type ManualRunway = {
  aerodrome: string
  designator: string
  tora: { value: number; unit: RunwayLengthUnit }
  lda: { value: number; unit: RunwayLengthUnit }
  fieldElevation: { value: number; unit: FieldElevationUnit }
  surface: { type: SurfaceType; condition: SurfaceCondition }
}

export const MANUAL_RUNWAY_RECORD_VERSION = 1 as const
export const ManualRunwayRecordSchema = z.object({
  schemaVersion: z.literal(MANUAL_RUNWAY_RECORD_VERSION),
  savedAt: z.iso.datetime(),
  runway: ManualRunwaySchema,
}).strict()
export type ManualRunwayRecord = {
  schemaVersion: typeof MANUAL_RUNWAY_RECORD_VERSION
  savedAt: string
  runway: ManualRunway
}

export type ManualRunwayValidation =
  | { status: 'valid'; runway: ManualRunway }
  | { status: 'invalid'; errors: Partial<Record<ManualRunwayField, string>> }

// Decimal/scientific notation only; Number() also accepts hexadecimal, binary and blank text.
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

function parseDecimal(text: string): number | null {
  const trimmed = text.trim()
  if (!DECIMAL.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function isUnit<T extends string>(units: readonly T[], value: string): value is T {
  return (units as readonly string[]).includes(value)
}

function isSurfaceType(value: string): value is SurfaceType {
  return isUnit(SURFACE_TYPES, value)
}

/** Validate every field and report all failures; never fill a missing value. */
export function validateManualRunway(draft: ManualRunwayDraft): ManualRunwayValidation {
  const errors: Partial<Record<ManualRunwayField, string>> = {}
  const aerodrome = draft.aerodrome.trim()
  const designator = draft.designator.trim()
  if (!isIdentity(aerodrome, MAX_AERODROME_LENGTH)) {
    errors.aerodrome = `Enter an aerodrome identifier or name (1–${MAX_AERODROME_LENGTH} characters).`
  }
  if (!isIdentity(designator, MAX_DESIGNATOR_LENGTH)) {
    errors.designator = `Enter a runway designator (1–${MAX_DESIGNATOR_LENGTH} characters).`
  }
  const distance = (field: 'tora' | 'lda', unitField: 'toraUnit' | 'ldaUnit', label: string) => {
    const value = parseDecimal(draft[field])
    if (value === null) errors[field] = `Enter ${label} as a finite decimal number.`
    else if (value <= 0) errors[field] = `${label} must be greater than zero.`
    if (!isUnit(RUNWAY_LENGTH_UNITS, draft[unitField])) errors[unitField] = `Select the ${label} unit (m or ft).`
    return value
  }
  const tora = distance('tora', 'toraUnit', 'TORA')
  const lda = distance('lda', 'ldaUnit', 'LDA')
  const elevation = parseDecimal(draft.fieldElevation)
  if (elevation === null) errors.fieldElevation = 'Enter field elevation as a finite decimal number (zero and negative values are allowed).'
  if (!isUnit(FIELD_ELEVATION_UNITS, draft.fieldElevationUnit)) errors.fieldElevationUnit = 'Select the field elevation unit (m or ft).'
  const surfaceType = draft.surfaceType
  if (!isSurfaceType(surfaceType)) {
    errors.surfaceType = 'Select the runway surface type.'
    errors.surfaceCondition = 'Select the surface condition.'
  } else if (!SURFACE_CONDITIONS[surfaceType].some((option) => option.value === draft.surfaceCondition)) {
    errors.surfaceCondition = 'Select the surface condition.'
  }
  if (Object.keys(errors).length) return { status: 'invalid', errors }
  const runway = {
    aerodrome,
    designator,
    tora: { value: tora!, unit: draft.toraUnit },
    lda: { value: lda!, unit: draft.ldaUnit },
    fieldElevation: { value: elevation!, unit: draft.fieldElevationUnit },
    surface: { type: surfaceType, condition: draft.surfaceCondition },
  }
  // The schema is the single persisted contract; validating here keeps both paths identical.
  const parsed = ManualRunwaySchema.safeParse(runway)
  if (!parsed.success) return { status: 'invalid', errors: { aerodrome: 'Runway inputs could not be validated.' } }
  return { status: 'valid', runway: parsed.data as ManualRunway }
}

/** Render the stored original values back into editable text without unit conversion. */
export function draftFromManualRunway(runway: ManualRunway): ManualRunwayDraft {
  return {
    aerodrome: runway.aerodrome,
    designator: runway.designator,
    tora: String(runway.tora.value),
    toraUnit: runway.tora.unit,
    lda: String(runway.lda.value),
    ldaUnit: runway.lda.unit,
    fieldElevation: String(runway.fieldElevation.value),
    fieldElevationUnit: runway.fieldElevation.unit,
    surfaceType: runway.surface.type,
    surfaceCondition: runway.surface.condition,
  }
}

export function sameManualRunway(a: ManualRunway, b: ManualRunway): boolean {
  return a.aerodrome === b.aerodrome && a.designator === b.designator
    && a.tora.value === b.tora.value && a.tora.unit === b.tora.unit
    && a.lda.value === b.lda.value && a.lda.unit === b.lda.unit
    && a.fieldElevation.value === b.fieldElevation.value && a.fieldElevation.unit === b.fieldElevation.unit
    && a.surface.type === b.surface.type && a.surface.condition === b.surface.condition
}

export type NormalizedManualRunway = {
  toraM: number
  ldaM: number
  fieldElevationM: number
  fieldElevationFt: number
}

/**
 * Normalized copies for display and future comparison; the original values stay authoritative.
 * International foot, NIST SP 811 Appendix B.9: 1 ft = 0.3048 m exactly.
 * Field elevation is geometric; it is never a pressure altitude.
 */
export function normalizeManualRunway(runway: ManualRunway): NormalizedManualRunway | null {
  const metres = (value: number, unit: 'm' | 'ft') => unit === 'ft' ? value * FT_TO_M : value
  const elevationM = metres(runway.fieldElevation.value, runway.fieldElevation.unit)
  const normalized = {
    toraM: metres(runway.tora.value, runway.tora.unit),
    ldaM: metres(runway.lda.value, runway.lda.unit),
    fieldElevationM: elevationM,
    fieldElevationFt: runway.fieldElevation.unit === 'ft' ? runway.fieldElevation.value : elevationM / FT_TO_M,
  }
  if (Object.values(normalized).some((value) => !Number.isFinite(value))) return null
  if (normalized.toraM <= 0 || normalized.ldaM <= 0) return null
  return normalized
}

export function createManualRunwayRecord(runway: ManualRunway, savedAt: Date): ManualRunwayRecord {
  return { schemaVersion: MANUAL_RUNWAY_RECORD_VERSION, savedAt: savedAt.toISOString(), runway }
}

export type ManualRunwayRecovery =
  | { status: 'empty' }
  | { status: 'loaded'; record: ManualRunwayRecord }
  | { status: 'corrupt' }
  | { status: 'unsupported-version'; schemaVersion: number }

/** Recover a stored record; anything not exactly matching the versioned contract is not used. */
export function recoverManualRunwayRecord(raw: string | null): ManualRunwayRecovery {
  if (raw === null) return { status: 'empty' }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { status: 'corrupt' }
  }
  if (typeof value === 'object' && value !== null && 'schemaVersion' in value) {
    const version = (value as { schemaVersion: unknown }).schemaVersion
    if (typeof version === 'number' && Number.isInteger(version) && version > MANUAL_RUNWAY_RECORD_VERSION) {
      return { status: 'unsupported-version', schemaVersion: version }
    }
  }
  const parsed = ManualRunwayRecordSchema.safeParse(value)
  if (!parsed.success) return { status: 'corrupt' }
  return { status: 'loaded', record: parsed.data as ManualRunwayRecord }
}

export type ManualRunwayDisplay = { toraM: string; ldaM: string; fieldElevationM: string; fieldElevationFt: string }

/**
 * Available distances round down to 0.1 m so display never overstates them; a tiny
 * tolerance absorbs IEEE-754 artefacts such as 1000 ft × 0.3048 = 304.79999….
 * Elevation is informational and rounds to the nearest 0.1.
 */
export function formatNormalizedManualRunway(normalized: NormalizedManualRunway): ManualRunwayDisplay {
  const down = (value: number) => (Math.floor(value * 10 + 1e-6) / 10).toFixed(1)
  const nearest = (value: number) => {
    const rounded = (Math.round(value * 10) / 10).toFixed(1)
    return rounded === '-0.0' ? '0.0' : rounded
  }
  return {
    toraM: down(normalized.toraM),
    ldaM: down(normalized.ldaM),
    fieldElevationM: nearest(normalized.fieldElevationM),
    fieldElevationFt: nearest(normalized.fieldElevationFt),
  }
}
