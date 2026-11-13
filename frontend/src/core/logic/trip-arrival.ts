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
