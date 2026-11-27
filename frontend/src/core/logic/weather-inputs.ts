/**
 * Precedence between the shared Weather inputs and a manual Performance entry — P1.
 *
 * A Performance field that holds any text is a pilot override and is used as a
 * whole, including its unit; only a blank field falls back to the shared value.
 * Nothing is substituted for a value that is blank in both places.
 */
export type WeatherInputSource = 'manual' | 'weather' | 'none'

export interface ResolvedInput<T> { value: T; source: WeatherInputSource }

const blank = (text: string | undefined): boolean => (text ?? '').trim() === ''

export function resolveScalar(override: string, shared: string): ResolvedInput<string> {
  if (!blank(override)) return { value: override, source: 'manual' }
  if (!blank(shared)) return { value: shared, source: 'weather' }
  return { value: '', source: 'none' }
}

export interface QnhInput { qnh: string; qnhUnit: string }

export function resolveQnh(override: QnhInput, shared: QnhInput): ResolvedInput<QnhInput> {
  if (!blank(override.qnh)) return { value: { qnh: override.qnh, qnhUnit: override.qnhUnit }, source: 'manual' }
  if (!blank(shared.qnh)) return { value: { qnh: shared.qnh, qnhUnit: shared.qnhUnit }, source: 'weather' }
  return { value: { qnh: '', qnhUnit: override.qnhUnit }, source: 'none' }
}

export interface WindInput { windDirection: string; windSpeed: string; unit: string; gustSpeed: string }

/** Direction and speed are one observation: an override of either replaces the shared wind entirely. */
export function resolveWind(override: WindInput, shared: WindInput): ResolvedInput<WindInput> {
  if (!blank(override.windDirection) || !blank(override.windSpeed)) return { value: { ...override, gustSpeed: override.gustSpeed ?? '' }, source: 'manual' }
  if (!blank(shared.windDirection) || !blank(shared.windSpeed)) return { value: { ...shared }, source: 'weather' }
  return { value: { ...override, gustSpeed: override.gustSpeed ?? '' }, source: 'none' }
}
