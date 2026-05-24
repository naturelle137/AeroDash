// @UT-MB-CORE-ENVELOPE-SORT-001@ (FROM: @IMP-MB-CORE-ENVELOPE-SORT-001@)

import { describe, it, expect } from 'vitest'
import { sortEnvelopeCcw } from './envelope-sort'
import type { EnvelopePoint } from '../domain/aircraft.types'

describe('sortEnvelopeCcw', () => {
  it('returns a new array (no mutation)', () => {
    const input: EnvelopePoint[] = [
      { armOrMoment: 1, mass: 1 },
      { armOrMoment: 2, mass: 1 },
      { armOrMoment: 2, mass: 2 },
      { armOrMoment: 1, mass: 2 },
    ]
    const snapshot = JSON.parse(JSON.stringify(input))
    sortEnvelopeCcw(input)
    expect(input).toEqual(snapshot)
  })

  it('returns input as-is for fewer than 3 points', () => {
    expect(sortEnvelopeCcw([])).toEqual([])
    expect(sortEnvelopeCcw([{ armOrMoment: 1, mass: 1 }])).toEqual([{ armOrMoment: 1, mass: 1 }])
  })

  it('reorders a bowtie-ordered rectangle into a proper rectangle (CCW)', () => {
    // Bowtie: connecting points in this order crosses edges.
    const bowtie: EnvelopePoint[] = [
      { armOrMoment: 1, mass: 1 }, // bottom-left
      { armOrMoment: 2, mass: 2 }, // top-right
      { armOrMoment: 2, mass: 1 }, // bottom-right
      { armOrMoment: 1, mass: 2 }, // top-left
    ]
    const sorted = sortEnvelopeCcw(bowtie)
    // After CCW sort around centroid (1.5, 1.5), we expect the walk to go
    // around the rectangle without self-intersection. Verify by checking each
    // consecutive-edge pair does not cross any non-adjacent edge.
    expect(isNonSelfIntersecting(sorted)).toBe(true)
  })

  it('preserves CCW order for an already-sorted rectangle', () => {
    const ccw: EnvelopePoint[] = [
      { armOrMoment: 2, mass: 1 }, // bottom-right
      { armOrMoment: 2, mass: 2 }, // top-right
      { armOrMoment: 1, mass: 2 }, // top-left
      { armOrMoment: 1, mass: 1 }, // bottom-left
    ]
    const sorted = sortEnvelopeCcw(ccw)
    expect(isNonSelfIntersecting(sorted)).toBe(true)
  })

  it('produces a CCW winding (positive signed area)', () => {
    const points: EnvelopePoint[] = [
      { armOrMoment: 1, mass: 1 },
      { armOrMoment: 2, mass: 2 },
      { armOrMoment: 2, mass: 1 },
      { armOrMoment: 1, mass: 2 },
    ]
    const sorted = sortEnvelopeCcw(points)
    expect(signedArea(sorted)).toBeGreaterThan(0)
  })

  it('handles a 6-point hexagonal envelope (realistic POH shape)', () => {
    const hex: EnvelopePoint[] = [
      { armOrMoment: 1.9, mass: 650 }, // unsorted input
      { armOrMoment: 1.85, mass: 500 },
      { armOrMoment: 1.85, mass: 600 },
      { armOrMoment: 1.95, mass: 600 },
      { armOrMoment: 1.95, mass: 500 },
      { armOrMoment: 1.9, mass: 450 },
    ]
    const sorted = sortEnvelopeCcw(hex)
    expect(sorted).toHaveLength(6)
    expect(isNonSelfIntersecting(sorted)).toBe(true)
    expect(signedArea(sorted)).toBeGreaterThan(0)
  })
})

// ─── Test helpers ────────────────────────────────────────────────────────────

function signedArea(points: EnvelopePoint[]): number {
  let s = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    s += a.armOrMoment * b.mass - b.armOrMoment * a.mass
  }
  return s / 2
}

function isNonSelfIntersecting(points: EnvelopePoint[]): boolean {
  const n = points.length
  if (n < 4) return true
  for (let i = 0; i < n; i++) {
    const a = points[i]!
    const b = points[(i + 1) % n]!
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges (share an endpoint)
      if (j === i || (j + 1) % n === i) continue
      const c = points[j]!
      const d = points[(j + 1) % n]!
      if (i === 0 && j === n - 1) continue // edges touch at closing vertex
      if (segmentsProperlyCross(a, b, c, d)) return false
    }
  }
  return true
}

function segmentsProperlyCross(
  p1: EnvelopePoint,
  p2: EnvelopePoint,
  p3: EnvelopePoint,
  p4: EnvelopePoint,
): boolean {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  return false
}

function cross(o: EnvelopePoint, a: EnvelopePoint, b: EnvelopePoint): number {
  return (a.armOrMoment - o.armOrMoment) * (b.mass - o.mass) -
    (a.mass - o.mass) * (b.armOrMoment - o.armOrMoment)
}
