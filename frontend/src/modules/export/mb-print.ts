import type { PerformancePresentation } from '@/modules/performance/services/performance-presentation'
import type { ElectricPresentation } from '@/modules/fuel-endurance/services/use-electric-planning'
import type { FuelPresentation } from '@/modules/fuel-endurance/services/use-fuel-planning'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { normalizeMassToKg, normalizeArmToM, normalizeMomentToSI, parseSourceUnit } from '@/core/logic/unit-normalization'
import { requiresOccupancy } from '@/core/logic/station-kind'
import { evaluateVerificationFreshness } from '@/core/logic/profile-verification'
import { formatArm, formatMassConservative, formatMassLimitConservative } from '@/core/logic/display-rounding'
import type { AircraftContext, CategoryDefinition, EnvelopePoint, MathCoreResult, MassBalanceState, Notification, StationInput } from '@/modules/mass-balance/stores/mass-balance.types'

export interface MbPrintSource {
  performance?: PerformancePresentation
  energy?: ElectricPresentation
  fuel?: FuelPresentation
  state: MassBalanceState
  ready: boolean
  aircraft: AircraftContext | null
  profile: AircraftProfile | null
  category: CategoryDefinition | null
  stations: StationInput[]
  chartEnvelope: EnvelopePoint[]
  result: MathCoreResult | null
  notifications: Notification[]
}

const computedExceedances: Readonly<Record<string, string>> = {
  'CRIT-MB-001': 'CG_OUT_OF_ENVELOPE',
  'CRIT-MB-002': 'MTOM_EXCEEDED',
  'CRIT-MB-003': 'CG_MIGRATION_EXCEEDED',
  'CRIT-MB-004': 'MZFM_EXCEEDED',
}

export function canPrintMb(source: MbPrintSource): boolean {
  const result = source.result
  const computedCritical = (note: Notification) => note.severity === 'CRITICAL' &&
    result?.violations.some(v => v.type === computedExceedances[note.id])
  // Only known, successfully computed exceedances may cross the critical-state gate.
  // System/adapter errors and unknown future criticals remain blocked.
  return source.ready && (source.state === 'WARNING' || source.state === 'VERIFIED_SAFE' ||
    (source.state === 'ERROR_CRITICAL' && source.notifications.some(computedCritical))) &&
    !!result?.success && !!source.aircraft && !!source.category &&
    source.profile?.id === source.aircraft.id &&
    [result.takeoffCenterOfGravityPoint, result.zeroFuelCenterOfGravityPoint,
      result.landingCenterOfGravityPoint, ...result.migrationPath].every(p =>
      Number.isFinite(p.mass) && p.mass > 0 && Number.isFinite(p.arm) && Number.isFinite(p.moment)) &&
    !result.violations.some(v => v.type === 'INVALID_INPUT' && v.code !== 'OUT_OF_RANGE') &&
    !source.notifications.some(n => n.severity === 'ERROR' || (n.severity === 'CRITICAL' && !computedCritical(n))) &&
    source.stations.every(s => !s.hasError && Number.isFinite(s.weight) && s.weight >= 0 && (!s.mandatory || s.touched))
}

/** CRIT-UI-001 payload; fields name the sections whose values carry the inline [UNVERIFIED] marker. */
export function unverifiedGate(snapshot: MbPrintSnapshot) {
  if (!snapshot.unverified) return null
  const parameters = ['aircraft.profile.status', 'massBalance.loading', 'massBalance.results', 'massBalance.envelope',
    ...(snapshot.fuel?.rows.length ? ['fuel.plan'] : []),
    ...(snapshot.energy?.rows.length ? ['energy.plan'] : []),
    ...(snapshot.performance?.groups.length ? ['performance.results'] : [])]
  const notification: Notification = { id: 'CRIT-UI-001', severity: 'CRITICAL', message: 'Unverified Data Present',
    context: 'UI.Validation', persistent: true, dismissible: false,
    action: { label: 'Review', event: 'ui.review_unverified', payload: { parameters, canForceSave: true } } }
  return { notification, parameters, status: snapshot.status }
}

/** Associate exact source notifications with the values they qualify. */
function valueWarnings(source: MbPrintSource, contexts: readonly string[]): Notification[] {
  return source.notifications.filter(n => n.severity !== 'INFO' &&
    (contexts.includes(n.context ?? '') || n.context === 'Aircraft.Status' ||
      n.context === 'MassBalance.Validation'))
}

