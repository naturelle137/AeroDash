/**
 * Integration tests for the conservative extrapolation control composed with
 * the trilinear POH-distance engine — the design §7 pipeline handshake:
 *
 *   pivotDataPointsToCube → trilinearInterpolate (clamp + flag)
 *     → cubeEnvelopeRanges → resolveExtrapolatedDistance (block / +20% / floor / ack)
 *
 * The unit specs prove each module in isolation; this file proves the **flow**
 * across the two P1 modules using the exact operating points from the safety
 * journeys UJ-C-001 (Hot & High + controlled extrapolation) and UJ-E-003 (Deep
 * Winter floor). The boundary is intentionally P1↔P1 (no Vue/Pinia) — the
 * runtime wiring into the safety-factor pipeline and the acknowledgment-gate UI
 * is delivered by the Performance UI / safety-factor module tasks.
 *
 * @see ../performance.extrapolation.ts
 * @see ../performance.poh-distance.ts
 * @see docs/architecture/performance-extrapolation-control.md
 */

// @IT-PF-CORE-003@ (FROM: @IMP-PF-CORE-003@, @IMP-PF-CORE-011@)

import { describe, it, expect } from 'vitest'
import {
  trilinearInterpolate,
  pivotDataPointsToCube,
  type PohDistanceConditions,
  type PerformanceCube3D,
} from '../performance.poh-distance'
import {
  cubeEnvelopeRanges,
  resolveExtrapolatedDistance,
} from '../performance.extrapolation'
import type { PerformanceDataPoint } from '../../domain/aircraft.types'

// POH envelope mirroring the journeys: temperature −25…50 °C, PA 0…10,000 ft.
// (UJ-C-001 maxima 50 °C / 10,000 ft; UJ-E-003 minimum −25 °C @ 2,000 ft.)
const MASS_AXIS = [580, 650] as const
const ALT_AXIS = [0, 5000, 10_000] as const
const TEMP_AXIS = [-25, 0, 50] as const
const OPERATING_MASS = 620
const OPERATING_PA = 2000

/**
 * Regular-grid POH table that is monotonically non-decreasing in mass, pressure
 * altitude, and temperature — the monotonicity assumption the control relies on
 * (worse → longer, better → shorter), so the clamped boundary is always the
 * conservative base distance.
 */
function phaseDataPoints(base: number): PerformanceDataPoint[] {
  const out: PerformanceDataPoint[] = []
  for (const temperature of TEMP_AXIS) {
    for (const pressureAltitude of ALT_AXIS) {
      for (const mass of MASS_AXIS) {
        out.push({
          mass,
          pressureAltitude,
          temperature,
          distance:
            base *
            (mass / MASS_AXIS[0]) *
            (1 + pressureAltitude / 20_000) *
            (1 + (temperature - TEMP_AXIS[0]) / 300),
        })
      }
    }
  }
  return out
}

const cube: PerformanceCube3D = pivotDataPointsToCube(phaseDataPoints(210))
const ranges = cubeEnvelopeRanges(cube)

const conditions = (
  mass: number,
  pressureAltitude: number,
  temperature: number,
): PohDistanceConditions => ({ mass, pressureAltitude, temperature })

/** Clamped POH base distance the extrapolation control penalises/floors. */
function baseDistance(c: PohDistanceConditions): number {
  return trilinearInterpolate({ ...c, cube }).distance
}

