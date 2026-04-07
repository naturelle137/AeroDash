/**
 * Canonical bilinear interpolation test vectors — CI gate.
 *
 * Test vectors are derived from a synthetic-but-aviation-realistic
 * performance table for a light aircraft (C172S-class, ~1157 kg MTOM).
 * Values approximate typical POH data; they are self-consistent and
 * cross-checked against manual bilinear interpolation calculations.
 *
 * Four distance types are covered:
 *   TOR  — Takeoff Roll                 (ground roll only)
 *   TOD  — Takeoff Distance to 50 ft    (≈ 1.6 × TOR)
 *   LR   — Landing Roll                 (ground roll only)
 *   LD   — Landing Distance from 50 ft  (≈ 1.7 × LR)
 *
 * @see docs/architecture/performance-bilinear-interpolation-contract.md
 */

// @UT-PF-CORE-001@ (FROM: @IMP-PF-CORE-001@, @REQ-PF-002@)

import { describe, it, expect } from 'vitest'
import {
  bilinearInterpolate,
  type PerformanceTable,
  type BilinearLookupInput,
} from './performance.bilinear-interpolation'

// ── Canonical performance tables ─────────────────────────────────────────────
//
// All values are in SI units:  mass → kg, pressure altitude → ft, distance → m.
//
// Table layout:  values[altitudeIndex][massIndex]
//
//              850 kg  1000 kg  1157 kg
//  PA=0:       ...
//  PA=2000:    ...
//  PA=4000:    ...
//  PA=6000:    ...

const MASS_AXIS = [850, 1000, 1157] as const
const ALT_AXIS = [0, 2000, 4000, 6000] as const

/** Takeoff Roll distance table (m). */
const TOR_TABLE: PerformanceTable = {
  massAxis: [...MASS_AXIS],
  altitudeAxis: [...ALT_AXIS],
  values: [
    [210, 270, 340], // PA = 0 ft
    [255, 325, 410], // PA = 2000 ft
    [305, 390, 490], // PA = 4000 ft
    [365, 465, 585], // PA = 6000 ft
  ],
}

/** Takeoff Distance to 50 ft obstacle (m). */
const TOD_TABLE: PerformanceTable = {
  massAxis: [...MASS_AXIS],
  altitudeAxis: [...ALT_AXIS],
  values: [
    [340, 435, 545], // PA = 0 ft
    [410, 520, 655], // PA = 2000 ft
    [490, 625, 785], // PA = 4000 ft
    [585, 745, 940], // PA = 6000 ft
  ],
}

/** Landing Roll distance table (m). */
const LR_TABLE: PerformanceTable = {
  massAxis: [...MASS_AXIS],
  altitudeAxis: [...ALT_AXIS],
  values: [
    [185, 220, 260], // PA = 0 ft
    [195, 230, 275], // PA = 2000 ft
    [205, 245, 290], // PA = 4000 ft
    [215, 260, 310], // PA = 6000 ft
  ],
}

