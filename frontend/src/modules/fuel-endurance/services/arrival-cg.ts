import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'
import type { MathCoreResult } from '@/core/domain/mass-balance.math-types'
import { normalizeArmToM, parseSourceUnit } from '@/core/logic/unit-normalization'
import { calculateTripArrivalCg } from '@/core/logic/trip-arrival'
import { usableFuelForPlanning } from './usable-fuel'

export type ArrivalCgResult =
  { ok: true; arrivalMomentKgM: number; arrivalCgM: number } | { ok: false; reason: string }

export function arrivalCgForPlanning(
  aircraft: unknown,
  category: string | null,
  stations: readonly StationInput[],
  mb: MathCoreResult | null,
  tripFuelKg: number,
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
  // Count every category-available tank, including empty tanks: no implicit selection or schedule.
  if (tanks.length !== 1)
    return {
      ok: false,
      reason: 'Exactly one category-available fuel tank is supported, including empty tanks.',
    }
  const tank = tanks[0]!
  if (tank.armLookup.length > 0)
    return {
      ok: false,
      reason: 'Variable-arm tanks are unsupported; a fixed arm without a lookup table is required.',
    }
  if (tank.arm === null || !Number.isFinite(tank.arm))
    return { ok: false, reason: 'An explicit finite fixed tank arm is required.' }
  // The shared parser tolerates legacy unknown units; arrival CG must not guess geometry.
  if (!/^(kg|lb)(-(m|in|ft))?$/.test(profile.sourceUnit.trim().toLowerCase()))
    return { ok: false, reason: 'A supported explicit source unit is required for tank geometry.' }
  if (
    !mb?.success ||
    mb.violations.some((v) => v.type === 'INVALID_INPUT' || v.type === 'STATION_LIMIT_EXCEEDED')
  )
    return { ok: false, reason: 'Valid current Mass & Balance loading is required.' }
  const result = calculateTripArrivalCg({
    takeoffMassKg: mb.takeoffCenterOfGravityPoint.mass,
    takeoffMomentKgM: mb.takeoffCenterOfGravityPoint.moment,
    usableFuelKg: fuel.usableFuelKg,
    tripFuelKg,
    tankArmM: normalizeArmToM(tank.arm, parseSourceUnit(profile.sourceUnit).armUnit),
  })
  return result.ok
    ? result
    : {
        ok: false,
        reason:
          'Current M&B moment and fuel inventory must be finite and consistent with the trip burn.',
      }
}
