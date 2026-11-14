import { z } from 'zod'
import { MAX_ARM_M, MAX_MASS_KG, MAX_MOMENT_KGM } from '../adapters/mass-balance.adapter'
import { interpolateMomentStrict } from './mb.arm-lookup'

const ArrivalInputSchema = z.object({
  takeoffMassKg: z.number().finite().positive(),
  usableFuelKg: z.number().finite().nonnegative(),
  tripFuelKg: z.number().finite().nonnegative(),
})

export type TripArrivalResult =
  | {
      ok: true
      takeoffMassKg: number
      tripFuelKg: number
      arrivalMassKg: number
      remainingFuelKg: number
    }
  | { ok: false; reason: 'INVALID_INPUT' | 'INCONSISTENT_MASS' | 'TRIP_EXCEEDS_USABLE_FUEL' }

// Takeoff mass already includes usable fuel; reserve is retained on arrival.
export function calculateTripArrival(input: unknown): TripArrivalResult {
  const parsed = ArrivalInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'INVALID_INPUT' }
  const { takeoffMassKg, usableFuelKg, tripFuelKg } = parsed.data
  if (usableFuelKg >= takeoffMassKg) return { ok: false, reason: 'INCONSISTENT_MASS' }
  if (tripFuelKg > usableFuelKg) return { ok: false, reason: 'TRIP_EXCEEDS_USABLE_FUEL' }
  return {
    ok: true,
    takeoffMassKg,
    tripFuelKg,
    arrivalMassKg: takeoffMassKg - tripFuelKg,
    remainingFuelKg: usableFuelKg - tripFuelKg,
  }
}

const ArrivalCgInputSchema = ArrivalInputSchema.extend({
  takeoffMomentKgM: z.number().finite(),
  tankArmM: z.number().finite(),
})

export type TripArrivalCgResult =
  | { ok: true; arrivalMomentKgM: number; arrivalCgM: number }
  | {
      ok: false
      reason:
        | 'INVALID_INPUT'
        | 'INCONSISTENT_MASS'
        | 'TRIP_EXCEEDS_USABLE_FUEL'
        | 'NUMERIC_OVERFLOW'
        | 'INVALID_GEOMETRY'
        | 'LOOKUP_OUT_OF_RANGE'
    }

// All inputs use SI. Unusable fuel stays in BEM; only the planned burn leaves the tank.
export function calculateTripArrivalCg(input: unknown): TripArrivalCgResult {
  const parsed = ArrivalCgInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'INVALID_INPUT' }
  const mass = calculateTripArrival(parsed.data)
  if (!mass.ok) return mass
  const { takeoffMomentKgM, tripFuelKg, tankArmM } = parsed.data
  const arrivalMomentKgM = takeoffMomentKgM - tripFuelKg * tankArmM
  const arrivalCgM = arrivalMomentKgM / mass.arrivalMassKg
  if (![arrivalMomentKgM, arrivalCgM].every(Number.isFinite))
    return { ok: false, reason: 'NUMERIC_OVERFLOW' }
  return { ok: true, arrivalMomentKgM, arrivalCgM }
}

const SequencedArrivalInputSchema = ArrivalInputSchema.omit({ usableFuelKg: true }).extend({
  takeoffMomentKgM: z.number().finite(),
  sequenceName: z.string().min(1),
  tanks: z
    .array(
      z.object({
        usableFuelKg: z.number().finite().nonnegative(),
        tankArmM: z.number().finite(),
        burnSequences: z.array(
          z.object({
            sequenceName: z.string(),
            ordinalPosition: z.number().finite(),
          }),
        ),
      }),
    )
    .min(2),
})