describe('integration: trilinear clamp → conservative extrapolation control', () => {
  describe('UJ-C-001 — Hot & High + controlled extrapolation', () => {
    it('within the envelope passes the interpolated distance through unpenalised', () => {
      const c = conditions(OPERATING_MASS, OPERATING_PA, 30)
      const lookup = trilinearInterpolate({ ...c, cube })
      expect(lookup.temperatureClamped).toBe(false)
      const r = resolveExtrapolatedDistance(lookup.distance, c, ranges)
      expect(r.state).toBe('within_envelope')
      if (r.state === 'blocked') throw new Error('unexpected block')
      expect(r.distance).toBeCloseTo(lookup.distance, 10)
      expect(r.requiresAcknowledgment).toBe(false)
    })

    it('54 °C (4 °C above the 50 °C maximum) extrapolates with a +20% penalty and requires acknowledgment', () => {
      const c = conditions(OPERATING_MASS, OPERATING_PA, 54)
      const lookup = trilinearInterpolate({ ...c, cube })
      expect(lookup.temperatureClamped).toBe(true)
      const r = resolveExtrapolatedDistance(lookup.distance, c, ranges)
      expect(r.state).toBe('extrapolated')
      if (r.state === 'blocked') throw new Error('unexpected block')
      expect(r.distance).toBeCloseTo(lookup.distance * 1.2, 10)
      expect(r.requiresAcknowledgment).toBe(true)
    })

    it('exactly the 10% boundary (55 °C) is the last accepted point — extrapolated, not blocked', () => {
      const c = conditions(OPERATING_MASS, OPERATING_PA, 55)
      const r = resolveExtrapolatedDistance(baseDistance(c), c, ranges)
      expect(r.state).toBe('extrapolated')
      if (r.state === 'blocked') throw new Error('unexpected block')
      expect(r.requiresAcknowledgment).toBe(true)
    })

    it('57 °C (beyond the 10% temperature band) blocks computation with no distance', () => {
      const c = conditions(OPERATING_MASS, OPERATING_PA, 57)
      const r = resolveExtrapolatedDistance(baseDistance(c), c, ranges)
      expect(r.state).toBe('blocked')
      if (r.state !== 'blocked') throw new Error('expected block')
      expect(r.reason).toBe('extrapolation_exceeds_cap')
      expect('distance' in r).toBe(false)
    })

    it('11,000 ft (exactly 10% above the 10,000 ft maximum) is accepted; 11,100 ft (+11%) blocks', () => {
      const atBoundary = conditions(OPERATING_MASS, 11_000, 30)
      const accepted = resolveExtrapolatedDistance(baseDistance(atBoundary), atBoundary, ranges)
      expect(accepted.state).toBe('extrapolated')

      const breach = conditions(OPERATING_MASS, 11_100, 30)
      const blocked = resolveExtrapolatedDistance(baseDistance(breach), breach, ranges)
      expect(blocked.state).toBe('blocked')
      if (blocked.state !== 'blocked') throw new Error('expected block')
      expect(blocked.reason).toBe('extrapolation_exceeds_cap')
    })

    it('applies the control uniformly across all four POH distance types', () => {
      const c = conditions(OPERATING_MASS, OPERATING_PA, 54)
      for (const base of [210, 340, 185, 315]) {
        const typeCube = pivotDataPointsToCube(phaseDataPoints(base))
        const lookup = trilinearInterpolate({ ...c, cube: typeCube })
        const r = resolveExtrapolatedDistance(lookup.distance, c, cubeEnvelopeRanges(typeCube))
        expect(r.state).toBe('extrapolated')
        if (r.state === 'blocked') throw new Error('unexpected block')
        expect(r.distance).toBeCloseTo(lookup.distance * 1.2, 10)
        expect(r.requiresAcknowledgment).toBe(true)
      }
    })
  })

  describe('UJ-E-003 — Deep Winter floor (Minimum Distance Rule)', () => {
    it('−30 °C (below the −25 °C minimum) floors the distance at the best-case POH value', () => {
      const c = conditions(OPERATING_MASS, OPERATING_PA, -30)
      const lookup = trilinearInterpolate({ ...c, cube })
      expect(lookup.temperatureClamped).toBe(true)
      const floorBase = baseDistance(conditions(OPERATING_MASS, OPERATING_PA, -25))
      expect(lookup.distance).toBeCloseTo(floorBase, 10)

      const r = resolveExtrapolatedDistance(lookup.distance, c, ranges)
      if (r.state === 'blocked') throw new Error('unexpected block')
      expect(r.distance).toBeCloseTo(floorBase, 10)
      expect(r.benefitCapped).toBe(true)
    })

    it('the floored distance is never shorter than the best documented POH value', () => {
      const c = conditions(OPERATING_MASS, OPERATING_PA, -30)
      const floorBase = baseDistance(conditions(OPERATING_MASS, OPERATING_PA, -25))
      const r = resolveExtrapolatedDistance(baseDistance(c), c, ranges)
      if (r.state === 'blocked') throw new Error('unexpected block')
      expect(r.distance).toBeGreaterThanOrEqual(floorBase - 1e-9)
    })

    it('a below-minimum floor is conservative without a penalty per the Minimum Distance Rule', () => {
      const c = conditions(OPERATING_MASS, OPERATING_PA, -30)
      const r = resolveExtrapolatedDistance(baseDistance(c), c, ranges)
      expect(r.state).toBe('within_envelope')
      if (r.state === 'blocked') throw new Error('unexpected block')
      expect(r.benefitCapped).toBe(true)
    })
  })
})
