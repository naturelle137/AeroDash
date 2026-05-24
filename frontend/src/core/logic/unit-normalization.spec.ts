import { describe, it, expect } from 'vitest'
import {
  normalizeMassToKg,
  massKgToUnit,
  normalizeArmToM,
  armMToUnit,
  normalizeVolumeToL,
  volumeLToUnit,
  normalizeMomentToSI,
  parseSourceUnit,
} from './unit-normalization'

describe('normalizeMassToKg', () => {
  // @UT-SYS-CORE-001@ (FROM: @IMP-SYS-CORE-006@)
  it('returns the value unchanged for kg input', () => {
    expect(normalizeMassToKg(80, 'kg')).toBe(80)
  })

  // @UT-SYS-CORE-002@ (FROM: @IMP-SYS-CORE-006@)
  it('converts lb to kg correctly (100 lb ≈ 45.36 kg)', () => {
    expect(normalizeMassToKg(100, 'lb')).toBeCloseTo(45.359237, 5)
  })

  // @UT-SYS-CORE-003@ (FROM: @IMP-SYS-CORE-006@)
  it('is invertible: kg → lb → kg roundtrips within float precision', () => {
    const original = 200
    const lb = massKgToUnit(original, 'lb')
    const back = normalizeMassToKg(lb, 'lb')
    expect(back).toBeCloseTo(original, 10)
  })
})

describe('massKgToUnit', () => {
  // @UT-SYS-CORE-004@ (FROM: @IMP-SYS-CORE-006@)
  it('returns the value unchanged for kg target', () => {
    expect(massKgToUnit(80, 'kg')).toBe(80)
  })

  // @UT-SYS-CORE-005@ (FROM: @IMP-SYS-CORE-006@)
  it('converts kg to lb correctly (45.359237 kg = 100 lb)', () => {
    expect(massKgToUnit(45.359237, 'lb')).toBeCloseTo(100, 4)
  })
})

describe('normalizeArmToM', () => {
  // @UT-SYS-CORE-006@ (FROM: @IMP-SYS-CORE-006@)
  it('returns the value unchanged for m input', () => {
    expect(normalizeArmToM(2.0, 'm')).toBe(2.0)
  })

  // @UT-SYS-CORE-007@ (FROM: @IMP-SYS-CORE-006@)
  it('converts inches to metres correctly (1 in = 0.0254 m)', () => {
    expect(normalizeArmToM(1, 'in')).toBeCloseTo(0.0254, 10)
  })

  // @UT-SYS-CORE-008@ (FROM: @IMP-SYS-CORE-006@)
  it('converts feet to metres correctly (1 ft = 0.3048 m)', () => {
    expect(normalizeArmToM(1, 'ft')).toBeCloseTo(0.3048, 10)
  })

  // @UT-SYS-CORE-009@ (FROM: @IMP-SYS-CORE-006@)
  it('is invertible: m → in → m roundtrips within float precision', () => {
    const original = 2.083
    const inches = armMToUnit(original, 'in')
    const back = normalizeArmToM(inches, 'in')
    expect(back).toBeCloseTo(original, 10)
  })
})

describe('armMToUnit', () => {
  // @UT-SYS-CORE-010@ (FROM: @IMP-SYS-CORE-006@)
  it('returns the value unchanged for m target', () => {
    expect(armMToUnit(2.0, 'm')).toBe(2.0)
  })

  // @UT-SYS-CORE-011@ (FROM: @IMP-SYS-CORE-006@)
  it('converts metres to feet correctly (1 m ≈ 3.281 ft)', () => {
    expect(armMToUnit(1, 'ft')).toBeCloseTo(1 / 0.3048, 5)
  })
})

describe('normalizeVolumeToL', () => {
  // @UT-SYS-CORE-012@ (FROM: @IMP-SYS-CORE-006@)
  it('returns the value unchanged for L input', () => {
    expect(normalizeVolumeToL(10, 'L')).toBe(10)
  })

  // @UT-SYS-CORE-013@ (FROM: @IMP-SYS-CORE-006@)
  it('converts US gallons to litres correctly (1 gal = 3.785411784 L)', () => {
    expect(normalizeVolumeToL(1, 'gal')).toBeCloseTo(3.785411784, 7)
  })

  // @UT-SYS-CORE-014@ (FROM: @IMP-SYS-CORE-006@)
  it('is invertible: L → gal → L roundtrips within float precision', () => {
    const original = 100
    const gal = volumeLToUnit(original, 'gal')
    const back = normalizeVolumeToL(gal, 'gal')
    expect(back).toBeCloseTo(original, 10)
  })
})