/** Presentation only: retain the store's results and notification text without recalculation. */
export function assembleMbPrint(source: MbPrintSource, now: Date) {
  if (!canPrintMb(source) || !source.profile || !source.aircraft || !source.category || !source.result) return null
  const { profile, aircraft, category, result } = source
  const { massUnit, armUnit } = parseSourceUnit(aircraft.sourceUnit)
  const freshness = evaluateVerificationFreshness(profile, now)
  const unverified = freshness.state !== 'fresh'
  const marker = unverified ? ' [UNVERIFIED]' : ''
  const mass = (value: number) => `${formatMassConservative(value, 1)} kg${marker}`
  const massLimit = (value: number) => `${formatMassLimitConservative(value, 1)} kg${marker}`
  const arm = (value: number) => `${formatArm(value, 3)} m${marker}`
  return {
    performance: source.performance ? JSON.parse(JSON.stringify(source.performance)) as PerformancePresentation : null,
    chart: {
      result: JSON.parse(JSON.stringify(result)) as MathCoreResult,
      envelope: source.chartEnvelope.map(point => ({ ...point })),
      severity: source.notifications.some(n => n.severity === 'CRITICAL') ? 'critical' as const
        : source.state === 'WARNING' ? 'warning' as const : 'success' as const,
    },
    energy: source.energy ? { ...source.energy, rows: source.energy.rows.map(row => ({ ...row, value: `${row.value} [UNVERIFIED]` })) } : null,
    fuel: source.fuel ? {
      ...source.fuel,
      rows: source.fuel.rows.filter(row => !source.fuel?.reason || ['Usable fuel', 'Excluded unusable fuel'].includes(row.label)).map(row => ({ ...row, value: `${row.value}${marker}` })),
      warnings: [...source.fuel.warnings],
    } : null,
    fuelReason: source.fuel?.reason ?? (!source.fuel ? 'Current fuel plan is unavailable.' : null),
    generated: `${now.toISOString()} (UTC)`,
    identity: `${aircraft.registration} — ${aircraft.manufacturer} ${aircraft.model}`,
    category: category.category,
    marker,
    unverified,
    lowSafetyMargin: !!source.performance?.corrected.some(item => item.status === 'applied' && item.safetyFactorWarning),
    status: `${profile.status}; ${freshness.state}${marker}`,
    provenance: freshness.provenance ? {
      revision: freshness.provenance.pohRevision,
      verifiedOn: freshness.provenance.verifiedOn,
      sourceDate: freshness.provenance.sourceWeighingDate,
      expiresOn: freshness.expiresOn,
    } : null,
    weighingReports: profile.weighingReports.map(r => ({
      date: r.weighingDate, validFrom: r.validFrom,
      mass: mass(normalizeMassToKg(r.bem, massUnit)), cg: arm(normalizeArmToM(r.emptyCg, armUnit)),
    })),
    sourceUnit: profile.sourceUnit,
    datum: profile.referenceDatumDescription,
    loading: source.stations.map(s => ({
      warnings: valueWarnings(source, []).concat(source.notifications.filter(n =>
        (n.id === 'WARN-MB-005' && n.message === `Station ${s.index} limit exceeded`) ||
        (n.id === 'WARN-UQ-001' && s.weight === 0 && !!aircraft.loadPoints[s.index] && requiresOccupancy(aircraft.loadPoints[s.index]!)))),
      name: s.name, quantity: `${s.weight} ${aircraft.loadPoints[s.index]?.unit ?? ''}${marker}`,
    })),
    cgTrajectoryWarnings: source.notifications.filter(n => n.severity !== 'INFO' && n.context === 'MassBalance.CG' &&
      !(n.id === 'CRIT-MB-001' && result.violations.some(v => v.type === 'CG_OUT_OF_ENVELOPE'))),
    points: [
      { label: 'Takeoff', point: result.takeoffCenterOfGravityPoint },
      { label: 'Zero fuel', point: result.zeroFuelCenterOfGravityPoint },
      { label: 'All usable fuel burned', point: result.landingCenterOfGravityPoint },
    ].map(({ label, point }) => ({ label, mass: mass(point.mass), cg: arm(point.arm),
      massWarnings: valueWarnings(source, label === 'Takeoff' ? ['MassBalance.TotalMass', 'FuelEndurance.Density'] : label === 'Zero fuel' ? ['MassBalance.ZFM'] : ['FuelEndurance.Density']),
      cgWarnings: valueWarnings(source, ['FuelEndurance.Density']).concat(label === 'Takeoff' && result.violations.some(v => v.type === 'CG_OUT_OF_ENVELOPE')
        ? source.notifications.filter(n => n.context === 'MassBalance.CG' && n.id === 'CRIT-MB-001' && n.severity !== 'INFO') : []),
      limit: label === 'Takeoff' ? `MTOM: ${massLimit(normalizeMassToKg(category.maxTakeoffMass, massUnit))}` : label === 'Zero fuel' && category.maxZeroFuelMass !== null ? `MZFM: ${massLimit(normalizeMassToKg(category.maxZeroFuelMass, massUnit))}` : 'Not specified' })),
    mtom: massLimit(normalizeMassToKg(category.maxTakeoffMass, massUnit)),
    mzfm: category.maxZeroFuelMass === null ? 'Not specified' : massLimit(normalizeMassToKg(category.maxZeroFuelMass, massUnit)),
    graphType: category.graphType,
    envelope: category.envelope.map(p => ({
      mass: mass(normalizeMassToKg(p.mass, massUnit)),
      horizontal: `${formatArm(category.graphType === 'arm' ? normalizeArmToM(p.armOrMoment, armUnit) : normalizeMomentToSI(p.armOrMoment, massUnit, armUnit), 3)} ${category.graphType === 'arm' ? 'm' : 'kg·m'}${marker}`,
    })),
    notifications: source.notifications.map(n => ({ id: n.id, severity: n.severity, message: n.message, context: n.context })),
  }
}
export type MbPrintSnapshot = NonNullable<ReturnType<typeof assembleMbPrint>>