/** Landing Distance from 50 ft obstacle (m). */
const LD_TABLE: PerformanceTable = {
  massAxis: [...MASS_AXIS],
  altitudeAxis: [...ALT_AXIS],
  values: [
    [315, 375, 440], // PA = 0 ft
    [330, 390, 465], // PA = 2000 ft
    [350, 415, 495], // PA = 4000 ft
    [365, 440, 525], // PA = 6000 ft
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lookup(table: PerformanceTable, mass: number, pa: number): BilinearLookupInput {
  return { mass, pressureAltitude: pa, table }
}

// ── TOR canonical vectors ─────────────────────────────────────────────────────

describe('bilinearInterpolate — TOR (Takeoff Roll)', () => {
  // Grid-exact points
  it('VEC-TOR-001: exact grid point (850 kg, 0 ft) → 210 m', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 850, 0))
    expect(result.distance).toBeCloseTo(210, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOR-002: exact grid point (1157 kg, 6000 ft) → 585 m', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 1157, 6000))
    expect(result.distance).toBeCloseTo(585, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOR-003: exact grid point (1000 kg, 2000 ft) → 325 m', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 1000, 2000))
    expect(result.distance).toBeCloseTo(325, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  // Mass-axis interpolation (exact altitude)
  it('VEC-TOR-004: mass midpoint between 850–1000 kg at 0 ft → 240 m', () => {
    // t_mass = (925 - 850) / (1000 - 850) = 0.5
    // lerp(210, 270, 0.5) = 240
    const result = bilinearInterpolate(lookup(TOR_TABLE, 925, 0))
    expect(result.distance).toBeCloseTo(240, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOR-005: mass midpoint between 850–1000 kg at 4000 ft → 347.5 m', () => {
    // t_mass = 0.5 → lerp(305, 390, 0.5) = 347.5
    const result = bilinearInterpolate(lookup(TOR_TABLE, 925, 4000))
    expect(result.distance).toBeCloseTo(347.5, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  // Altitude-axis interpolation (exact mass)
  it('VEC-TOR-006: altitude midpoint 0–2000 ft at 850 kg → 232.5 m', () => {
    // t_alt = 0.5 → lerp(210, 255, 0.5) = 232.5
    const result = bilinearInterpolate(lookup(TOR_TABLE, 850, 1000))
    expect(result.distance).toBeCloseTo(232.5, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOR-007: altitude midpoint 4000–6000 ft at 1157 kg → 537.5 m', () => {
    // t_alt = 0.5 → lerp(490, 585, 0.5) = 537.5
    const result = bilinearInterpolate(lookup(TOR_TABLE, 1157, 5000))
    expect(result.distance).toBeCloseTo(537.5, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  // Full bilinear (both axes between grid points)
  it('VEC-TOR-008: bilinear at (925 kg, 1000 ft) → 265 m', () => {
    // t_mass = (925-850)/(1000-850) = 0.5
    // t_alt  = (1000-0)/(2000-0) = 0.5
    // z11=210, z12=270, z21=255, z22=325
    // zAtPA0   = lerp(210, 270, 0.5) = 240
    // zAtPA2000= lerp(255, 325, 0.5) = 290
    // result   = lerp(240, 290, 0.5) = 265
    const result = bilinearInterpolate(lookup(TOR_TABLE, 925, 1000))
    expect(result.distance).toBeCloseTo(265, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOR-009: bilinear at (1078.5 kg, 3000 ft) → 437.5 m', () => {
    // t_mass = (1078.5-1000)/(1157-1000) = 78.5/157 = 0.5
    // t_alt  = (3000-2000)/(4000-2000) = 0.5
    // z11=325(1000,2000), z12=410(1157,2000), z21=390(1000,4000), z22=490(1157,4000)
    // zAtPA2000 = lerp(325, 410, 0.5) = 367.5
    // zAtPA4000 = lerp(390, 490, 0.5) = 440
    // result    = lerp(367.5, 440, 0.5) = 403.75
    const result = bilinearInterpolate(lookup(TOR_TABLE, 1078.5, 3000))
    expect(result.distance).toBeCloseTo(403.75, 1)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  // Boundary clamping
  it('VEC-TOR-010: mass below min (700 kg, 0 ft) → 210 m, massClamped=true', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 700, 0))
    expect(result.distance).toBeCloseTo(210, 5)
    expect(result.massClamped).toBe(true)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOR-011: mass above max (1200 kg, 0 ft) → 340 m, massClamped=true', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 1200, 0))
    expect(result.distance).toBeCloseTo(340, 5)
    expect(result.massClamped).toBe(true)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOR-012: altitude above max (1000 kg, 8000 ft) → 465 m, altitudeClamped=true', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 1000, 8000))
    expect(result.distance).toBeCloseTo(465, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(true)
  })

  it('VEC-TOR-013: altitude below min (850 kg, -500 ft) → 210 m, altitudeClamped=true', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 850, -500))
    expect(result.distance).toBeCloseTo(210, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(true)
  })

  it('VEC-TOR-014: both out of bounds (700 kg, -500 ft) → 210 m, both clamped', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 700, -500))
    expect(result.distance).toBeCloseTo(210, 5)
    expect(result.massClamped).toBe(true)
    expect(result.altitudeClamped).toBe(true)
  })

  it('VEC-TOR-015: both out of bounds (1300 kg, 9000 ft) → 585 m, both clamped', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 1300, 9000))
    expect(result.distance).toBeCloseTo(585, 5)
    expect(result.massClamped).toBe(true)
    expect(result.altitudeClamped).toBe(true)
  })
})

// ── TOD canonical vectors ─────────────────────────────────────────────────────

describe('bilinearInterpolate — TOD (Takeoff Distance to 50 ft)', () => {
  it('VEC-TOD-001: exact grid point (850 kg, 0 ft) → 340 m', () => {
    const result = bilinearInterpolate(lookup(TOD_TABLE, 850, 0))
    expect(result.distance).toBeCloseTo(340, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOD-002: exact grid point (1157 kg, 6000 ft) → 940 m', () => {
    const result = bilinearInterpolate(lookup(TOD_TABLE, 1157, 6000))
    expect(result.distance).toBeCloseTo(940, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOD-003: bilinear at (925 kg, 1000 ft) → 428 m', () => {
    // t_mass = 0.5, t_alt = 0.5
    // z11=340, z12=435, z21=410, z22=520
    // zAtPA0    = lerp(340, 435, 0.5) = 387.5
    // zAtPA2000 = lerp(410, 520, 0.5) = 465
    // result    = lerp(387.5, 465, 0.5) = 426.25
    const result = bilinearInterpolate(lookup(TOD_TABLE, 925, 1000))
    expect(result.distance).toBeCloseTo(426.25, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-TOD-004: mass above max (1200 kg, 4000 ft) → 785 m, massClamped=true', () => {
    const result = bilinearInterpolate(lookup(TOD_TABLE, 1200, 4000))
    expect(result.distance).toBeCloseTo(785, 5)
    expect(result.massClamped).toBe(true)
    expect(result.altitudeClamped).toBe(false)
  })
})

// ── LR canonical vectors ──────────────────────────────────────────────────────

describe('bilinearInterpolate — LR (Landing Roll)', () => {
  it('VEC-LR-001: exact grid point (850 kg, 0 ft) → 185 m', () => {
    const result = bilinearInterpolate(lookup(LR_TABLE, 850, 0))
    expect(result.distance).toBeCloseTo(185, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LR-002: exact grid point (1157 kg, 6000 ft) → 310 m', () => {
    const result = bilinearInterpolate(lookup(LR_TABLE, 1157, 6000))
    expect(result.distance).toBeCloseTo(310, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LR-003: mass midpoint at 0 ft (925 kg) → 202.5 m', () => {
    // lerp(185, 220, 0.5) = 202.5
    const result = bilinearInterpolate(lookup(LR_TABLE, 925, 0))
    expect(result.distance).toBeCloseTo(202.5, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LR-004: altitude midpoint at 850 kg (1000 ft) → 190 m', () => {
    // lerp(185, 195, 0.5) = 190
    const result = bilinearInterpolate(lookup(LR_TABLE, 850, 1000))
    expect(result.distance).toBeCloseTo(190, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LR-005: bilinear at (925 kg, 1000 ft) → 207.5 m', () => {
    // t_mass=0.5, t_alt=0.5
    // z11=185, z12=220, z21=195, z22=230
    // zAtPA0    = lerp(185, 220, 0.5) = 202.5
    // zAtPA2000 = lerp(195, 230, 0.5) = 212.5
    // result    = lerp(202.5, 212.5, 0.5) = 207.5
    const result = bilinearInterpolate(lookup(LR_TABLE, 925, 1000))
    expect(result.distance).toBeCloseTo(207.5, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LR-006: altitude above max (1000 kg, 8000 ft) → 260 m, altitudeClamped=true', () => {
    const result = bilinearInterpolate(lookup(LR_TABLE, 1000, 8000))
    expect(result.distance).toBeCloseTo(260, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(true)
  })
})

// ── LD canonical vectors ──────────────────────────────────────────────────────

describe('bilinearInterpolate — LD (Landing Distance from 50 ft)', () => {
  it('VEC-LD-001: exact grid point (850 kg, 0 ft) → 315 m', () => {
    const result = bilinearInterpolate(lookup(LD_TABLE, 850, 0))
    expect(result.distance).toBeCloseTo(315, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LD-002: exact grid point (1157 kg, 6000 ft) → 525 m', () => {
    const result = bilinearInterpolate(lookup(LD_TABLE, 1157, 6000))
    expect(result.distance).toBeCloseTo(525, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LD-003: bilinear at (925 kg, 1000 ft) → 349.375 m', () => {
    // t_mass=0.5, t_alt=0.5
    // z11=315, z12=375, z21=330, z22=390
    // zAtPA0    = lerp(315, 375, 0.5) = 345
    // zAtPA2000 = lerp(330, 390, 0.5) = 360
    // result    = lerp(345, 360, 0.5) = 352.5
    const result = bilinearInterpolate(lookup(LD_TABLE, 925, 1000))
    expect(result.distance).toBeCloseTo(352.5, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LD-004: exact mass, altitude midpoint 2000–4000 ft at 1000 kg → 402.5 m', () => {
    // lerp(390, 415, 0.5) = 402.5
    const result = bilinearInterpolate(lookup(LD_TABLE, 1000, 3000))
    expect(result.distance).toBeCloseTo(402.5, 5)
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-LD-005: mass below min (600 kg, 2000 ft) → 330 m, massClamped=true', () => {
    const result = bilinearInterpolate(lookup(LD_TABLE, 600, 2000))
    expect(result.distance).toBeCloseTo(330, 5)
    expect(result.massClamped).toBe(true)
    expect(result.altitudeClamped).toBe(false)
  })
})

// ── Edge-case / structural validation vectors ────────────────────────────────

describe('bilinearInterpolate — edge cases and validation', () => {
  it('VEC-EDGE-001: 1×1 degenerate table returns single value', () => {
    const table: PerformanceTable = {
      massAxis: [1000],
      altitudeAxis: [0],
      values: [[500]],
    }
    const result = bilinearInterpolate({ mass: 1000, pressureAltitude: 0, table })
    expect(result.distance).toBe(500)
  })

  it('VEC-EDGE-002: 1×1 table with out-of-range input clamps and returns single value', () => {
    const table: PerformanceTable = {
      massAxis: [1000],
      altitudeAxis: [0],
      values: [[500]],
    }
    const result = bilinearInterpolate({ mass: 1200, pressureAltitude: 3000, table })
    expect(result.distance).toBe(500)
    expect(result.massClamped).toBe(true)
    expect(result.altitudeClamped).toBe(true)
  })

  it('VEC-EDGE-003: single mass column, multiple altitude rows — interpolates altitude only', () => {
    const table: PerformanceTable = {
      massAxis: [1000],
      altitudeAxis: [0, 2000],
      values: [[300], [360]],
    }
    // t_alt = 0.5 → lerp(300, 360, 0.5) = 330
    const result = bilinearInterpolate({ mass: 1000, pressureAltitude: 1000, table })
    expect(result.distance).toBeCloseTo(330, 5)
  })

  it('VEC-EDGE-004: single altitude row, multiple mass columns — interpolates mass only', () => {
    const table: PerformanceTable = {
      massAxis: [850, 1157],
      altitudeAxis: [0],
      values: [[210, 340]],
    }
    // t_mass = (1003.5-850)/(1157-850) = 153.5/307 = 0.5 → lerp(210, 340, 0.5) = 275
    const result = bilinearInterpolate({ mass: 1003.5, pressureAltitude: 0, table })
    expect(result.distance).toBeCloseTo(275, 5)
  })

  it('VEC-EDGE-005: throws when massAxis is empty', () => {
    const table: PerformanceTable = {
      massAxis: [],
      altitudeAxis: [0],
      values: [[]],
    }
    expect(() => bilinearInterpolate({ mass: 1000, pressureAltitude: 0, table })).toThrow(
      '[PF-BILINEAR]',
    )
  })

  it('VEC-EDGE-006: throws when altitudeAxis is empty', () => {
    const table: PerformanceTable = {
      massAxis: [1000],
      altitudeAxis: [],
      values: [],
    }
    expect(() => bilinearInterpolate({ mass: 1000, pressureAltitude: 0, table })).toThrow(
      '[PF-BILINEAR]',
    )
  })

  it('VEC-EDGE-007: throws when values row count mismatches altitudeAxis', () => {
    const table: PerformanceTable = {
      massAxis: [1000],
      altitudeAxis: [0, 2000],
      values: [[300]], // only 1 row but 2 altitudes
    }
    expect(() => bilinearInterpolate({ mass: 1000, pressureAltitude: 0, table })).toThrow(
      '[PF-BILINEAR]',
    )
  })

  it('VEC-EDGE-008: throws when values column count mismatches massAxis', () => {
    const table: PerformanceTable = {
      massAxis: [850, 1157],
      altitudeAxis: [0],
      values: [[300]], // only 1 col but 2 masses
    }
    expect(() => bilinearInterpolate({ mass: 1000, pressureAltitude: 0, table })).toThrow(
      '[PF-BILINEAR]',
    )
  })

  it('VEC-EDGE-009: exact upper-boundary mass and altitude — no clamping flags', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 1157, 6000))
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })

  it('VEC-EDGE-010: exact lower-boundary mass and altitude — no clamping flags', () => {
    const result = bilinearInterpolate(lookup(TOR_TABLE, 850, 0))
    expect(result.massClamped).toBe(false)
    expect(result.altitudeClamped).toBe(false)
  })
})
