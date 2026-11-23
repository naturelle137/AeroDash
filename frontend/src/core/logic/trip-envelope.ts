import type { EnvelopePoint } from '../domain/aircraft.types'
import { isCgWithinEnvelope } from './mb.envelope'

export interface BurnPoint { mass: number; moment: number }

// Split each burn segment at every envelope crossing, then test each open interval.
// In an arm graph x = moment / mass, so an edge can intersect the burn curve twice.
export function tripPathWithinEnvelope(
  path: BurnPoint[], envelope: EnvelopePoint[], graphType: 'arm' | 'moment',
): boolean | null {
  if (path.length === 0 || envelope.length < 3 ||
    !path.every(p => Number.isFinite(p.mass) && p.mass > 0 && Number.isFinite(p.moment)) ||
    !envelope.every(p => Number.isFinite(p.mass) && Number.isFinite(p.armOrMoment))) return null
  // A degenerate or self-intersecting polygon has no unambiguous interior.
  let area = 0
  const orient = (a: EnvelopePoint, b: EnvelopePoint, c: EnvelopePoint) =>
    (b.armOrMoment - a.armOrMoment) * (c.mass - a.mass) - (b.mass - a.mass) * (c.armOrMoment - a.armOrMoment)
  for (let i = 0; i < envelope.length; i++) {
    const a = envelope[i]!, b = envelope[(i + 1) % envelope.length]!
    if (a.mass === b.mass && a.armOrMoment === b.armOrMoment) return null
    area += a.armOrMoment * b.mass - b.armOrMoment * a.mass
    for (let j = i + 1; j < envelope.length; j++) {
      if (j === i + 1 || (i === 0 && j === envelope.length - 1)) continue
      const c = envelope[j]!, d = envelope[(j + 1) % envelope.length]!
      const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b)
      if (o1 * o2 <= 0 && o3 * o4 <= 0 &&
        Math.max(Math.min(a.armOrMoment, b.armOrMoment), Math.min(c.armOrMoment, d.armOrMoment)) <= Math.min(Math.max(a.armOrMoment, b.armOrMoment), Math.max(c.armOrMoment, d.armOrMoment)) &&
        Math.max(Math.min(a.mass, b.mass), Math.min(c.mass, d.mass)) <= Math.min(Math.max(a.mass, b.mass), Math.max(c.mass, d.mass))) return null
    }
  }
  if (!Number.isFinite(area) || area === 0) return null
  const point = (a: BurnPoint, b: BurnPoint, t: number) => {
    const mass = a.mass + (b.mass - a.mass) * t
    const moment = a.moment + (b.moment - a.moment) * t
    return { mass, x: graphType === 'arm' ? moment / mass : moment }
  }
  const inside = (p: { mass: number; x: number }) => {
    for (let i = 0; i < envelope.length; i++) {
      const a = envelope[i]!, b = envelope[(i + 1) % envelope.length]!
      const dx = b.armOrMoment - a.armOrMoment, dy = b.mass - a.mass
      const cross = (p.x - a.armOrMoment) * dy - (p.mass - a.mass) * dx
      if (Math.abs(cross) <= 1e-10 * Math.max(1, Math.abs(dx), Math.abs(dy)) &&
        p.x >= Math.min(a.armOrMoment, b.armOrMoment) - 1e-10 && p.x <= Math.max(a.armOrMoment, b.armOrMoment) + 1e-10 &&
        p.mass >= Math.min(a.mass, b.mass) - 1e-10 && p.mass <= Math.max(a.mass, b.mass) + 1e-10) return true
    }
    return isCgWithinEnvelope(p.x, p.mass, envelope)
  }
  if (!inside(point(path[0]!, path[0]!, 0))) return false
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!
    const dm = b.mass - a.mass, dmoment = b.moment - a.moment
    const cuts = [0, 1]
    for (let j = 0; j < envelope.length; j++) {
      const e = envelope[j]!, f = envelope[(j + 1) % envelope.length]!
      const dx = f.armOrMoment - e.armOrMoment, dy = f.mass - e.mass
      // Multiplication by positive mass preserves roots in arm graphs.
      const c = graphType === 'arm'
        ? (a.moment - e.armOrMoment * a.mass) * dy - (a.mass - e.mass) * dx * a.mass
        : (a.moment - e.armOrMoment) * dy - (a.mass - e.mass) * dx
      const linear = graphType === 'arm'
        ? (dmoment - e.armOrMoment * dm) * dy - dx * dm * (2 * a.mass - e.mass)
        : dmoment * dy - dm * dx
      const quadratic = graphType === 'arm' ? -dx * dm * dm : 0
      const roots: number[] = []
      if (Math.abs(quadratic) < 1e-14) {
        if (Math.abs(linear) > 1e-14) roots.push(-c / linear)
      } else {
        const discriminant = linear * linear - 4 * quadratic * c
        if (discriminant >= 0) {
          roots.push((-linear - Math.sqrt(discriminant)) / (2 * quadratic))
          roots.push((-linear + Math.sqrt(discriminant)) / (2 * quadratic))
        }
      }
      for (const t of roots) {
        if (t <= 0 || t >= 1 || !Number.isFinite(t)) continue
        const p = point(a, b, t)
        if (p.mass >= Math.min(e.mass, f.mass) - 1e-8 && p.mass <= Math.max(e.mass, f.mass) + 1e-8 &&
          p.x >= Math.min(e.armOrMoment, f.armOrMoment) - 1e-8 && p.x <= Math.max(e.armOrMoment, f.armOrMoment) + 1e-8) cuts.push(t)
      }
    }
    cuts.sort((x, y) => x - y)
    if (!inside(point(a, b, 1))) return false
    for (let k = 1; k < cuts.length; k++) {
      if (!inside(point(a, b, (cuts[k - 1]! + cuts[k]!) / 2))) return false
    }
  }
  return true
}
