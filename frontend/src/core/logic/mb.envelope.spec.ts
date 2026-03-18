import { describe, it, expect } from 'vitest'
import { isCgWithinEnvelope } from './mb.envelope'
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
  it('returns true for CG point clearly inside envelope', () => {
    expect(isCgWithinEnvelope(1.877, 540, RECTANGULAR_ENVELOPE)).toBe(true)
  })

  // @UT-MB-CORE-005@ (FROM: @IMP-MB-CORE-011@)
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

  // @UT-MB-CORE-031@ (FROM: @IMP-MB-CORE-011@)
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

  // @UT-MB-CORE-032@ (FROM: @IMP-MB-CORE-011@)
  it('returns false for CG arm beyond aft limit', () => {
    expect(isCgWithinEnvelope(2.1, 540, RECTANGULAR_ENVELOPE)).toBe(false)
  })

  // @UT-MB-CORE-033@ (FROM: @IMP-MB-CORE-011@)
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

  it('returns false for CG mass above envelope top', () => {
    expect(isCgWithinEnvelope(1.877, 700, RECTANGULAR_ENVELOPE)).toBe(false)
  })

  // @UT-MB-CORE-042@ (FROM: @IMP-MB-CORE-011@)
  it('accepts triangular envelope with minimum 3 vertices', () => {
    expect(
      isCgWithinEnvelope(1.877, 433, [
        { armOrMoment: 1.8, mass: 400 },
        { armOrMoment: 2.0, mass: 400 },
        { armOrMoment: 1.9, mass: 700 },
      ]),
    ).toBe(true)
  })

  // @UT-MB-CORE-020@ (FROM: @IMP-MB-CORE-011@)
  it('throws for envelope with fewer than 3 vertices', () => {
    expect(() =>
      isCgWithinEnvelope(1.877, 433, [
        { armOrMoment: 1.841, mass: 433 },
        { armOrMoment: 1.978, mass: 650 },
      ]),
    ).toThrow('Invalid Input: Envelope must have at least 3 vertices.')
  })
})
