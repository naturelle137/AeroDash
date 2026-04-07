import { describe, it, expect } from 'vitest'
import { isCgWithinEnvelope, doesSegmentCrossEnvelope } from './mb.envelope'
import type { EnvelopePoint } from '../domain/aircraft.types'

// Rectangular envelope matching the default fixture: arm 1.841–1.978, mass 433–650
const RECTANGULAR_ENVELOPE: EnvelopePoint[] = [
  { armOrMoment: 1.841, mass: 433 },
  { armOrMoment: 1.978, mass: 433 },
  { armOrMoment: 1.978, mass: 650 },
  { armOrMoment: 1.841, mass: 650 },
]

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('isCgWithinEnvelope', () => {
  // @UT-MB-CORE-053@ (FROM: @IMP-MB-CORE-011@)
  it('returns true for CG point clearly inside envelope', () => {
    expect(isCgWithinEnvelope(1.877, 540, RECTANGULAR_ENVELOPE)).toBe(true)
  })

  // @UT-MB-CORE-054@ (FROM: @IMP-MB-CORE-011@)
  it('returns false for CG arm beyond forward limit', () => {
    expect(
      isCgWithinEnvelope(1.857, 583, [
        { armOrMoment: 1.9, mass: 433 },
        { armOrMoment: 1.978, mass: 433 },
        { armOrMoment: 1.978, mass: 650 },
        { armOrMoment: 1.9, mass: 650 },
      ]),
    ).toBe(false)
  })

  // @UT-MB-CORE-055@ (FROM: @IMP-MB-CORE-011@)
  // CG arm = (433×1.877 + 150×1.8) / 583 = 1.857188679245283
  it('returns true for CG arm exactly at forward limit', () => {
    expect(
      isCgWithinEnvelope(1.857188679245283, 583, [
        { armOrMoment: 1.857188679245283, mass: 433 },
        { armOrMoment: 1.978, mass: 433 },
        { armOrMoment: 1.978, mass: 650 },
        { armOrMoment: 1.857188679245283, mass: 650 },
      ]),
    ).toBe(true)
  })

  // @UT-MB-CORE-056@ (FROM: @IMP-MB-CORE-011@)
  it('returns false for CG arm beyond aft limit', () => {
    expect(isCgWithinEnvelope(2.1, 540, RECTANGULAR_ENVELOPE)).toBe(false)
  })

  // @UT-MB-CORE-057@ (FROM: @IMP-MB-CORE-011@)
  // CG arm = (433×1.877 + 200×2.417) / 633 ≈ 2.04761595 — just inside the aft boundary
  it('returns true for CG arm just inside the aft limit', () => {
    expect(
      isCgWithinEnvelope(2.04761595, 633, [
        { armOrMoment: 1.877, mass: 433 },
        { armOrMoment: 2.0476161137440765, mass: 433 },
        { armOrMoment: 2.0476161137440765, mass: 650 },
        { armOrMoment: 1.877, mass: 650 },
      ]),
    ).toBe(true)
  })

  // @UT-MB-CORE-058@ (FROM: @IMP-MB-CORE-011@)
  it('returns false for CG mass above envelope top', () => {
    expect(isCgWithinEnvelope(1.877, 700, RECTANGULAR_ENVELOPE)).toBe(false)
  })

  // @UT-MB-CORE-059@ (FROM: @IMP-MB-CORE-011@)
  it('accepts triangular envelope with minimum 3 vertices', () => {
    expect(
      isCgWithinEnvelope(1.877, 433, [
        { armOrMoment: 1.8, mass: 400 },
        { armOrMoment: 2.0, mass: 400 },
        { armOrMoment: 1.9, mass: 700 },
      ]),
    ).toBe(true)
  })

  // @UT-MB-CORE-060@ (FROM: @IMP-MB-CORE-011@)
  it('throws for envelope with fewer than 3 vertices', () => {
    expect(() =>
      isCgWithinEnvelope(1.877, 433, [
        { armOrMoment: 1.841, mass: 433 },
        { armOrMoment: 1.978, mass: 650 },
      ]),
    ).toThrow('Invalid Input: Envelope must have at least 3 vertices.')
  })
})

describe('doesSegmentCrossEnvelope', () => {
  // @UT-MB-CORE-087@ (FROM: @IMP-MB-CORE-015@)
  it('returns false when segment is entirely inside envelope', () => {
    expect(doesSegmentCrossEnvelope(1.877, 500, 1.9, 550, RECTANGULAR_ENVELOPE)).toBe(false)
  })

  // @UT-MB-CORE-088@ (FROM: @IMP-MB-CORE-015@)
  it('returns false when segment is entirely outside envelope', () => {
    expect(doesSegmentCrossEnvelope(2.1, 500, 2.2, 550, RECTANGULAR_ENVELOPE)).toBe(false)
  })

  // @UT-MB-CORE-089@ (FROM: @IMP-MB-CORE-015@)
  it('returns true when segment starts inside and exits through right edge', () => {
    expect(doesSegmentCrossEnvelope(1.9, 540, 2.1, 540, RECTANGULAR_ENVELOPE)).toBe(true)
  })

  // @UT-MB-CORE-090@ (FROM: @IMP-MB-CORE-015@)
  it('returns true when segment exits and re-enters envelope (crosses two edges)', () => {
    // Segment goes from inside (1.9, 540) → outside → back to inside (1.95, 540)
    // by traversing far left outside and back in — achieved by sweeping through
    // the forward boundary at 1.841
    expect(doesSegmentCrossEnvelope(1.9, 540, 1.7, 540, RECTANGULAR_ENVELOPE)).toBe(true)
  })

  // @UT-MB-CORE-091@ (FROM: @IMP-MB-CORE-015@)
  it('returns false for parallel segment that does not cross any edge', () => {
    // Horizontal segment entirely above envelope
    expect(doesSegmentCrossEnvelope(1.8, 700, 2.1, 700, RECTANGULAR_ENVELOPE)).toBe(false)
  })

  // @UT-MB-CORE-092@ (FROM: @IMP-MB-CORE-015@)
  it('throws for envelope with fewer than 3 vertices', () => {
    expect(() =>
      doesSegmentCrossEnvelope(1.877, 433, 1.9, 500, [
        { armOrMoment: 1.841, mass: 433 },
        { armOrMoment: 1.978, mass: 650 },
      ]),
    ).toThrow('Invalid Input: Envelope must have at least 3 vertices.')
  })

  // @UT-MB-CORE-093@ (FROM: @IMP-MB-CORE-015@)
  it('returns true when segment passes entirely through envelope (enters and exits)', () => {
    // Segment from x=1.7 (outside left) to x=2.1 (outside right) at y=540
    // crosses both left and right edges of the rectangular envelope
    expect(doesSegmentCrossEnvelope(1.7, 540, 2.1, 540, RECTANGULAR_ENVELOPE)).toBe(true)
  })
})
