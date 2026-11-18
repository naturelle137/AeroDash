import { resolveDistance } from '@/core/logic/performance.estimation'
import { AircraftProfileSchema, type AircraftProfile } from '@/core/adapters/aircraft.schema'
import {
  pivotDataPointsToCube,
  type PerformanceCube3D,
  type PohDistances,
} from '@/core/logic/performance.poh-distance'
import { lookupPhaseDistance, type MassTreatment, type PhaseLookupResult } from '@/core/logic/performance.phase-lookup'
import { normalizePerformanceTable } from '@/core/adapters/performance-source-units'
import { CURRENT_PROFILE_SCHEMA_VERSION } from '@/core/logic/profile-migrations'
import { evaluateVerificationFreshness } from '@/core/logic/profile-verification'

export const PHASES = [
  'TakeoffRoll', 'TakeoffDistance50ft', 'LandingRoll', 'LandingDistance50ft',
] as const
export type Phase = typeof PHASES[number]
export const PHASE_INFO = {
  TakeoffRoll: { key: 'takeoffRoll', label: 'TOR — Takeoff roll' },
  TakeoffDistance50ft: { key: 'takeoffDistance50ft', label: 'TOD — Takeoff distance to 50 ft' },
  LandingRoll: { key: 'landingRoll', label: 'LR — Landing roll' },
  LandingDistance50ft: { key: 'landingDistance50ft', label: 'LD — Landing distance from 50 ft' },
} as const satisfies Record<Phase, { key: keyof PohDistances; label: string }>
export const GROUP_PHASES = {
  takeoff: ['TakeoffRoll', 'TakeoffDistance50ft'],
  landing: ['LandingRoll', 'LandingDistance50ft'],
} as const satisfies Record<string, readonly Phase[]>
export type PerformanceGroupId = keyof typeof GROUP_PHASES

const AXES = ['mass', 'pressureAltitude', 'temperature'] as const
type Range = { min: number; max: number }
export type InspectionFailure = {
  status: 'blocked'
  reason: 'profile' | 'draft' | 'tables' | 'input'
  message: string
}
export type TableInspection = {
  status: 'ready'
  profile: AircraftProfile
  /** Normalized kg/ft/°C/m grids. */
  cubes: Record<Phase, PerformanceCube3D>
  bounds: Record<Phase, Record<typeof AXES[number], Range>>
  provenance: Record<Phase, 'poh' | 'estimated'>
}

/** A mass offered to one phase group; unavailable masses carry the exact reason. */
export type MassSource =
  | { status: 'ready'; massKg: number; origin: string }
  | { status: 'unavailable'; reason: string }
export type AssessmentInputs = {
  takeoff: MassSource
  landing: MassSource
  /** Raw text (direct entry) or an already validated derived number (ft). */
  pressureAltitude: string | number
  temperature: string
}
export type PhaseDistance = {
  phase: Phase
  label: string
  /** Metres; unrounded. */
  distance: number
  provenance: 'poh' | 'estimated'
  massTreatment: MassTreatment
  lookupMass: number
  massRange: Range
}
export type GroupAssessment =
  | { status: 'success'; massKg: number; origin: string; distances: PhaseDistance[] }
  | { status: 'blocked'; massKg: number | null; reason: 'mass' | 'envelope' | 'tables'; message: string }
export type PerformanceAssessment =
  | InspectionFailure
  | {
    status: 'assessed'
    conditions: { pressureAltitudeFt: number; temperatureC: number }
    takeoff: GroupAssessment
    landing: GroupAssessment
  }

function blocked(reason: InspectionFailure['reason'], message: string): InspectionFailure {
  return { status: 'blocked', reason, message }
}

function range(axis: readonly number[]): Range {
  return { min: axis[0]!, max: axis[axis.length - 1]! }
}

/** Validate all grids before exposing their per-phase envelopes. Drafts may be inspected. */
export function inspectTables(raw: unknown): TableInspection | InspectionFailure {
  const parsed = AircraftProfileSchema.safeParse(raw)
  if (!parsed.success) return blocked('profile', 'Invalid aircraft profile or performance source-unit declarations. Review sourceUnits (all four axes: kg/lb, ft/m, °C/°F, m/ft) and re-import a valid Fleet exchange file.')
  const profile = parsed.data
  if (profile.schemaVersion > CURRENT_PROFILE_SCHEMA_VERSION) return blocked('profile', 'Unsupported profile version. Update AeroDash before using this profile.')
  const tables = profile.performanceProfiles ?? []
  const cubes = {} as Record<Phase, PerformanceCube3D>
  const bounds = {} as TableInspection['bounds']
  for (const phase of PHASES) {
    const matches = tables.filter((table) => table.flightPhase === phase)
    if (matches.length === 0) continue
    if (matches.length !== 1) return blocked('tables', `${phase}: require exactly one table (missing or duplicate phase). Update the Fleet exchange file and import it as a Draft.`)
    const normalized = normalizePerformanceTable(matches[0])
    if (normalized.status === 'failure') return blocked('tables', normalized.message)
    const points = normalized.table.dataPoints
    if (points.some((point) => point.distance <= 0)) return blocked('tables', `${phase}: every distance must be positive. Review the source table.`)
    try {
      cubes[phase] = pivotDataPointsToCube(points)
    } catch {
      return blocked('tables', `${phase}: require a complete rectangular grid without duplicate coordinates. Review the source table.`)
    }
    const cube = cubes[phase]
    bounds[phase] = { mass: range(cube.massAxis), pressureAltitude: range(cube.altitudeAxis), temperature: range(cube.temperatureAxis) }
  }
  const provenance = {} as TableInspection['provenance']
  for (const group of ['takeoff', 'landing'] as const) {
    const [roll, distance] = GROUP_PHASES[group]
    if (!cubes[roll] && !cubes[distance]) return blocked('tables', `${roll}: require exactly one table in each phase pair. Update the Fleet exchange file and import it as a Draft.`)
    for (const phase of [roll, distance]) {
      provenance[phase] = cubes[phase] ? 'poh' : 'estimated'
      if (!cubes[phase]) {
        const source = cubes[phase === roll ? distance : roll]
        cubes[phase] = source
        bounds[phase] = bounds[phase === roll ? distance : roll]
      }
    }
  }
  return { status: 'ready', profile, cubes, bounds, provenance }
}

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

