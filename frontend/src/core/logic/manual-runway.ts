import { z } from 'zod'
import { FT_TO_M } from './unit-conversion-constants'

/**
 * Pilot-declared runway inputs. Pure validation, normalization and storage-record
 * recovery; runway assessment and airport-data lookup are separate concerns.
 */

export const RUNWAY_LENGTH_UNITS = ['m', 'ft'] as const
export const FIELD_ELEVATION_UNITS = ['m', 'ft'] as const
export type RunwayLengthUnit = (typeof RUNWAY_LENGTH_UNITS)[number]
export type FieldElevationUnit = (typeof FIELD_ELEVATION_UNITS)[number]

export const SURFACE_TYPES = ['paved', 'unpaved', 'grass'] as const
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
  grass: [
    { value: 'dry-short-grass', label: 'Dry (short grass ≤3 cm)' },
    { value: 'long-grass', label: 'Long grass (>3–8 cm)' },
    { value: 'wet-grass', label: 'Wet' },
    { value: 'soft-ground', label: 'Soft ground' },
    { value: 'damaged-turf', label: 'Damaged turf' },
    { value: 'snow-ice', label: 'Snow / ice' },
  ],
  unpaved: [
    { value: 'wet-unpaved', label: 'Wet' },
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
  /** Optional; blank means no TODA is declared. */
  toda: string
  todaUnit: string
  fieldElevation: string
  fieldElevationUnit: string
  surfaceType: string
  surfaceCondition: string
  source: string
  effectiveDate: string
  expiryDate: string
}
export type ManualRunwayField = keyof ManualRunwayDraft

export const EMPTY_MANUAL_RUNWAY_DRAFT: Readonly<ManualRunwayDraft> = Object.freeze({
  aerodrome: '', designator: '', tora: '', toraUnit: '', lda: '', ldaUnit: '', toda: '', todaUnit: '',
  fieldElevation: '', fieldElevationUnit: '', surfaceType: '', surfaceCondition: '', source: '', effectiveDate: '', expiryDate: '',
})

export function hasManualRunwayDraftContent(draft: ManualRunwayDraft): boolean {
  return (['aerodrome', 'designator', 'tora', 'lda', 'toda', 'fieldElevation', 'surfaceType', 'surfaceCondition', 'source', 'effectiveDate', 'expiryDate'] as const).some((field) => draft[field].trim() !== '')
}

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

const date = z.iso.date()

