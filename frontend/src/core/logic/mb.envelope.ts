/**
 * CG envelope containment check for Mass & Balance.
 * Pure mathematical function. P1 Safety Core.
 */
import type { EnvelopePoint } from '../domain/aircraft.types'

// @IMP-MB-CORE-011@ (FROM: @REQ-MB-007@)
/**
 * Ray-casting point-in-polygon test against the CG envelope.
 * Returns true when the CG point lies within the certified envelope boundary.
 */
export function isCgWithinEnvelope(
  armOrMoment: number,
  mass: number,
  envelope: EnvelopePoint[],
): boolean {
  if (envelope.length < 3) throw new Error('Invalid Input: Envelope must have at least 3 vertices.')
  let inside = false
  for (let i = 0, j = envelope.length - 1; i < envelope.length; j = i++) {
    const xi = envelope[i]!.armOrMoment,
      yi = envelope[i]!.mass
    const xj = envelope[j]!.armOrMoment,
      yj = envelope[j]!.mass

    const intersect =
      yi > mass !== yj > mass && armOrMoment < ((xj - xi) * (mass - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}
