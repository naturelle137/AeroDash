/**
 * Arm lookup interpolation for Mass & Balance.
 * Pure mathematical function. P1 Safety Core.
 */
import type { ArmLookupEntry } from '../domain/aircraft.types'

// @IMP-MB-CORE-012@ (FROM: @REQ-MB-012@)
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
      const ratio = (mass - p1.massOrVolume) / (p2.massOrVolume - p1.massOrVolume)
      const moment = p1.moment + ratio * (p2.moment - p1.moment)
      return moment / mass
    }
  }

  throw new Error('Invalid Input: armLookup has an invalid input.')
}