export const ManualRunwaySchema = z.object({
  aerodrome: identity(MAX_AERODROME_LENGTH),
  designator: identity(MAX_DESIGNATOR_LENGTH),
  tora: positiveDistance,
  lda: positiveDistance,
  toda: positiveDistance.optional(),
  fieldElevation: z.object({
    value: z.number().finite(),
    unit: z.enum(FIELD_ELEVATION_UNITS),
  }).strict(),
  source: identity(200).optional(),
  effectiveDate: date.optional(),
  expiryDate: date.optional(),
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
  source?: string
  effectiveDate?: string
  expiryDate?: string
  tora: { value: number; unit: RunwayLengthUnit }
  lda: { value: number; unit: RunwayLengthUnit }
  /** Declared take-off distance available (clearway included); absent when not declared. */
  toda?: { value: number; unit: RunwayLengthUnit }
  fieldElevation: { value: number; unit: FieldElevationUnit }
  surface: { type: SurfaceType; condition: SurfaceCondition }
}

export const MANUAL_RUNWAY_RECORD_VERSION = 3 as const
export const ManualRunwayRecordSchema = z.object({
  schemaVersion: z.literal(MANUAL_RUNWAY_RECORD_VERSION),
  savedAt: z.iso.datetime(),
  runway: ManualRunwaySchema,
  weatherSurface: z.union([
    z.object({ station: z.string().regex(/^[A-Z]{4}$/), time: z.iso.datetime() }).strict(),
    z.object({ station: z.string().regex(/^[A-Z]{4}$/), time: z.iso.datetime(), source: z.literal('TAF'), validFrom: z.iso.datetime(), validTo: z.iso.datetime() }).strict(),
  ]).optional(),
}).strict()
export type ManualRunwayRecord = {
  schemaVersion: typeof MANUAL_RUNWAY_RECORD_VERSION
  savedAt: string
  runway: ManualRunway
  weatherSurface?: { station: string; time: string; source?: 'TAF'; validFrom?: string; validTo?: string }
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
  const distance = (field: 'tora' | 'lda' | 'toda', unitField: 'toraUnit' | 'ldaUnit' | 'todaUnit', label: string) => {
    const value = parseDecimal(draft[field])
    if (value === null) errors[field] = `Enter ${label} as a finite decimal number.`
    else if (value <= 0) errors[field] = `${label} must be greater than zero.`
    if (!isUnit(RUNWAY_LENGTH_UNITS, draft[unitField])) errors[unitField] = `Select the ${label} unit (m or ft).`
    return value
  }
  const tora = distance('tora', 'toraUnit', 'TORA')
  const lda = distance('lda', 'ldaUnit', 'LDA')
  let toda: number | null = null
  if (draft.toda.trim() !== '') {
    toda = distance('toda', 'todaUnit', 'TODA')
  }
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
  if (toda !== null && tora !== null && !errors.toda && !errors.todaUnit && !errors.toraUnit) {
    const metres = (value: number, unit: string) => unit === 'ft' ? value * FT_TO_M : value
    if (metres(toda, draft.todaUnit) < metres(tora, draft.toraUnit) - 1e-9) errors.toda = 'TODA cannot be shorter than TORA.'
  }
  const source = draft.source.trim()
  if (source && !isIdentity(source, 200)) errors.source = 'Enter a source reference of at most 200 characters without control characters.'
  for (const field of ['effectiveDate', 'expiryDate'] as const) {
    if (draft[field] && !date.safeParse(draft[field]).success) errors[field] = 'Enter a valid date.'
  }
  if (draft.effectiveDate && draft.expiryDate && draft.effectiveDate > draft.expiryDate) errors.expiryDate = 'Expiry must not precede the effective date.'
  if (Object.keys(errors).length) return { status: 'invalid', errors }
  const runway = {
    aerodrome,
    designator,
    ...(source ? { source } : {}),
    ...(draft.effectiveDate ? { effectiveDate: draft.effectiveDate } : {}),
    ...(draft.expiryDate ? { expiryDate: draft.expiryDate } : {}),
    tora: { value: tora!, unit: draft.toraUnit },
    lda: { value: lda!, unit: draft.ldaUnit },
    ...(toda !== null ? { toda: { value: toda, unit: draft.todaUnit } } : {}),
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
    source: runway.source ?? '',
    effectiveDate: runway.effectiveDate ?? '',
    expiryDate: runway.expiryDate ?? '',
    tora: String(runway.tora.value),
    toraUnit: runway.tora.unit,
    lda: String(runway.lda.value),
    ldaUnit: runway.lda.unit,
    toda: runway.toda ? String(runway.toda.value) : '',
    todaUnit: runway.toda?.unit ?? '',
    fieldElevation: String(runway.fieldElevation.value),
    fieldElevationUnit: runway.fieldElevation.unit,
    surfaceType: runway.surface.type,
    surfaceCondition: runway.surface.condition,
  }
}

export function sameManualRunway(a: ManualRunway, b: ManualRunway): boolean {
  return a.aerodrome === b.aerodrome && a.designator === b.designator
    && a.source === b.source && a.effectiveDate === b.effectiveDate && a.expiryDate === b.expiryDate
    && a.tora.value === b.tora.value && a.tora.unit === b.tora.unit
    && a.lda.value === b.lda.value && a.lda.unit === b.lda.unit
    && a.toda?.value === b.toda?.value && a.toda?.unit === b.toda?.unit
    && a.fieldElevation.value === b.fieldElevation.value && a.fieldElevation.unit === b.fieldElevation.unit
    && a.surface.type === b.surface.type && a.surface.condition === b.surface.condition
}

export type NormalizedManualRunway = {
  toraM: number
  ldaM: number
  /** Present only when a TODA was declared. */
  todaM?: number
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
    ...(runway.toda ? { todaM: metres(runway.toda.value, runway.toda.unit) } : {}),
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
  if (typeof value === 'object' && value !== null && 'schemaVersion' in value && value.schemaVersion === 1) {
    const legacy = z.object({ schemaVersion: z.literal(1), savedAt: z.iso.datetime(), runway: ManualRunwaySchema.omit({ effectiveDate: true, expiryDate: true, source: true }) }).strict().safeParse(value)
    if (!legacy.success) return { status: 'corrupt' }
    value = { ...legacy.data, schemaVersion: MANUAL_RUNWAY_RECORD_VERSION }
  }
  if (typeof value === 'object' && value !== null && 'schemaVersion' in value && value.schemaVersion === 2) {
    const legacy = z.object({ schemaVersion: z.literal(2), savedAt: z.iso.datetime(), runway: ManualRunwaySchema }).strict().safeParse(value)
    if (!legacy.success) return { status: 'corrupt' }
    value = { ...legacy.data, schemaVersion: MANUAL_RUNWAY_RECORD_VERSION }
  }
  const parsed = ManualRunwayRecordSchema.safeParse(value)
  if (!parsed.success || (parsed.data.runway.effectiveDate && parsed.data.runway.expiryDate && parsed.data.runway.effectiveDate > parsed.data.runway.expiryDate)) return { status: 'corrupt' }
  return { status: 'loaded', record: parsed.data as ManualRunwayRecord }
}

export type ManualRunwayDisplay = { toraM: string; ldaM: string; todaM?: string; fieldElevationM: string; fieldElevationFt: string }

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
    ...(normalized.todaM !== undefined ? { todaM: down(normalized.todaM) } : {}),
    fieldElevationM: nearest(normalized.fieldElevationM),
    fieldElevationFt: nearest(normalized.fieldElevationFt),
  }
}

