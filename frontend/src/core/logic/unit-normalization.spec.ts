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
  it('returns the value unchanged for kg input', () => {
    expect(normalizeMassToKg(80, 'kg')).toBe(80)
  })

  it('converts lb to kg correctly (100 lb ≈ 45.36 kg)', () => {
    expect(normalizeMassToKg(100, 'lb')).toBeCloseTo(45.359237, 5)
  })

  it('is invertible: kg → lb → kg roundtrips within float precision', () => {
    const original = 200
    const lb = massKgToUnit(original, 'lb')
    const back = normalizeMassToKg(lb, 'lb')
    expect(back).toBeCloseTo(original, 10)
  })
})

describe('massKgToUnit', () => {
  it('returns the value unchanged for kg target', () => {
    expect(massKgToUnit(80, 'kg')).toBe(80)
  })

  it('converts kg to lb correctly (45.359237 kg = 100 lb)', () => {
    expect(massKgToUnit(45.359237, 'lb')).toBeCloseTo(100, 4)
  })
})

describe('normalizeArmToM', () => {
  it('returns the value unchanged for m input', () => {
    expect(normalizeArmToM(2.0, 'm')).toBe(2.0)
  })

  it('converts inches to metres correctly (1 in = 0.0254 m)', () => {
    expect(normalizeArmToM(1, 'in')).toBeCloseTo(0.0254, 10)
  })

  it('converts feet to metres correctly (1 ft = 0.3048 m)', () => {
    expect(normalizeArmToM(1, 'ft')).toBeCloseTo(0.3048, 10)
  })

  it('is invertible: m → in → m roundtrips within float precision', () => {
    const original = 2.083
    const inches = armMToUnit(original, 'in')
    const back = normalizeArmToM(inches, 'in')
    expect(back).toBeCloseTo(original, 10)
  })
})

describe('armMToUnit', () => {
  it('returns the value unchanged for m target', () => {
    expect(armMToUnit(2.0, 'm')).toBe(2.0)
  })

  it('converts metres to feet correctly (1 m ≈ 3.281 ft)', () => {
    expect(armMToUnit(1, 'ft')).toBeCloseTo(1 / 0.3048, 5)
  })
})

describe('normalizeVolumeToL', () => {
  it('returns the value unchanged for L input', () => {
    expect(normalizeVolumeToL(10, 'L')).toBe(10)
  })

  it('converts US gallons to litres correctly (1 gal = 3.785411784 L)', () => {
    expect(normalizeVolumeToL(1, 'gal')).toBeCloseTo(3.785411784, 7)
  })

  it('is invertible: L → gal → L roundtrips within float precision', () => {
    const original = 100
    const gal = volumeLToUnit(original, 'gal')
    const back = normalizeVolumeToL(gal, 'gal')
    expect(back).toBeCloseTo(original, 10)
  })
})

describe('volumeLToUnit', () => {
  it('returns the value unchanged for L target', () => {
    expect(volumeLToUnit(10, 'L')).toBe(10)
  })

  it('converts litres to US gallons correctly (3.785411784 L = 1 gal)', () => {
    expect(volumeLToUnit(3.785411784, 'gal')).toBeCloseTo(1, 5)
  })
})

describe('normalizeMomentToSI', () => {
  it('returns the value unchanged for m (kg·m) input', () => {
    expect(normalizeMomentToSI(123.4, 'm')).toBe(123.4)
  })

  it('scales a kg·in moment to kg·m by the inch factor (1 kg·in = 0.0254 kg·m)', () => {
    expect(normalizeMomentToSI(1, 'in')).toBeCloseTo(0.0254, 10)
  })

  it('scales a kg·ft moment to kg·m by the foot factor (1 kg·ft = 0.3048 kg·m)', () => {
    expect(normalizeMomentToSI(1, 'ft')).toBeCloseTo(0.3048, 10)
  })

  it('is consistent with mass×arm: 100 kg × 40 in == moment 4000 kg·in normalized', () => {
    const armM = normalizeArmToM(40, 'in')
    const momentSI = normalizeMomentToSI(100 * 40, 'in')
    expect(momentSI).toBeCloseTo(100 * armM, 10)
  })
})

describe('parseSourceUnit', () => {
  it('parses mass-only "kg" to { kg, m } (preserves legacy metric behaviour)', () => {
    expect(parseSourceUnit('kg')).toEqual({ massUnit: 'kg', armUnit: 'm' })
  })

  it('parses mass-only "lb" to { lb, m }', () => {
    expect(parseSourceUnit('lb')).toEqual({ massUnit: 'lb', armUnit: 'm' })
  })

  it('parses combined "lb-in" to { lb, in }', () => {
    expect(parseSourceUnit('lb-in')).toEqual({ massUnit: 'lb', armUnit: 'in' })
  })

  it('parses combined "kg-m" and "lb-ft"', () => {
    expect(parseSourceUnit('kg-m')).toEqual({ massUnit: 'kg', armUnit: 'm' })
    expect(parseSourceUnit('lb-ft')).toEqual({ massUnit: 'lb', armUnit: 'ft' })
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(parseSourceUnit('  LB-IN  ')).toEqual({ massUnit: 'lb', armUnit: 'in' })
  })

  it('falls back to SI defaults for unknown components (never silently mis-scales)', () => {
    expect(parseSourceUnit('stone-cubits')).toEqual({ massUnit: 'kg', armUnit: 'm' })
    expect(parseSourceUnit('')).toEqual({ massUnit: 'kg', armUnit: 'm' })
    expect(parseSourceUnit('lb-furlong')).toEqual({ massUnit: 'lb', armUnit: 'm' })
  })
})
