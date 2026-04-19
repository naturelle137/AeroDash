/**
 * Envelope polygon sort — P1 Safety Core.
 *
 * A CG envelope polygon in a POH is a closed convex boundary around the allowed
 * (arm-or-moment, mass) region. Pilots enter the vertices as they read them from
 * the diagram, which may not be in winding order. If the vertices are stored in a
 * tangled order (e.g. a "bowtie" where edges cross), downstream rendering AND
 * the point-in-polygon ray-cast in `mb.envelope.ts` will disagree about which
 * points are inside — a safety-critical defect (incorrect Go/No-Go verdict).
 *
 * This helper normalises the vertex order into counter-clockwise angular order
 * around the centroid, so the connected polygon encloses the intended region.
 * Pure function — no framework dependencies, deterministic, no side effects.
 *
 * Limitation: only guaranteed correct for convex polygons, which matches every
 * published POH envelope. Non-convex / self-intersecting shapes are out of scope
 * (the pilot would need to file a deviation; the POH itself would be unusual).
 *
 * @see docs/risk_management/safety_hazards.md (H-005, H-006 — CG envelope integrity)
 */

// @IMP-MB-CORE-ENVELOPE-SORT-001@ (FROM: @REQ-MB-001@, @REQ-AD-011@)

import type { EnvelopePoint } from '../domain/aircraft.types'

/**
 * Sort the envelope vertices into counter-clockwise angular order around their
 * centroid. Returns a new array; does not mutate the input.
 *
 * For fewer than 3 vertices the input is returned unchanged — a polygon is
 * undefined below 3 points and callers already validate that elsewhere.
 */
export function sortEnvelopeCcw(points: readonly EnvelopePoint[]): EnvelopePoint[] {
  if (points.length < 3) return points.slice()

  const n = points.length
  let sumX = 0
  let sumY = 0
  for (const p of points) {
    sumX += p.armOrMoment
    sumY += p.mass
  }
  const cx = sumX / n
  const cy = sumY / n

  return points
    .map((p) => ({ p, angle: Math.atan2(p.mass - cy, p.armOrMoment - cx) }))
    .sort((a, b) => a.angle - b.angle)
    .map((entry) => entry.p)
}
