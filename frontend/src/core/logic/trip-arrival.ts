import { z } from 'zod'

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
        'INVALID_INPUT' | 'INCONSISTENT_MASS' | 'TRIP_EXCEEDS_USABLE_FUEL' | 'NUMERIC_OVERFLOW'
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
