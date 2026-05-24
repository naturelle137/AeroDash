/**
 * Fuel-quantity → mass normalisation — P1 Safety Core.
 *
 * A fuel tank's capacity and unusable-fuel value may be stored in volume
 * units (L, US gal, Imperial gal) or mass units (kg, lb). The Mass & Balance
 * math core always consumes mass in kg, so every fuel quantity must be
 * normalised at the adapter boundary using the fuel density for the tank's
 * first permissible fuel type.
 *
 * Previously this conversion was silently skipped — a fuel station entered in
 * litres was treated as if the numeric value were kilograms, producing a
 * 100 L → 100 kg result (actual AvGas mass: 72 kg). This is a Go/No-Go
 * defect (H-002 — fuel unit confusion).
 *
 * Pure function — no framework dependencies.
 */

// @IMP-MB-CORE-FUEL-MASS-001@ (FROM: @REQ-SYS-003@, @REQ-FE-001@, @REQ-MB-008@, H-002)

import { getFuelDensityKgPerL } from './fuel-density'
import { normalizeMassToKg } from './unit-normalization'

const US_GAL_TO_L = 3.785411784 as const
const IMP_GAL_TO_L = 4.54609 as const

/** Unit strings accepted for a fuel-tank station. Superset of VolumeUnit + MassUnit. */
export type FuelQuantityUnit = 'kg' | 'lb' | 'L' | 'USG' | 'IMPgal' | 'gal'

/**
 * Return true if the given unit string is a recognised fuel-tank unit.
 * 'gal' is treated as a US gallon alias (matches the existing VolumeUnit).
 */
export function isFuelQuantityUnit(unit: string): unit is FuelQuantityUnit {
  return unit === 'kg' || unit === 'lb' || unit === 'L' || unit === 'USG' ||
    unit === 'IMPgal' || unit === 'gal'
}

/**
 * Convert a fuel quantity expressed in the tank's unit (volume or mass) to a
 * mass in kg, applying the appropriate density for volume units.
 *
 * @param value - numeric quantity in the tank's `unit`
 * @param unit - 'kg', 'lb', 'L', 'USG', 'IMPgal', or 'gal'
 * @param permissibleFuelTypes - the tank's permissible fuel types. The first
 *   entry's density is used for the conversion; if the array is empty, the
 *   heaviest fallback (Jet A-1, 0.84 kg/L) is applied as a conservative guard.
 * @returns mass in kg. Negative inputs clamp to 0 (mass cannot be negative).
 */
export function normalizeFuelQuantityToKg(
  value: number,
  unit: FuelQuantityUnit,
  permissibleFuelTypes: readonly string[],
): number {
  if (value <= 0) return 0

  if (unit === 'kg' || unit === 'lb') {
    return normalizeMassToKg(value, unit)
  }

  const litres =
    unit === 'L' ? value :
    unit === 'IMPgal' ? value * IMP_GAL_TO_L :
    /* USG or gal */ value * US_GAL_TO_L

  const fuelType = permissibleFuelTypes[0] ?? 'Jet A-1'
  const density = getFuelDensityKgPerL(fuelType)
  return litres * density
}