/** UI strings are validated here: an empty field must never become numeric zero. */
export function parseLookupNumber(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const text = raw.trim()
  // Decimal/scientific notation only; Number() also accepts unsupported hexadecimal syntax.
  if (!DECIMAL.test(text) || !Number.isFinite(Number(text))) return null
  return Number(text)
}

/** A pilot-entered mass for the standalone lookup, applied to the named group. */
export function massSourceFromText(text: string, origin: string): MassSource {
  const value = parseLookupNumber(text)
  if (value === null) return { status: 'unavailable', reason: 'Enter a finite mass in kg.' }
  if (value <= 0) return { status: 'unavailable', reason: 'Mass must be positive (kg).' }
  return { status: 'ready', massKg: value, origin }
}

const fmt = (value: number) => Number(value.toFixed(3)).toString()

function lookupMessage(label: string, massKg: number, origin: string, result: Extract<PhaseLookupResult, { status: 'blocked' }>, conditions: { pressureAltitudeFt: number; temperatureC: number }): { reason: 'envelope' | 'tables' | 'mass'; message: string } {
  const r = result.range
  switch (result.reason) {
    case 'pressure-altitude-outside':
      return { reason: 'envelope', message: `${label}: pressure altitude ${fmt(conditions.pressureAltitudeFt)} ft is outside the table (${r!.min} to ${r!.max} ft). No clamping or extrapolation is available.` }
    case 'temperature-outside':
      return { reason: 'envelope', message: `${label}: temperature ${fmt(conditions.temperatureC)} °C is outside the table (${r!.min} to ${r!.max} °C). No clamping or extrapolation is available.` }
    case 'mass-above-table':
      return { reason: 'envelope', message: `${label}: ${origin} ${fmt(massKg)} kg is above the table maximum ${fmt(r!.max)} kg. Upper-bound extrapolation is unsupported because no accepted source limit exists.` }
    case 'mass-below-table-unsupported':
      return { reason: 'tables', message: `${label}: ${origin} ${fmt(massKg)} kg is below the table minimum ${fmt(r!.min)} kg, and the table decreases with mass somewhere, so no documented best case can be capped. Review the source table.` }
    case 'invalid-input':
      return { reason: 'mass', message: `${label}: ${origin} must be a finite positive mass in kg.` }
    case 'invalid-distance':
      return { reason: 'tables', message: `${label}: lookup did not produce a finite positive distance. Review the source table.` }
  }
}

function assessGroup(tables: TableInspection, group: PerformanceGroupId, mass: MassSource, conditions: { pressureAltitudeFt: number; temperatureC: number }): GroupAssessment {
  if (mass.status === 'unavailable') return { status: 'blocked', massKg: null, reason: 'mass', message: mass.reason }
  const distances: PhaseDistance[] = []
  for (const phase of GROUP_PHASES[group]) {
    const { label } = PHASE_INFO[phase]
    const result = lookupPhaseDistance(tables.cubes[phase], { mass: mass.massKg, pressureAltitude: conditions.pressureAltitudeFt, temperature: conditions.temperatureC })
    if (result.status === 'blocked') return { status: 'blocked', massKg: mass.massKg, ...lookupMessage(label, mass.massKg, mass.origin, result, conditions) }
    const { distance, provenance } = resolveDistance(tables.provenance[phase] === 'poh' ? result.distance : null, result.distance, group, phase === GROUP_PHASES[group][0] ? 'roll' : 'distance')
    if (!Number.isFinite(distance) || distance <= 0) return { status: 'blocked', massKg: mass.massKg, reason: 'tables', message: `${label}: estimated distance is invalid.` }
    distances.push({ phase, label, distance, provenance, massTreatment: result.massTreatment, lookupMass: result.lookupMass, massRange: result.massRange })
  }
  return { status: 'success', massKg: mass.massKg, origin: mass.origin, distances }
}

/**
 * Base performance distances for takeoff and landing, each with its own mass. One group's
 * missing mass or envelope failure never removes the other group's valid result.
 */
export function assessPerformance(raw: unknown, inputs: AssessmentInputs, now: Date): PerformanceAssessment {
  const tables = inspectTables(raw)
  if (tables.status === 'blocked') return tables
  const { profile } = tables
  if (profile.status !== 'verified') return blocked('draft', 'Draft profile: review the imported tables in Fleet and explicitly verify the profile before computing.')
  if (evaluateVerificationFreshness(profile, now).requiresReverification) return blocked('draft', 'Profile verification has expired or its source changed. Re-verify in Fleet.')
  const pressureAltitudeFt = parseLookupNumber(inputs.pressureAltitude)
  if (pressureAltitudeFt === null) return blocked('input', 'Enter a finite pressure altitude in ft.')
  const temperatureC = parseLookupNumber(inputs.temperature)
  if (temperatureC === null) return blocked('input', 'Enter a finite outside air temperature in °C.')
  const conditions = { pressureAltitudeFt, temperatureC }
  return {
    status: 'assessed',
    conditions,
    takeoff: assessGroup(tables, 'takeoff', inputs.takeoff, conditions),
    landing: assessGroup(tables, 'landing', inputs.landing, conditions),
  }
}
