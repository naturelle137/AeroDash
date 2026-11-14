/**
 * Arm lookup interpolation for Mass & Balance.
 * Pure mathematical function. P1 Safety Core.
 */
import type { ArmLookupEntry } from '../domain/aircraft.types'
import { MAX_MASS_KG, MAX_MOMENT_KGM } from './si-bounds'

/** The single linear moment rule shared by legacy arm lookup and strict moment lookup. */
function interpolateSegmentMoment(p1: ArmLookupEntry, p2: ArmLookupEntry, x: number): number {
  const ratio = (x - p1.massOrVolume) / (p2.massOrVolume - p1.massOrVolume)
  return p1.moment + ratio * (p2.moment - p1.moment)
}

/**
 * Strict total-moment lookup for a caller-validated table: at least two entries
 * in strictly ascending quantity order. Returns null outside the table instead of
 * clamping or extrapolating.
 */
export function interpolateMomentStrict(
  x: number,
  lookup: readonly ArmLookupEntry[],
): number | null {
  for (let i = 0; i < lookup.length - 1; i++) {
    const p1 = lookup[i]!
    const p2 = lookup[i + 1]!
    if (x >= p1.massOrVolume && x <= p2.massOrVolume) return interpolateSegmentMoment(p1, p2, x)
  }
  return null
}

/**
 * Strict SI total-moment table: at least two finite entries with unique, strictly
 * ascending quantities in [0, MAX_MASS_KG] and moments within ±MAX_MOMENT_KGM.
 * Moments may be signed and nonmonotonic. Never sorted, clamped or extended.
 */
export function isStrictMomentLookup(lookup: readonly ArmLookupEntry[]): boolean {
  return (
    lookup.length >= 2 &&
    lookup.every(
      (entry, i) =>
        Number.isFinite(entry.massOrVolume) &&
        entry.massOrVolume >= 0 &&
        entry.massOrVolume <= MAX_MASS_KG &&
        Number.isFinite(entry.moment) &&
        Math.abs(entry.moment) <= MAX_MOMENT_KGM &&
        (i === 0 || entry.massOrVolume > lookup[i - 1]!.massOrVolume),
    )
  )
}

export type FuelLookupMomentResult =
  | { ok: true; usableMassKg: number; usableMomentKgM: number }
  | {
      ok: false
      reason:
        | 'INVALID_INPUT'
        | 'BELOW_UNUSABLE'
        | 'INVALID_GEOMETRY'
        | 'LOOKUP_OUT_OF_RANGE'
        | 'NUMERIC_OVERFLOW'
    }

/**
 * Usable-fuel contribution of a variable-geometry tank in SI (kg, kg·m).
 * The table holds the TOTAL tank moment F at each total tank mass, and unusable fuel
 * u already sits in BEM, so the usable contribution of current load q is F(q) − F(u).
 * Both q and u must lie inside the table; q < u is rejected, never coerced.
 */
export function fuelLookupUsableMoment(
  quantityKg: number,
  unusableKg: number,
  lookup: readonly ArmLookupEntry[],
): FuelLookupMomentResult {
  if (![quantityKg, unusableKg].every(Number.isFinite) || unusableKg < 0)
    return { ok: false, reason: 'INVALID_INPUT' }
  if (quantityKg < unusableKg) return { ok: false, reason: 'BELOW_UNUSABLE' }
  if (!isStrictMomentLookup(lookup)) return { ok: false, reason: 'INVALID_GEOMETRY' }
  const unusableMoment = interpolateMomentStrict(unusableKg, lookup)
  const totalMoment = interpolateMomentStrict(quantityKg, lookup)
  if (unusableMoment === null || totalMoment === null)
    return { ok: false, reason: 'LOOKUP_OUT_OF_RANGE' }
  const usableMassKg = quantityKg - unusableKg
  const usableMomentKgM = usableMassKg === 0 ? 0 : totalMoment - unusableMoment
  if (
    ![unusableMoment, totalMoment, usableMomentKgM].every(
      (v) => Number.isFinite(v) && Math.abs(v) <= MAX_MOMENT_KGM,
    )
  )
    return { ok: false, reason: 'NUMERIC_OVERFLOW' }
  return { ok: true, usableMassKg, usableMomentKgM }
}

/**
 * Linear interpolation for arm lookup tables.
 * Arm = Moment / Mass (or Volume).
 */
export function interpolateArmFromLookup(mass: number, lookup: ArmLookupEntry[]): number {
  if (lookup.length === 0) throw new Error('Invalid Input: armLookup has an invalid input.')
  if (mass === 0) {
    return lookup[0]!.massOrVolume > 0 ? lookup[0]!.moment / lookup[0]!.massOrVolume : 0
  }
  if (lookup.length === 1) return lookup[0]!.moment / lookup[0]!.massOrVolume

  const sorted = [...lookup].sort((a, b) => a.massOrVolume - b.massOrVolume)

  if (mass <= sorted[0]!.massOrVolume) return sorted[0]!.moment / sorted[0]!.massOrVolume
  if (mass >= sorted[sorted.length - 1]!.massOrVolume)
    return sorted[sorted.length - 1]!.moment / sorted[sorted.length - 1]!.massOrVolume

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i]!
    const p2 = sorted[i + 1]!
    if (mass >= p1.massOrVolume && mass <= p2.massOrVolume) {
      return interpolateSegmentMoment(p1, p2, mass) / mass
    }
  }

  throw new Error('Invalid Input: armLookup has an invalid input.')
}
