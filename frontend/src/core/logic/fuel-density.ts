/**
 * Fuel density constants and volume-to-mass conversion.
 * Pure mathematical functions. P1 Safety Core.
 *
 * @see REQ-FE-001
 */

// @IMP-FE-CORE-001@ (FROM: @REQ-FE-001@)

/**
 * Canonical fuel-type strings — the single source of truth shared by the
 * AircraftProfile schema enum, the AircraftContext schema enum, and the
 * fuel-density lookup. Any value outside this set is treated as UNKNOWN and
 * must be surfaced (fail-closed) rather than silently substituted.
 */
// @IMP-FE-CORE-002@ (FROM: @REQ-FE-001@, @REQ-SYS-003@, H-002)
export const CANONICAL_FUEL_TYPES = [
  'MoGas',
  'AvGas 100LL',
  'Jet A-1',
  'AvGas UL91',
  'Diesel',
] as const

export type CanonicalFuelType = (typeof CANONICAL_FUEL_TYPES)[number]

/**
 * Fuel density in kg/L, keyed by the canonical fuel-type strings used in
 * AircraftContext.loadPoints[].fuelTank.permissibleFuelTypes.
 *
 * AvGas (100LL, UL91, MoGas) = 0.72 kg/L
 * Jet A-1 / Diesel = 0.84 kg/L
 *
 * Provenance + revision tracking for these densities (and the conservative
 * fallback below) live in the data-constants registry:
 *   docs/data_constants/registry.json
 *     #fuel-density-avgas-mogas, #fuel-density-jet-diesel, #fuel-density-fallback
 * The data-constants gate (frontend/scripts/data-constants) fails CI if these
 * values drift from the registry or a cited source goes past its review date.
 *
 * Legacy uppercase aliases (`AVGAS`, `MOGAS`) are retained ONLY so historical
 * fixtures / ad-hoc callers still resolve a correct density; they are NOT
 * canonical and `isKnownFuelType` deliberately rejects them so the catalogue
 * and schemas converge on the canonical keys.
 */
export const FUEL_DENSITY_KG_PER_L: Readonly<Record<string, number>> = {
  // Canonical keys matching the AircraftProfile schema enum (`MoGas`, `AvGas 100LL`, …)
  MoGas: 0.72,
  'AvGas 100LL': 0.72,
  'AvGas UL91': 0.72,
  'Jet A-1': 0.84,
  Diesel: 0.84,
  // Legacy uppercase aliases (pre-schema fixtures / ad-hoc callers)
  AVGAS: 0.72,
  MOGAS: 0.72,
} as const

/** Fallback density when the fuel type is unrecognized (conservative — heavier). */
const FALLBACK_DENSITY_KG_PER_L = 0.84

/**
 * Return true when `fuelType` resolves to an EXPLICIT density (canonical key or
 * a recognised legacy alias) — i.e. NOT the silent conservative fallback.
 *
 * The adapter boundary uses this to fail-closed: a type that is NOT known would
 * otherwise hit the 0.84 fallback in getFuelDensityKgPerL and miscompute mass
 * with no signal (CS-008 / TECH-013). Legacy uppercase aliases (`AVGAS`,
 * `MOGAS`) still resolve a CORRECT density so they are treated as known here;
 * convergence onto canonical keys is enforced separately at the schema layer
 * (CS-009 / CS-010) where the catalogue and contexts are tightened to the enum.
 */
export function isKnownFuelType(fuelType: string): boolean {
  return Object.prototype.hasOwnProperty.call(FUEL_DENSITY_KG_PER_L, fuelType)
}

/** Narrow check against the canonical enum only (excludes legacy aliases). */
export function isCanonicalFuelType(fuelType: string): fuelType is CanonicalFuelType {
  return (CANONICAL_FUEL_TYPES as readonly string[]).includes(fuelType)
}

/**
 * Return the density in kg/L for the given fuel type string.
 * Uses the conservative fallback for unrecognized types.
 *
 * IMPORTANT: an unrecognized type returning the fallback is a SILENT
 * substitution at the math layer. Callers that can surface a notification MUST
 * gate on `isKnownFuelType` first and fail-closed (H-002 — fuel confusion).
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
