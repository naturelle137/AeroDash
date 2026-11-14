/**
 * Arm lookup interpolation for Mass & Balance.
 * Pure mathematical function. P1 Safety Core.
 */
import type { ArmLookupEntry } from '../domain/aircraft.types'

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
