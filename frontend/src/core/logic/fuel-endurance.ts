import { z } from 'zod'

const PlanSchema = z.object({
  usableFuelKg: z.number().nonnegative(),
  consumptionKgPerHour: z.number().positive(),
  tripMinutes: z.number().nonnegative(),
  reserveMinutes: z.number().nonnegative(),
})

export interface FuelPlan {
  enduranceMinutes: number
  tripFuelKg: number
  reserveFuelKg: number
  requiredFuelKg: number
  marginKg: number
  reserveShortfall: boolean
  warning: 'WARN-FE-001' | null
}

export type FuelPlanResult =
  { ok: true; plan: FuelPlan } | { ok: false; reason: 'INVALID_INPUT' | 'NUMERIC_OVERFLOW' }

export function calculateFuelEndurance(input: unknown): FuelPlanResult {
  const parsed = PlanSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'INVALID_INPUT' }
  const { usableFuelKg, consumptionKgPerHour, tripMinutes, reserveMinutes } = parsed.data
  const enduranceMinutes = (usableFuelKg / consumptionKgPerHour) * 60
  const tripFuelKg = (tripMinutes / 60) * consumptionKgPerHour
  const reserveFuelKg = (reserveMinutes / 60) * consumptionKgPerHour
  const requiredFuelKg = tripFuelKg + reserveFuelKg
  const marginKg = usableFuelKg - requiredFuelKg
  if (
    ![enduranceMinutes, tripFuelKg, reserveFuelKg, requiredFuelKg, marginKg].every(Number.isFinite)
  ) {
    return { ok: false, reason: 'NUMERIC_OVERFLOW' }
  }
  return {
    ok: true,
    plan: {
      enduranceMinutes,
      tripFuelKg,
      reserveFuelKg,
      requiredFuelKg,
      marginKg,
      reserveShortfall: reserveFuelKg > usableFuelKg,
      warning: marginKg < 0 ? 'WARN-FE-001' : null,
    },
  }
}
