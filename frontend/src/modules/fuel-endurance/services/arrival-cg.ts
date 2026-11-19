import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'
import type { MathCoreResult } from '@/core/domain/mass-balance.math-types'
import {
  normalizeArmToM,
  normalizeMomentToSI,
  parseSourceUnit,
} from '@/core/logic/unit-normalization'
import { isFuelQuantityUnit, normalizeFuelQuantityToKg } from '@/core/logic/fuel-mass'
import {
  calculateLookupTripArrivalCg,
  calculateTripArrivalCg,
  calculateSequencedTripArrivalCg,
  type TripArrivalCgResult,
} from '@/core/logic/trip-arrival'
import { usableFuelForPlanning } from './usable-fuel'
import { isExplicitSourceUnit } from '@/modules/mass-balance/services/lookup-fuel-input'

export type ArrivalCgResult =
  { ok: true; arrivalMomentKgM: number; arrivalCgM: number } | { ok: false; reason: string }

export function arrivalCgForPlanning(
  aircraft: unknown,
  category: string | null,
  stations: readonly StationInput[],
  mb: MathCoreResult | null,
  tripFuelKg: number,
  sequenceName = '',
): ArrivalCgResult {
  const fuel = usableFuelForPlanning(aircraft, category, stations)
  if (!fuel.ok) return fuel
  const parsed = AircraftContextSchema.safeParse(aircraft)
  if (!parsed.success) return { ok: false, reason: 'Valid aircraft geometry is required.' }
  const profile = parsed.data
  const tanks = profile.loadPoints.filter(
    (point) =>
      point.fuelTank &&
      (point.allowableCategories === null || point.allowableCategories.some((c) => c === category)),
  )
  if (tanks.some((tank) => tank.armLookup.length > 0)) {
    if (tanks.length !== 1)
      return {
        ok: false,
        reason:
          'Variable-arm arrival CG requires exactly one category-available tank; multiple available tanks with lookup geometry are unsupported.',
      }
    return lookupArrivalCg(profile, tanks[0]!, mb, fuel.usableFuelKg, fuel.excludedUnusableKg, tripFuelKg)
  }
  if (tanks.length > 1 && !sequenceName.trim())
    return {
      ok: false,
      reason: 'Choose an explicit named burn sequence for all category-available tanks.',
    }
  if (tanks.some((tank) => tank.arm === null || !Number.isFinite(tank.arm)))
    return { ok: false, reason: 'An explicit finite fixed tank arm is required.' }
  if (
    tanks.length > 1 &&
    profile.loadPoints.some(
      (point) =>
        point.fuelTank &&
        !tanks.includes(point) &&
        point.fuelTank.burnSequences.some((entry) => entry.sequenceName === sequenceName),
    )
  )
    return { ok: false, reason: 'The selected sequence references a category-excluded tank.' }
  const blocked = sourceUnitReason(profile.sourceUnit) ?? mbReason(mb)
  if (blocked || !mb) return { ok: false, reason: blocked ?? MB_REQUIRED }
  const common = {
    takeoffMassKg: mb.takeoffCenterOfGravityPoint.mass,
    takeoffMomentKgM: mb.takeoffCenterOfGravityPoint.moment,
    usableFuelKg: fuel.usableFuelKg,
    tripFuelKg,
  }
  const geometry = fuel.tanks.map(({ index, usableFuelKg }) => {
    const tank = profile.loadPoints[index]!
    return {
      usableFuelKg,
      tankArmM: normalizeArmToM(tank.arm!, parseSourceUnit(profile.sourceUnit).armUnit),
      burnSequences: tank.fuelTank!.burnSequences,
    }
  })
  const result =
    tanks.length === 1
      ? calculateTripArrivalCg({ ...common, tankArmM: geometry[0]!.tankArmM })
      : calculateSequencedTripArrivalCg({ ...common, tanks: geometry, sequenceName })
  return result.ok
    ? result
    : {
        ok: false,
        reason:
          'Current M&B moment and fuel inventory must be finite and consistent with the trip burn; the named sequence must cover every available tank exactly once with distinct positive integer positions.',
      }
}

type Profile = ReturnType<typeof AircraftContextSchema.parse>
const MB_REQUIRED = 'Valid current Mass & Balance loading is required.'

