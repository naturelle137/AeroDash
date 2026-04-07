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

// @IMP-MB-CORE-015@ (FROM: @REQ-MB-011@)
/**
 * Tests whether a line segment from (x1,y1) to (x2,y2) intersects any edge of
 * the envelope polygon. Used to detect CG migration paths that cross the
 * envelope boundary between discrete waypoints.
 *
 * Uses the parametric segment–segment intersection formula. Both segments are
 * treated as finite (t ∈ [0,1], u ∈ [0,1]).
 */
export function doesSegmentCrossEnvelope(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  envelope: EnvelopePoint[],
): boolean {
  if (envelope.length < 3) throw new Error('Invalid Input: Envelope must have at least 3 vertices.')
  for (let i = 0, j = envelope.length - 1; i < envelope.length; j = i++) {
    const ex1 = envelope[j]!.armOrMoment,
      ey1 = envelope[j]!.mass
    const ex2 = envelope[i]!.armOrMoment,
      ey2 = envelope[i]!.mass

    const dx = x2 - x1
    const dy = y2 - y1
    const edx = ex2 - ex1
    const edy = ey2 - ey1

    const denom = dx * edy - dy * edx
    if (Math.abs(denom) < 1e-12) continue // parallel segments

    const t = ((ex1 - x1) * edy - (ey1 - y1) * edx) / denom
    const u = ((ex1 - x1) * dy - (ey1 - y1) * dx) / denom

    if (t > 0 && t < 1 && u >= 0 && u <= 1) return true
  }
  return false
}