/** Date-only assessment; an AIRAC boundary does not expire a record. */
export function runwayFreshness(runway: Pick<ManualRunway, 'effectiveDate' | 'expiryDate'>, today: string): 'unknown' | 'not-yet-effective' | 'expired' | 'within-declared-dates' {
  if (!date.safeParse(today).success ||
      (runway.effectiveDate && !date.safeParse(runway.effectiveDate).success) ||
      (runway.expiryDate && !date.safeParse(runway.expiryDate).success) ||
      (runway.effectiveDate && runway.expiryDate && runway.effectiveDate > runway.expiryDate)) return 'unknown'
  if (runway.effectiveDate && today < runway.effectiveDate) return 'not-yet-effective'
  if (runway.expiryDate && today > runway.expiryDate) return 'expired'
  if (runway.effectiveDate && runway.expiryDate) return 'within-declared-dates'
  return 'unknown'
}

/** Days to the pilot-declared effective date, not a source-currency verdict. */
export function daysToDeclaredEffect(runway: Pick<ManualRunway, 'effectiveDate'>, checkDate: string): number | null {
  if (!runway.effectiveDate || !date.safeParse(runway.effectiveDate).success || !date.safeParse(checkDate).success) return null
  return (Date.parse(`${runway.effectiveDate}T00:00:00Z`) - Date.parse(`${checkDate}T00:00:00Z`)) / 86400000
}

/** Days to the pilot-declared inclusive expiry, not a source-currency verdict. */
export function daysToDeclaredExpiry(runway: Pick<ManualRunway, 'expiryDate'>, checkDate: string): number | null {
  if (!runway.expiryDate || !date.safeParse(runway.expiryDate).success || !date.safeParse(checkDate).success) return null
  return (Date.parse(`${runway.expiryDate}T00:00:00Z`) - Date.parse(`${checkDate}T00:00:00Z`)) / 86400000
}

/** Calendar dates within EUROCONTROL's published 2020–2028 schedule. */
export function airacCycleStart(today: string): string | null {
  if (!date.safeParse(today).success || today < '2020-01-02' || today > '2028-12-21') return null
  const anchor = Date.UTC(2026, 9, 29)
  const day = Date.parse(`${today}T00:00:00Z`)
  return new Date(anchor + Math.floor((day - anchor) / (28 * 86400000)) * 28 * 86400000).toISOString().slice(0, 10)
}

/**
 * AIRAC cycles between the cycle containing the record's save date (UTC) and the check
 * date. Calendar arithmetic only: it says how old the stored declaration is, not whether
 * it is superseded. Null when either date lies outside the published schedule or the
 * record was saved after the check date.
 */
export function airacCyclesSinceSave(savedAt: string, checkDate: string): number | null {
  const saved = airacCycleStart(savedAt.slice(0, 10))
  const check = airacCycleStart(checkDate)
  if (!saved || !check || checkDate < savedAt.slice(0, 10)) return null
  return (Date.parse(`${check}T00:00:00Z`) - Date.parse(`${saved}T00:00:00Z`)) / (28 * 86400000)
}

/** Pilot-facing wording; 0 and unknown are kept distinct and neither verifies the record. */
export function describeAiracAge(cycles: number | null): string {
  if (cycles === null) return 'Unknown (date outside the published AIRAC schedule or before the save date); no staleness verdict'
  if (cycles === 0) return 'Saved in the current AIRAC cycle; source currency remains unverified'
  return `${cycles} AIRAC cycle${cycles === 1 ? '' : 's'} since saved; the declaration may be superseded, re-verify against the current AIP`
}
