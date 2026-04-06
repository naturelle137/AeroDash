import { describe, it, expect } from 'vitest'
import {
  normalizeMassToKg,
  massKgToUnit,
  normalizeArmToM,
  armMToUnit,
  normalizeVolumeToL,
  volumeLToUnit,
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
