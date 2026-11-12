import {
  PerformanceProfileSchema,
  type AircraftProfilePerformanceProfile,
  type AircraftProfilePerformanceDataPoint,
} from './aircraft.schema'

export const LEGACY_PERFORMANCE_UNITS = {
  mass: 'kg', pressureAltitude: 'ft', temperature: '°C', distance: 'm',
} as const

export type NormalizedPerformanceTable = {
  flightPhase: AircraftProfilePerformanceProfile['flightPhase']
  dataPoints: AircraftProfilePerformanceDataPoint[]
}
export type PerformanceNormalization =
  | { status: 'success'; table: NormalizedPerformanceTable }
  | { status: 'failure'; message: string }

/**
 * Normalize a copy, never the persisted source. International foot and avoirdupois pound:
 * https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b9
 * 1 ft = 0.3048 m; 1 lb = 0.45359237 kg; Celsius = (Fahrenheit - 32) / 1.8.
 */
export function normalizePerformanceTable(raw: unknown): PerformanceNormalization {
  const parsed = PerformanceProfileSchema.safeParse(raw)
  if (!parsed.success) return { status: 'failure', message: 'Invalid performance points or source-unit declarations. Supply all four sourceUnits axes using kg/lb, ft/m, °C/°F and m/ft; remove conflicting declarations.' }
  const source = parsed.data
  const units = source.sourceUnits ?? LEGACY_PERFORMANCE_UNITS
  const dataPoints = source.dataPoints.map((point) => ({
    mass: units.mass === 'lb' ? point.mass * 0.45359237 : point.mass,
    pressureAltitude: units.pressureAltitude === 'm' ? point.pressureAltitude / 0.3048 : point.pressureAltitude,
    temperature: units.temperature === '°F' ? (point.temperature - 32) / 1.8 : point.temperature,
    distance: units.distance === 'ft' ? point.distance * 0.3048 : point.distance,
  }))
  if (dataPoints.some((point) => Object.values(point).some((value) => !Number.isFinite(value)))) {
    return { status: 'failure', message: 'Performance source-unit conversion must produce finite values.' }
  }
  return { status: 'success', table: { flightPhase: source.flightPhase, dataPoints } }
}
