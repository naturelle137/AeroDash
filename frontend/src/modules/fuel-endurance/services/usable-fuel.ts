import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'
import { isFuelQuantityUnit, normalizeFuelQuantityToKg } from '@/core/logic/fuel-mass'
import { isKnownFuelType } from '@/core/logic/fuel-density'

export type UsableFuelResult =
  { ok: true; usableFuelKg: number; excludedUnusableKg: number } | { ok: false; reason: string }

export function usableFuelForPlanning(
  aircraft: unknown,
  category: string | null,
  stations: readonly StationInput[],
): UsableFuelResult {
  const parsed = AircraftContextSchema.safeParse(aircraft)
  if (!parsed.success)
    return {
      ok: false,
      reason:
        'Select a valid aircraft with supported fuel types and tank definitions; fallback density is not accepted.',
    }
  const profile = parsed.data
  if (profile.powertrain !== 'combustion')
    return { ok: false, reason: 'Combustion aircraft required.' }
  if (!profile.certificationCategories.some((c) => c.category === category)) {
    return { ok: false, reason: 'Select a valid aircraft category.' }
  }
  let usableFuelKg = 0
  let excludedUnusableKg = 0
  let tankCount = 0
  for (const [index, tank] of profile.loadPoints.entries()) {
    if (
      !tank.fuelTank ||
      (tank.allowableCategories !== null &&
        !tank.allowableCategories.includes(category as 'Normal' | 'Utility' | 'Aerobatic'))
    )
      continue
    tankCount++
    const matches = stations.filter((s) => s.index === index)
    if (matches.length !== 1)
      return { ok: false, reason: `${tank.name}: exactly one current tank load is required.` }
    const quantity = matches[0]!.weight
    const fuel = tank.fuelTank
    if (!isFuelQuantityUnit(tank.unit) || !fuel.permissibleFuelTypes.every(isKnownFuelType)) {
      return {
        ok: false,
        reason: `${tank.name}: unsupported fuel unit or type; fallback density cannot be used.`,
      }
    }
    if (
      quantity === undefined ||
      !Number.isFinite(quantity) ||
      quantity < fuel.unusableFuel ||
      (tank.operationalLimit !== null && quantity > tank.operationalLimit)
    ) {
      return {
        ok: false,
        reason: `${tank.name}: enter a finite tank load between unusable fuel and the tank limit.`,
      }
    }
    const unusableKg = normalizeFuelQuantityToKg(
      fuel.unusableFuel,
      tank.unit,
      fuel.permissibleFuelTypes,
    )
    usableFuelKg += normalizeFuelQuantityToKg(
      quantity - fuel.unusableFuel,
      tank.unit,
      fuel.permissibleFuelTypes,
    )
    excludedUnusableKg += unusableKg
  }
  if (tankCount === 0) return { ok: false, reason: 'No fuel tanks available in this category.' }
  if (![usableFuelKg, excludedUnusableKg].every(Number.isFinite))
    return { ok: false, reason: 'Fuel conversion exceeds numeric limits.' }
  return { ok: true, usableFuelKg, excludedUnusableKg }
}
