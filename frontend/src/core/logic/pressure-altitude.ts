import { FT_TO_M } from './unit-conversion-constants'

/**
 * QNH inversion of the ICAO Doc 9837 §9.2.2 standard-atmosphere relationship,
 * consistent with WMO-No. 8 Part II §2.9.1 (see the architecture contract).
 * Inputs are pilot-entered QNH and field elevation, never station pressure.
 */
/** Standard sea-level pressure (hPa). */
export const STANDARD_PRESSURE_HPA = 1013.25 as const
/** Standard-atmosphere reference temperature (K). */
export const STANDARD_TEMPERATURE_K = 288.15 as const
/** Standard-atmosphere tropospheric lapse rate (K/m). */
export const STANDARD_LAPSE_RATE_K_PER_M = 0.0065 as const
/** Pressure exponent in the cited QNH equation. */
export const QNH_PRESSURE_EXPONENT = 5.25588 as const

export const QNH_UNITS = ['hPa'] as const
export type QnhUnit = (typeof QNH_UNITS)[number]
export const PA_ELEVATION_UNITS = ['ft', 'm'] as const
export type PaElevationUnit = (typeof PA_ELEVATION_UNITS)[number]

/**
 * Software input bounds for ordinary aerodrome use, not limits of the atmosphere
 * model; accepted results stay between about −3800 ft and +19782 ft.
 */
export const QNH_SUPPORTED_HPA = { min: 850, max: 1100 } as const
export const ELEVATION_SUPPORTED_FT = { min: -1500, max: 15000 } as const
/** REQ-UI-008 warning band; inside the supported domain this warns and never blocks. */
export const QNH_ADVISORY_HPA = { min: 950, max: 1100 } as const

export type PressureAltitudeDraft = {
  qnh: string
  qnhUnit: string
  elevation: string
  elevationUnit: string
}
export type PressureAltitudeField = keyof PressureAltitudeDraft

export type DerivedPressureAltitude = {
  status: 'valid'
  qnh: { value: number; unit: QnhUnit }
  elevation: { value: number; unit: PaElevationUnit }
  elevationFt: number
  /** Unrounded; lookups use this value. */
  pressureAltitudeFt: number
  /** Whole foot rounded toward positive infinity, display only. */
  displayPressureAltitudeFt: number
  warnings: { qnhOutsideAdvisoryRange: boolean }
}
export type PressureAltitudeDerivation =
  | DerivedPressureAltitude
  | { status: 'invalid'; errors: Partial<Record<PressureAltitudeField, string>> }

// Decimal/scientific notation only; Number() also accepts hexadecimal, binary and blank text.
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

function parseDecimal(text: string): number | null {
  const trimmed = text.trim()
  if (!DECIMAL.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/** QNH relationship for already validated inputs inside the supported domain. */
export function pressureAltitudeFromQnh(qnhHpa: number, elevationFt: number): number {
  return elevationFt + STANDARD_TEMPERATURE_K / (STANDARD_LAPSE_RATE_K_PER_M * FT_TO_M)
    * (1 - Math.pow(qnhHpa / STANDARD_PRESSURE_HPA, 1 / QNH_PRESSURE_EXPONENT))
}

/** Validates the raw text form; an empty field or missing unit never becomes a default. */
export function derivePressureAltitude(draft: PressureAltitudeDraft): PressureAltitudeDerivation {
  const errors: Partial<Record<PressureAltitudeField, string>> = {}
  const qnh = parseDecimal(draft.qnh)
  const elevation = parseDecimal(draft.elevation)
  const qnhUnit = (QNH_UNITS as readonly string[]).includes(draft.qnhUnit) ? draft.qnhUnit as QnhUnit : null
  const elevationUnit = (PA_ELEVATION_UNITS as readonly string[]).includes(draft.elevationUnit)
    ? draft.elevationUnit as PaElevationUnit
    : null

  if (!qnhUnit) errors.qnhUnit = 'Select the QNH unit (hPa).'
  if (qnh === null) errors.qnh = 'Enter QNH as a finite decimal number.'
  else if (qnh < QNH_SUPPORTED_HPA.min || qnh > QNH_SUPPORTED_HPA.max) {
    errors.qnh = `QNH ${qnh} hPa is outside the supported ${QNH_SUPPORTED_HPA.min}–${QNH_SUPPORTED_HPA.max} hPa model range.`
  }

  if (!elevationUnit) errors.elevationUnit = 'Select the field elevation unit (ft or m).'
  if (elevation === null) errors.elevation = 'Enter field elevation as a finite decimal number.'
  let elevationFt: number | null = null
  if (elevation !== null && elevationUnit) {
    elevationFt = elevationUnit === 'ft' ? elevation : elevation / FT_TO_M
    if (elevationFt < ELEVATION_SUPPORTED_FT.min || elevationFt > ELEVATION_SUPPORTED_FT.max) {
      errors.elevation = `Field elevation is outside the supported ${ELEVATION_SUPPORTED_FT.min} to ${ELEVATION_SUPPORTED_FT.max} ft (${(ELEVATION_SUPPORTED_FT.min * FT_TO_M).toFixed(1)} to ${(ELEVATION_SUPPORTED_FT.max * FT_TO_M).toFixed(1)} m) model range.`
    }
  }

  if (Object.keys(errors).length || qnh === null || !qnhUnit || elevation === null || !elevationUnit || elevationFt === null) {
    return { status: 'invalid', errors }
  }
  const pressureAltitudeFt = pressureAltitudeFromQnh(qnh, elevationFt)
  return {
    status: 'valid',
    qnh: { value: qnh, unit: qnhUnit },
    elevation: { value: elevation, unit: elevationUnit },
    elevationFt,
    pressureAltitudeFt,
    // Adding zero normalizes −0 so a display never shows "-0".
    displayPressureAltitudeFt: Math.ceil(pressureAltitudeFt) + 0,
    warnings: { qnhOutsideAdvisoryRange: qnh < QNH_ADVISORY_HPA.min || qnh > QNH_ADVISORY_HPA.max },
  }
}
