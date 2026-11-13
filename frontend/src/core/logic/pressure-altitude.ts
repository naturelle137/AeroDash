import { FT_TO_M } from './unit-conversion-constants'

/**
 * Pressure altitude at an aerodrome from a pilot-entered QNH (altimeter setting)
 * and field elevation. Pure and deterministic; no weather source, default or
 * aircraft data.
 *
 * Model: the two NOAA/NWS (El Paso) formula sheets, applied to the same station
 * pressure P (hPa), with n = 0.190284 and h the station elevation in m:
 *   altimeter setting  A = (P − 0.3) · (1 + (1013.25^n · 0.0065 / 288) · h / (P − 0.3)^n)^(1/n)
 *   pressure altitude  PA = 145366.45 · (1 − (P / 1013.25)^n) ft
 * Solving the first for P gives P = (A^n − 1013.25^n · 0.0065 / 288 · h)^(1/n) + 0.3,
 * which the second turns into PA. The 0.3 hPa term is kept exactly as published.
 * This is the standard-atmosphere definition of the setting, not an aircraft
 * model; the linear "30 ft per hPa" rule is only an approximation of it.
 */

/** NWS pressure-altitude coefficient (ft). */
export const PRESSURE_ALTITUDE_COEFFICIENT_FT = 145366.45 as const
/** NWS standard-atmosphere exponent. */
export const PRESSURE_ALTITUDE_EXPONENT = 0.190284 as const
/** Standard sea-level pressure (hPa). */
export const STANDARD_PRESSURE_HPA = 1013.25 as const
/** NWS altimeter-setting pressure term subtracted from station pressure (hPa). */
export const ALTIMETER_SETTING_OFFSET_HPA = 0.3 as const
/** NWS altimeter-setting lapse rate (K/m). */
export const ALTIMETER_SETTING_LAPSE_RATE_K_PER_M = 0.0065 as const
/** NWS altimeter-setting reference temperature (K). */
export const ALTIMETER_SETTING_TEMPERATURE_K = 288 as const

export const QNH_UNITS = ['hPa'] as const
export type QnhUnit = (typeof QNH_UNITS)[number]
export const PA_ELEVATION_UNITS = ['ft', 'm'] as const
export type PaElevationUnit = (typeof PA_ELEVATION_UNITS)[number]

/**
 * Software input bounds for ordinary aerodrome use, not limits of the atmosphere
 * model; accepted results stay between about −3800 ft and +19770 ft.
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
  /** Nearest whole foot, display only. */
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

/** Station pressure (hPa) whose NWS altimeter setting at this elevation equals the QNH. */
export function stationPressureFromQnh(qnhHpa: number, elevationFt: number): number {
  const n = PRESSURE_ALTITUDE_EXPONENT
  const reduced = Math.pow(qnhHpa, n)
    - Math.pow(STANDARD_PRESSURE_HPA, n) * ALTIMETER_SETTING_LAPSE_RATE_K_PER_M / ALTIMETER_SETTING_TEMPERATURE_K
    * elevationFt * FT_TO_M
  return Math.pow(reduced, 1 / n) + ALTIMETER_SETTING_OFFSET_HPA
}

/** NWS pressure altitude (ft) of a station pressure (hPa). */
export function pressureAltitudeFromStationPressure(stationHpa: number): number {
  return PRESSURE_ALTITUDE_COEFFICIENT_FT
    * (1 - Math.pow(stationHpa / STANDARD_PRESSURE_HPA, PRESSURE_ALTITUDE_EXPONENT))
}

/** Cited NWS equations for already validated inputs inside the supported domain. */
export function pressureAltitudeFromQnh(qnhHpa: number, elevationFt: number): number {
  return pressureAltitudeFromStationPressure(stationPressureFromQnh(qnhHpa, elevationFt))
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
    displayPressureAltitudeFt: Math.round(pressureAltitudeFt) + 0,
    warnings: { qnhOutsideAdvisoryRange: qnh < QNH_ADVISORY_HPA.min || qnh > QNH_ADVISORY_HPA.max },
  }
}
