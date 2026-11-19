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
  const hasLookup = tanks.some((tank) => tank.armLookup.length > 0)
  if (hasLookup && tanks.length === 1)
    return lookupArrivalCg(profile, tanks[0]!, mb, fuel.usableFuelKg, fuel.excludedUnusableKg, tripFuelKg)
  if (tanks.length > 1 && !sequenceName.trim())
    return {
      ok: false,
      reason: 'Choose an explicit named burn sequence for all category-available tanks.',
    }
  const lookupTanks = tanks.filter((tank) => tank.armLookup.length > 0)
  if (lookupTanks.some((tank) => tank.arm !== null)) return { ok: false, reason: BOTH_GEOMETRIES }
  if (
    tanks.some(
      (tank) => tank.armLookup.length === 0 && (tank.arm === null || !Number.isFinite(tank.arm)),
    )
  )
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
  const geometry: SequencedTank[] = []
  for (const { index, usableFuelKg, unusableFuelKg } of fuel.tanks) {
    const tank = profile.loadPoints[index]!
    const burnSequences = tank.fuelTank!.burnSequences
    if (tank.armLookup.length === 0) {
      const tankArmM = normalizeArmToM(tank.arm!, parseSourceUnit(profile.sourceUnit).armUnit)
      geometry.push({ usableFuelKg, unusableFuelKg, tankArmM, burnSequences })
      continue
    }
    const lookup = normalizedLookup(profile, tank)
    if (typeof lookup === 'string') return { ok: false, reason: lookup }
    geometry.push({ usableFuelKg, unusableFuelKg, lookup, burnSequences })
  }
  // Same step as the single-tank path: confirms M&B was computed for this inventory.
  if (
    lookupTanks.length > 0 &&
    Math.abs(
      mb.takeoffCenterOfGravityPoint.mass -
        (mb.zeroFuelCenterOfGravityPoint.mass + fuel.usableFuelKg),
    ) > MASS_TOLERANCE_KG
  )
    return { ok: false, reason: MB_REQUIRED }
  const result =
    tanks.length === 1
      ? calculateTripArrivalCg({ ...common, tankArmM: geometry[0]!.tankArmM })
      : calculateSequencedTripArrivalCg({ ...common, tanks: geometry, sequenceName })
  if (!result.ok && result.reason in LOOKUP_REASONS)
    return { ok: false, reason: LOOKUP_REASONS[result.reason]! }
  return result.ok
    ? result
    : {
        ok: false,
        reason:
          'Current M&B moment and fuel inventory must be finite and consistent with the trip burn; the named sequence must cover every available tank exactly once with distinct positive integer positions.',
      }
}

type Profile = ReturnType<typeof AircraftContextSchema.parse>
type SequencedTank = {
  usableFuelKg: number
  unusableFuelKg: number
  tankArmM?: number
  lookup?: { massOrVolume: number; moment: number }[]
  burnSequences: { sequenceName: string; ordinalPosition: number }[]
}
const BOTH_GEOMETRIES =
  'Variable-arm arrival CG is unsupported when a tank declares both a fixed arm and a lookup table.'
// Absorbs float summation-order drift only; a real stale-state gap is far larger.
const MASS_TOLERANCE_KG = 1e-6
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
// F(u+q) − F(u+q−b) from the current M&B takeoff moment. Unusable fuel stays aboard,
// so the table needs an exact (0, 0) origin knot.
function normalizedLookup(
  profile: Profile,
  tank: Profile['loadPoints'][number],
): { massOrVolume: number; moment: number }[] | string {
  // Checked before normalization, which clamps negative quantities to zero.
  if (
    !isFuelQuantityUnit(tank.unit) ||
    !tank.armLookup.every(
      (e) => Number.isFinite(e.massOrVolume) && e.massOrVolume >= 0 && Number.isFinite(e.moment),
    )
  )
    return LOOKUP_REASONS.INVALID_GEOMETRY!
  const { massUnit, armUnit } = parseSourceUnit(profile.sourceUnit)
  const unit = tank.unit
  const lookup = tank.armLookup.map((e) => ({
    massOrVolume: normalizeFuelQuantityToKg(
      e.massOrVolume,
      unit,
      tank.fuelTank!.permissibleFuelTypes,
    ),
    moment: normalizeMomentToSI(e.moment, massUnit, armUnit),
  }))
  return lookup.every((e) => Number.isFinite(e.massOrVolume) && Number.isFinite(e.moment))
    ? lookup
    : LOOKUP_REASONS.NUMERIC_OVERFLOW!
}

function lookupArrivalCg(
  profile: Profile,
  tank: Profile['loadPoints'][number],
  mb: MathCoreResult | null,
  usableFuelKg: number,
  unusableFuelKg: number,
  tripFuelKg: number,
): ArrivalCgResult {
  if (tank.arm !== null) return { ok: false, reason: BOTH_GEOMETRIES }
  const blocked = sourceUnitReason(profile.sourceUnit) ?? mbReason(mb)
  if (blocked || !mb) return { ok: false, reason: blocked ?? MB_REQUIRED }
  const lookup = normalizedLookup(profile, tank)
  if (typeof lookup === 'string') return { ok: false, reason: lookup }
  // Usable inventory and M&B share the same tank normalization, so a current
  // result for this loading has exactly this zero-fuel-to-takeoff mass step.
  if (
    Math.abs(
      mb.takeoffCenterOfGravityPoint.mass - (mb.zeroFuelCenterOfGravityPoint.mass + usableFuelKg),
    ) > MASS_TOLERANCE_KG
  )
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
