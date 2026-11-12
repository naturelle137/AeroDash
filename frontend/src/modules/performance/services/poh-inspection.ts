import { AircraftProfileSchema, type AircraftProfile } from '@/core/adapters/aircraft.schema'
import {
  computePohDistances,
  pivotDataPointsToCube,
  type PohDistances,
} from '@/core/logic/performance.poh-distance'
import { CURRENT_PROFILE_SCHEMA_VERSION } from '@/core/logic/profile-migrations'
import { evaluateVerificationFreshness } from '@/core/logic/profile-verification'

export const PHASES = [
  'TakeoffRoll', 'TakeoffDistance50ft', 'LandingRoll', 'LandingDistance50ft',
] as const
const AXES = ['mass', 'pressureAltitude', 'temperature'] as const
const UNITS = { mass: 'kg', pressureAltitude: 'ft', temperature: '°C' } as const
export type InspectionInputs = Record<typeof AXES[number], string>
export type InspectionFailure = {
  status: 'blocked'
  reason: 'profile' | 'draft' | 'tables' | 'input' | 'envelope'
  message: string
}
export type TableInspection = {
  status: 'ready'
  profile: AircraftProfile
  bounds: Record<typeof AXES[number], { min: number; max: number }>
}
export type InspectionResult = InspectionFailure | { status: 'success'; distances: PohDistances }

function blocked(reason: InspectionFailure['reason'], message: string): InspectionFailure {
  return { status: 'blocked', reason, message }
}

/** Validate all grids before exposing their common supported envelope. Drafts may be inspected. */
export function inspectTables(raw: unknown): TableInspection | InspectionFailure {
  const parsed = AircraftProfileSchema.safeParse(raw)
  if (!parsed.success) return blocked('profile', 'Invalid aircraft profile. Review and re-import a valid Fleet exchange file.')
  const profile = parsed.data
  if (profile.schemaVersion > CURRENT_PROFILE_SCHEMA_VERSION) return blocked('profile', 'Unsupported profile version. Update AeroDash before using this profile.')
  const tables = profile.performanceProfiles ?? []
  const bounds = {
    mass: { min: -Infinity, max: Infinity },
    pressureAltitude: { min: -Infinity, max: Infinity },
    temperature: { min: -Infinity, max: Infinity },
  }
  for (const phase of PHASES) {
    const matches = tables.filter((table) => table.flightPhase === phase)
    if (matches.length !== 1) return blocked('tables', `${phase}: require exactly one table (missing or duplicate phase). Update the Fleet exchange file and import it as a Draft.`)
    const points = matches[0]!.dataPoints
    if (points.some((point) => point.distance <= 0)) return blocked('tables', `${phase}: every distance must be positive. Review the source table.`)
    try {
      pivotDataPointsToCube(points)
    } catch {
      return blocked('tables', `${phase}: require a complete rectangular grid without duplicate coordinates. Review the source table.`)
    }
    for (const axis of AXES) {
      bounds[axis].min = Math.max(bounds[axis].min, Math.min(...points.map((point) => point[axis])))
      bounds[axis].max = Math.min(bounds[axis].max, Math.max(...points.map((point) => point[axis])))
    }
  }
  if (AXES.some((axis) => bounds[axis].min > bounds[axis].max)) return blocked('envelope', 'The four tables have no common supported envelope. Review the source tables.')
  return { status: 'ready', profile, bounds }
}

/** UI strings are validated here: an empty field must never become numeric zero. */
export function inspectPohDistances(raw: unknown, inputs: InspectionInputs, now: Date): InspectionResult {
  const tables = inspectTables(raw)
  if (tables.status === 'blocked') return tables
  const { profile, bounds } = tables
  if (profile.status !== 'verified') return blocked('draft', 'Draft profile: review the imported tables in Fleet and explicitly verify the profile before computing.')
  if (evaluateVerificationFreshness(profile, now).requiresReverification) return blocked('draft', 'Profile verification has expired or its source changed. Re-verify in Fleet.')
  const conditions = { mass: 0, pressureAltitude: 0, temperature: 0 }
  for (const axis of AXES) {
    const text = inputs[axis].trim()
    // Decimal/scientific notation only; Number() also accepts unsupported hexadecimal syntax.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) {
      return blocked('input', `Enter a finite ${axis} value in ${UNITS[axis]}; all three fields are required.`)
    }
    conditions[axis] = Number(text)
  }
  if (conditions.mass <= 0) return blocked('input', 'Mass must be positive (kg).')
  for (const axis of AXES) {
    if (conditions[axis] < bounds[axis].min || conditions[axis] > bounds[axis].max) {
      return blocked('envelope', `${axis} is outside the common table envelope (${bounds[axis].min} to ${bounds[axis].max} ${UNITS[axis]}). No clamping or extrapolation is available.`)
    }
  }
  const result = computePohDistances(profile, conditions)
  if (result.status === 'failure') return blocked('tables', result.message)
  if (Object.values(result.clamping).some((flags) => Object.values(flags).some(Boolean))) {
    return blocked('envelope', 'Lookup required clamping. No distances are available for this point.')
  }
  if (Object.values(result.distances).some((distance) => !Number.isFinite(distance) || distance <= 0)) {
    return blocked('tables', 'Lookup did not produce four finite positive distances. Review the source tables.')
  }
  return { status: 'success', distances: result.distances }
}