describe('volumeLToUnit', () => {
  // @UT-SYS-CORE-015@ (FROM: @IMP-SYS-CORE-006@)
  it('returns the value unchanged for L target', () => {
    expect(volumeLToUnit(10, 'L')).toBe(10)
  })

  // @UT-SYS-CORE-016@ (FROM: @IMP-SYS-CORE-006@)
  it('converts litres to US gallons correctly (3.785411784 L = 1 gal)', () => {
    expect(volumeLToUnit(3.785411784, 'gal')).toBeCloseTo(1, 5)
  })
})

describe('normalizeMomentToSI', () => {
  // @UT-SYS-CORE-031@ (FROM: @IMP-SYS-CORE-010@)
  it('returns the value unchanged for m (kg·m) input', () => {
    expect(normalizeMomentToSI(123.4, 'm')).toBe(123.4)
  })

  // @UT-SYS-CORE-032@ (FROM: @IMP-SYS-CORE-010@)
  it('scales a kg·in moment to kg·m by the inch factor (1 kg·in = 0.0254 kg·m)', () => {
    expect(normalizeMomentToSI(1, 'in')).toBeCloseTo(0.0254, 10)
  })

  // @UT-SYS-CORE-033@ (FROM: @IMP-SYS-CORE-010@)
  it('scales a kg·ft moment to kg·m by the foot factor (1 kg·ft = 0.3048 kg·m)', () => {
    expect(normalizeMomentToSI(1, 'ft')).toBeCloseTo(0.3048, 10)
  })

  // @UT-SYS-CORE-034@ (FROM: @IMP-SYS-CORE-010@)
  it('is consistent with mass×arm: 100 kg × 40 in == moment 4000 kg·in normalized', () => {
    const armM = normalizeArmToM(40, 'in')
    const momentSI = normalizeMomentToSI(100 * 40, 'in')
    expect(momentSI).toBeCloseTo(100 * armM, 10)
  })
})

describe('parseSourceUnit', () => {
  // @UT-SYS-CORE-035@ (FROM: @IMP-SYS-CORE-011@)
  it('parses mass-only "kg" to { kg, m } (preserves legacy metric behaviour)', () => {
    expect(parseSourceUnit('kg')).toEqual({ massUnit: 'kg', armUnit: 'm' })
  })

  // @UT-SYS-CORE-036@ (FROM: @IMP-SYS-CORE-011@)
  it('parses mass-only "lb" to { lb, m }', () => {
    expect(parseSourceUnit('lb')).toEqual({ massUnit: 'lb', armUnit: 'm' })
  })

  // @UT-SYS-CORE-037@ (FROM: @IMP-SYS-CORE-011@)
  it('parses combined "lb-in" to { lb, in }', () => {
    expect(parseSourceUnit('lb-in')).toEqual({ massUnit: 'lb', armUnit: 'in' })
  })

  // @UT-SYS-CORE-038@ (FROM: @IMP-SYS-CORE-011@)
  it('parses combined "kg-m" and "lb-ft"', () => {
    expect(parseSourceUnit('kg-m')).toEqual({ massUnit: 'kg', armUnit: 'm' })
    expect(parseSourceUnit('lb-ft')).toEqual({ massUnit: 'lb', armUnit: 'ft' })
  })

  // @UT-SYS-CORE-039@ (FROM: @IMP-SYS-CORE-011@)
  it('is case-insensitive and trims whitespace', () => {
    expect(parseSourceUnit('  LB-IN  ')).toEqual({ massUnit: 'lb', armUnit: 'in' })
  })

  // @UT-SYS-CORE-040@ (FROM: @IMP-SYS-CORE-011@)
  it('falls back to SI defaults for unknown components (never silently mis-scales)', () => {
    expect(parseSourceUnit('stone-cubits')).toEqual({ massUnit: 'kg', armUnit: 'm' })
    expect(parseSourceUnit('')).toEqual({ massUnit: 'kg', armUnit: 'm' })
    expect(parseSourceUnit('lb-furlong')).toEqual({ massUnit: 'lb', armUnit: 'm' })
  })
})