// The legacy contract attaches named ordinal entries to tanks, rather than referencing tank IDs.
export function calculateSequencedTripArrivalCg(input: unknown): TripArrivalCgResult {
  const parsed = SequencedArrivalInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'INVALID_INPUT' }
  const { tanks, sequenceName, takeoffMomentKgM, tripFuelKg } = parsed.data
  const ordered = []
  const positions = new Set<number>()
  for (const tank of tanks) {
    const entries = tank.burnSequences.filter((entry) => entry.sequenceName === sequenceName)
    const position = entries[0]?.ordinalPosition
    if (
      entries.length !== 1 ||
      position === undefined ||
      !Number.isInteger(position) ||
      position < 1 ||
      positions.has(position)
    )
      return { ok: false, reason: 'INVALID_INPUT' }
    positions.add(position)
    ordered.push({ ...tank, position })
  }
  const usableFuelKg = tanks.reduce((sum, tank) => sum + tank.usableFuelKg, 0)
  const mass = calculateTripArrival({ ...parsed.data, usableFuelKg })
  if (!mass.ok) return mass
  let remainingBurnKg = tripFuelKg
  let burnedMomentKgM = 0
  for (const tank of ordered.sort((a, b) => a.position - b.position)) {
    const burnedKg = Math.min(remainingBurnKg, tank.usableFuelKg)
    burnedMomentKgM += burnedKg * tank.tankArmM
    remainingBurnKg -= burnedKg
  }
  const arrivalMomentKgM = takeoffMomentKgM - burnedMomentKgM
  const arrivalCgM = arrivalMomentKgM / mass.arrivalMassKg
  if (![arrivalMomentKgM, arrivalCgM].every(Number.isFinite))
    return { ok: false, reason: 'NUMERIC_OVERFLOW' }
  return { ok: true, arrivalMomentKgM, arrivalCgM }
}

const LookupArrivalInputSchema = ArrivalInputSchema.extend({
  takeoffMassKg: z.number().finite().positive().max(MAX_MASS_KG),
  takeoffMomentKgM: z.number().finite().min(-MAX_MOMENT_KGM).max(MAX_MOMENT_KGM),
  lookup: z.array(z.object({ massOrVolume: z.number(), moment: z.number() })),
})

/**
 * Single variable-geometry tank with zero unusable fuel. The table holds the total
 * tank moment at each tank mass (kg, kg·m), so F(0) = 0 and the burned contribution is
 * F(q) − F(q − b). Arms are never interpolated and the departure arm is never frozen.
 * Nonzero unusable fuel needs a different departure convention and must not use this.
 */
export function calculateLookupTripArrivalCg(input: unknown): TripArrivalCgResult {
  const parsed = LookupArrivalInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'INVALID_INPUT' }
  const { lookup, takeoffMomentKgM, usableFuelKg, tripFuelKg } = parsed.data
  const validGeometry =
    lookup.length >= 2 &&
    lookup[0]!.massOrVolume === 0 &&
    lookup[0]!.moment === 0 &&
    lookup.every(
      (entry, i) =>
        Number.isFinite(entry.massOrVolume) &&
        entry.massOrVolume <= MAX_MASS_KG &&
        Number.isFinite(entry.moment) &&
        Math.abs(entry.moment) <= MAX_MOMENT_KGM &&
        (i === 0 || entry.massOrVolume > lookup[i - 1]!.massOrVolume),
    )
  if (!validGeometry) return { ok: false, reason: 'INVALID_GEOMETRY' }
  const mass = calculateTripArrival(parsed.data)
  if (!mass.ok) return mass
  const departureTankMomentKgM = interpolateMomentStrict(usableFuelKg, lookup)
  const remainingTankMomentKgM = interpolateMomentStrict(usableFuelKg - tripFuelKg, lookup)
  if (departureTankMomentKgM === null || remainingTankMomentKgM === null)
    return { ok: false, reason: 'LOOKUP_OUT_OF_RANGE' }
  const burnedMomentKgM = departureTankMomentKgM - remainingTankMomentKgM
  const arrivalMomentKgM = takeoffMomentKgM - burnedMomentKgM
  const arrivalCgM = arrivalMomentKgM / mass.arrivalMassKg
  if (
    ![departureTankMomentKgM, remainingTankMomentKgM, burnedMomentKgM].every(Number.isFinite) ||
    !Number.isFinite(arrivalMomentKgM) ||
    Math.abs(arrivalMomentKgM) > MAX_MOMENT_KGM ||
    !Number.isFinite(arrivalCgM) ||
    Math.abs(arrivalCgM) > MAX_ARM_M
  )
    return { ok: false, reason: 'NUMERIC_OVERFLOW' }
  return { ok: true, arrivalMomentKgM, arrivalCgM }
}
