/**
 * Runway wind components from explicit, pilot-entered values — P1.
 *
 * Direction and heading must share one reference (both magnetic or both true);
 * the function cannot check that. Components are advisory and never feed
 * performance corrections.
 */
export const WIND_SPEED_UNITS = ['kt', 'km/h', 'm/s'] as const
export type WindSpeedUnit = (typeof WIND_SPEED_UNITS)[number]

export type WindComponentField = 'runwayHeading' | 'windDirection' | 'windSpeed' | 'unit'
export interface WindComponentInput { runwayHeading: string; windDirection: string; windSpeed: string; unit: string }
export type WindComponentResult =
  | { status: 'incomplete' }
  | { status: 'invalid'; errors: Partial<Record<WindComponentField, string>> }
  | {
      status: 'valid'
      unit: WindSpeedUnit
      /** Positive = headwind, negative = tailwind; rounded to 0.1. */
      headwind: number
      /** Positive = wind from the right of the runway heading, negative = from the left. */
      crosswind: number
    }

const NUMBER = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/
const MAX_SPEED = 200

function parse(text: string): number | undefined {
  const trimmed = text.trim()
  if (!NUMBER.test(trimmed)) return undefined
  const value = Number(trimmed.replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
}
function bearing(text: string, label: string): { value?: number; error?: string } {
  const value = parse(text)
  if (value === undefined) return { error: `${label} must be a number from 1 to 360 degrees; variable direction is not supported.` }
  if (value < 1 || value > 360) return { error: `${label} must be from 1 to 360 degrees.` }
  return { value }
}
function round(value: number): number {
  const rounded = Math.round(value * 10) / 10
  return rounded === 0 ? 0 : rounded
}

export function computeWindComponents(input: WindComponentInput): WindComponentResult {
  const heading = input.runwayHeading.trim()
  const direction = input.windDirection.trim()
  const speedText = input.windSpeed.trim()
  if (!heading && !direction && !speedText) return { status: 'incomplete' }

  const errors: Partial<Record<WindComponentField, string>> = {}
  const unit = WIND_SPEED_UNITS.find((u) => u === input.unit)
  if (!unit) errors.unit = 'Select a wind speed unit.'

  const speed = parse(speedText)
  if (!speedText) errors.windSpeed = 'Enter the wind speed (0 for calm).'
  else if (speed === undefined || speed < 0 || speed > MAX_SPEED) errors.windSpeed = `Wind speed must be a number from 0 to ${MAX_SPEED}.`

  const runway = heading ? bearing(heading, 'Runway heading') : { error: 'Enter the runway heading.' }
  if (runway.error) errors.runwayHeading = runway.error

  // Calm wind has no meaningful direction, so it may be left blank.
  const calm = speed === 0
  const wind = direction || !calm ? (direction ? bearing(direction, 'Wind direction') : { error: 'Enter the wind direction.' }) : {}
  if (wind.error) errors.windDirection = wind.error

  if (Object.keys(errors).length || !unit || speed === undefined || runway.value === undefined) return { status: 'invalid', errors }
  if (calm) return { status: 'valid', unit, headwind: 0, crosswind: 0 }
  const angle = ((wind.value! - runway.value) * Math.PI) / 180
  return { status: 'valid', unit, headwind: round(speed * Math.cos(angle)), crosswind: round(speed * Math.sin(angle)) }
}