function sourceUnitReason(sourceUnit: string): string | null {
  return isExplicitSourceUnit(sourceUnit)
    ? null
    : 'A supported explicit source unit is required for tank geometry.'
}

function mbReason(mb: MathCoreResult | null): string | null {
  return !mb?.success ||
    mb.violations.some((v) => v.type === 'INVALID_INPUT' || v.type === 'STATION_LIMIT_EXCEEDED')
    ? MB_REQUIRED
    : null
}

const LOOKUP_REASONS: Partial<
  Record<Extract<TripArrivalCgResult, { ok: false }>['reason'], string>
> = {
  INVALID_GEOMETRY:
    'Variable-arm lookup geometry needs at least two finite points with strictly ascending quantities, starting exactly at zero quantity and zero moment.',
  LOOKUP_OUT_OF_RANGE:
    'The variable-arm lookup table must cover the whole current tank load; values are not clamped or extrapolated.',
  NUMERIC_OVERFLOW: 'Variable-arm arrival CG exceeds numeric limits.',
}

// The table's moment at each load is the total tank moment. Arrival subtracts
// F(q) − F(q − b) from the current M&B takeoff moment.
function lookupArrivalCg(
  profile: Profile,
  tank: Profile['loadPoints'][number],
  mb: MathCoreResult | null,
  usableFuelKg: number,
  unusableFuelKg: number,
  tripFuelKg: number,
): ArrivalCgResult {
  const fuelTank = tank.fuelTank!
  if (tank.arm !== null)
    return {
      ok: false,
      reason:
        'Variable-arm arrival CG is unsupported when a tank declares both a fixed arm and a lookup table.',
    }
  const blocked = sourceUnitReason(profile.sourceUnit) ?? mbReason(mb)
  if (blocked || !mb) return { ok: false, reason: blocked ?? MB_REQUIRED }
  // Checked before normalization, which clamps negative quantities to zero.
  if (
    !isFuelQuantityUnit(tank.unit) ||
    !tank.armLookup.every(
      (e) => Number.isFinite(e.massOrVolume) && e.massOrVolume >= 0 && Number.isFinite(e.moment),
    )
  )
    return { ok: false, reason: LOOKUP_REASONS.INVALID_GEOMETRY! }
  const { massUnit, armUnit } = parseSourceUnit(profile.sourceUnit)
  const unit = tank.unit
  const lookup = tank.armLookup.map((e) => ({
    massOrVolume: normalizeFuelQuantityToKg(e.massOrVolume, unit, fuelTank.permissibleFuelTypes),
    moment: normalizeMomentToSI(e.moment, massUnit, armUnit),
  }))
  if (!lookup.every((e) => Number.isFinite(e.massOrVolume) && Number.isFinite(e.moment)))
    return { ok: false, reason: LOOKUP_REASONS.NUMERIC_OVERFLOW! }
  // Usable inventory and M&B share the same tank normalization, so a current
  // result for this loading has exactly this zero-fuel-to-takeoff mass step.
  if (mb.takeoffCenterOfGravityPoint.mass !== mb.zeroFuelCenterOfGravityPoint.mass + usableFuelKg)
    return { ok: false, reason: MB_REQUIRED }
  const result = calculateLookupTripArrivalCg({
    takeoffMassKg: mb.takeoffCenterOfGravityPoint.mass,
    takeoffMomentKgM: mb.takeoffCenterOfGravityPoint.moment,
    usableFuelKg,
    unusableFuelKg,
    tripFuelKg,
    lookup,
  })
  return result.ok
    ? result
    : {
        ok: false,
        reason:
          LOOKUP_REASONS[result.reason] ??
          'Current M&B moment and fuel inventory must be finite and consistent with the trip burn.',
      }
}

export function arrivalSequenceChoices(aircraft: unknown, category: string | null): string[] {
  const parsed = AircraftContextSchema.safeParse(aircraft)
  if (!parsed.success) return []
  const tanks = parsed.data.loadPoints.filter(
    (point) =>
      point.fuelTank &&
      (point.allowableCategories === null || point.allowableCategories.some((c) => c === category)),
  )
  if (tanks.length < 2) return []
  return [
    ...new Set(
      tanks.flatMap((tank) => tank.fuelTank!.burnSequences.map((entry) => entry.sequenceName)),
    ),
  ].filter((name) => name.trim().length > 0)
}
