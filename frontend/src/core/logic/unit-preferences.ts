import { z } from 'zod'
import { FT_TO_M } from './unit-conversion-constants'

/**
 * Pilot display-unit preferences for Performance inputs. Pure validation and
 * conversion; persistence lives in the shell. AeroDash reads no locale or region,
 * so fresh preferences use the fixed fallback hPa / ft / ft / m.
 */

export const LENGTH_UNITS = ['m', 'ft'] as const
export type LengthUnit = (typeof LENGTH_UNITS)[number]

export const UnitPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  /** Only hPa is supported for QNH input. */
  qnh: z.literal('hPa'),
  /** Direct pressure altitude is always entered in ft. */
  pressureAltitude: z.literal('ft'),
  fieldElevation: z.enum(LENGTH_UNITS),
  runwayDistance: z.enum(LENGTH_UNITS),
}).strict()
export type UnitPreferences = z.infer<typeof UnitPreferencesSchema>

export const DEFAULT_UNIT_PREFERENCES: Readonly<UnitPreferences> = Object.freeze({
  schemaVersion: 1,
  qnh: 'hPa',
  pressureAltitude: 'ft',
  fieldElevation: 'ft',
  runwayDistance: 'm',
})

export type UnitPreferencesRecovery =
  | { status: 'empty' }
  | { status: 'loaded'; preferences: UnitPreferences }
  | { status: 'invalid' }

export function recoverUnitPreferences(raw: string | null): UnitPreferencesRecovery {
  if (raw === null) return { status: 'empty' }
  try {
    const parsed = UnitPreferencesSchema.safeParse(JSON.parse(raw))
    return parsed.success ? { status: 'loaded', preferences: parsed.data } : { status: 'invalid' }
  } catch {
    return { status: 'invalid' }
  }
}

/** Fractional digits kept after converting entered text; error ≤ 0.00005 of the target unit. */
export const CONVERTED_TEXT_DECIMALS = 4

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

/**
 * Converts the same physical length when the pilot changes a unit. Returns null
 * for blank or non-numeric text, which the caller keeps unchanged for validation.
 */
export function convertLengthText(text: string, from: LengthUnit, to: LengthUnit): string | null {
  const trimmed = text.trim()
  if (!DECIMAL.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  if (from === to) return trimmed
  const converted = from === 'm' ? value / FT_TO_M : value * FT_TO_M
  // Number() removes trailing zeros; adding 0 turns -0 into 0.
  return String(Number(converted.toFixed(CONVERTED_TEXT_DECIMALS)) + 0)
}

export function isLengthUnit(value: string): value is LengthUnit {
  return (LENGTH_UNITS as readonly string[]).includes(value)
}
