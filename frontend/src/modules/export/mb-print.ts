import type { FuelPresentation } from '@/modules/fuel-endurance/services/use-fuel-planning'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { normalizeMassToKg, normalizeArmToM, normalizeMomentToSI, parseSourceUnit } from '@/core/logic/unit-normalization'
import { evaluateVerificationFreshness } from '@/core/logic/profile-verification'
import { formatArm, formatMassConservative } from '@/core/logic/display-rounding'
import type { AircraftContext, CategoryDefinition, MathCoreResult, MassBalanceState, Notification, StationInput } from '@/modules/mass-balance/stores/mass-balance.types'

export interface MbPrintSource {
  fuel?: FuelPresentation
  state: MassBalanceState
  ready: boolean
  aircraft: AircraftContext | null
  profile: AircraftProfile | null
  category: CategoryDefinition | null
  stations: StationInput[]
  result: MathCoreResult | null
  notifications: Notification[]
}

export function canPrintMb(source: MbPrintSource): boolean {
  return source.ready && (source.state === 'WARNING' || source.state === 'VERIFIED_SAFE') &&
    !!source.result?.success && !!source.aircraft && !!source.category &&
    source.profile?.id === source.aircraft.id &&
    !source.notifications.some(n => n.severity === 'ERROR' || n.severity === 'CRITICAL') &&
    source.stations.every(s => !s.hasError && Number.isFinite(s.weight) && s.weight >= 0 && (!s.mandatory || s.touched))
}

/** Presentation only: retain the store's results and notification text without recalculation. */
export function assembleMbPrint(source: MbPrintSource, now: Date, includeFuel = false) {
  if ((includeFuel && (!source.fuel || source.fuel.reason)) || !canPrintMb(source) || !source.profile || !source.aircraft || !source.category || !source.result) return null
  const { profile, aircraft, category, result } = source
  const { massUnit, armUnit } = parseSourceUnit(aircraft.sourceUnit)
  const freshness = evaluateVerificationFreshness(profile, now)
  const unverified = freshness.state !== 'fresh'
  const marker = unverified ? ' [UNVERIFIED]' : ''
  const mass = (value: number) => `${formatMassConservative(value, 1)} kg${marker}`
  const arm = (value: number) => `${formatArm(value, 3)} m${marker}`
  return {
    fuel: includeFuel && source.fuel ? {
      ...source.fuel,
      rows: source.fuel.rows.map(row => ({ ...row, value: `${row.value}${marker}` })),
      warnings: [...source.fuel.warnings],
    } : null,
    generated: `${now.toISOString()} (UTC)`,
    identity: `${aircraft.registration} — ${aircraft.manufacturer} ${aircraft.model}`,
    category: category.category,
    marker,
    unverified,
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
      name: s.name, quantity: `${s.weight} ${aircraft.loadPoints[s.index]?.unit ?? ''}${marker}`,
    })),
    points: [
      { label: 'Takeoff', point: result.takeoffCenterOfGravityPoint },
      { label: 'Zero fuel', point: result.zeroFuelCenterOfGravityPoint },
      { label: 'All usable fuel burned', point: result.landingCenterOfGravityPoint },
    ].map(({ label, point }) => ({ label, mass: mass(point.mass), cg: arm(point.arm) })),
    mtom: mass(normalizeMassToKg(category.maxTakeoffMass, massUnit)),
    mzfm: category.maxZeroFuelMass === null ? 'Not specified' : mass(normalizeMassToKg(category.maxZeroFuelMass, massUnit)),
    graphType: category.graphType,
    envelope: category.envelope.map(p => ({
      mass: mass(normalizeMassToKg(p.mass, massUnit)),
      horizontal: `${formatArm(category.graphType === 'arm' ? normalizeArmToM(p.armOrMoment, armUnit) : normalizeMomentToSI(p.armOrMoment, massUnit, armUnit), 3)} ${category.graphType === 'arm' ? 'm' : 'kg·m'}${marker}`,
    })),
    notifications: source.notifications.map(n => ({ id: n.id, severity: n.severity, message: n.message, context: n.context })),
  }
}
export type MbPrintSnapshot = NonNullable<ReturnType<typeof assembleMbPrint>>
