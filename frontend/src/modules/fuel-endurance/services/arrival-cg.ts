import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'
import type { MathCoreResult } from '@/core/domain/mass-balance.math-types'
import { normalizeArmToM, parseSourceUnit } from '@/core/logic/unit-normalization'
import { calculateTripArrivalCg, calculateSequencedTripArrivalCg } from '@/core/logic/trip-arrival'
import { usableFuelForPlanning } from './usable-fuel'

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
  if (tanks.length > 1 && !sequenceName.trim())
    return {
      ok: false,
      reason: 'Choose an explicit named burn sequence for all category-available tanks.',
    }
  if (tanks.some((tank) => tank.armLookup.length > 0))
    return {
      ok: false,
      reason: 'Variable-arm tanks are unsupported; a fixed arm without a lookup table is required.',
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
  // The shared parser tolerates legacy unknown units; arrival CG must not guess geometry.
  if (!/^(kg|lb)(-(m|in|ft))?$/.test(profile.sourceUnit.trim().toLowerCase()))
    return { ok: false, reason: 'A supported explicit source unit is required for tank geometry.' }
  if (
    !mb?.success ||
    mb.violations.some((v) => v.type === 'INVALID_INPUT' || v.type === 'STATION_LIMIT_EXCEEDED')
  )
    return { ok: false, reason: 'Valid current Mass & Balance loading is required.' }
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
