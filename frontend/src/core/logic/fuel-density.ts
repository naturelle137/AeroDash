/**
 * Fuel density constants and volume-to-mass conversion.
 * Pure mathematical functions. P1 Safety Core.
 *
 * @see REQ-FE-001
 */

// @IMP-FE-CORE-001@ (FROM: @REQ-FE-001@)

/**
 * Fuel density in kg/L, keyed by the canonical fuel-type strings used in
 * AircraftContext.loadPoints[].fuelTank.permissibleFuelTypes.
 *
 * AvGas (100LL, UL91, MOGAS) = 0.72 kg/L
 * Jet A-1 / Diesel = 0.84 kg/L
 */
export const FUEL_DENSITY_KG_PER_L: Readonly<Record<string, number>> = {
  AVGAS: 0.72,
  MOGAS: 0.72,
  'AvGas 100LL': 0.72,
  'AvGas UL91': 0.72,
  'Jet A-1': 0.84,
  Diesel: 0.84,
} as const

/** Fallback density when the fuel type is unrecognized (conservative — heavier). */
const FALLBACK_DENSITY_KG_PER_L = 0.84

/**
 * Return the density in kg/L for the given fuel type string.
 * Uses the conservative fallback for unrecognized types.
 */
export function getFuelDensityKgPerL(fuelType: string): number {
  return FUEL_DENSITY_KG_PER_L[fuelType] ?? FALLBACK_DENSITY_KG_PER_L
}

/**
 * Convert fuel volume (litres) to mass (kg) using the given fuel density.
 *
 * @param volumeLitres - Fuel volume in litres (must be ≥ 0).
 * @param densityKgPerL - Fuel density in kg/L.
 * @returns Mass in kg (rounded down per REQ-UQ-004 conservative rounding for fuel).
 */
export function fuelVolumeToMassKg(volumeLitres: number, densityKgPerL: number): number {
  if (volumeLitres < 0) return 0
  return Math.floor(volumeLitres * densityKgPerL)
}
