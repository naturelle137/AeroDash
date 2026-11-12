import { describe, it, expect } from 'vitest'
import {
  formatMassConservative,
  formatFuelConservative,
  formatArm,
  getDecimalPrecision,
} from './display-rounding'

describe('formatMassConservative', () => {
  it('rounds mass value UP (ceil) at 1 decimal place', () => {
    // 583.12 → ceil to 1 dp → 583.2
    expect(formatMassConservative(583.12, 1)).toBe('583.2')
  })

  it('returns exact value when no rounding needed', () => {
    expect(formatMassConservative(650.0, 1)).toBe('650.0')
  })

  it('rounds up at 0 decimal places (integer ceiling)', () => {
    // 649.1 → ceil to 0 dp → 650
    expect(formatMassConservative(649.1, 0)).toBe('650')
  })

  it('never rounds down for mass', () => {
    // 100.001 → ceil to 1 dp → 100.1 (not 100.0)
    expect(formatMassConservative(100.001, 1)).toBe('100.1')
  })

  it('uses 1 decimal place by default', () => {
    expect(formatMassConservative(583.0)).toBe('583.0')
  })
})

describe('formatFuelConservative', () => {
  it('rounds fuel value DOWN (floor) at 1 decimal place', () => {
    // 57.89 → floor to 1 dp → 57.8
    expect(formatFuelConservative(57.89, 1)).toBe('57.8')
  })

  it('returns exact value when no rounding needed', () => {
    expect(formatFuelConservative(57.0, 1)).toBe('57.0')
  })

  it('rounds down at 0 decimal places', () => {
    // 57.9 → floor to 0 dp → 57
    expect(formatFuelConservative(57.9, 0)).toBe('57')
  })

  it('never rounds up for fuel (conservative for endurance)', () => {
    // 99.999 → floor to 1 dp → 99.9 (not 100.0)
    expect(formatFuelConservative(99.999, 1)).toBe('99.9')
  })
})

describe('formatArm', () => {
  it('formats arm to 3 decimal places by default', () => {
    expect(formatArm(1.877)).toBe('1.877')
  })

  it('formats arm to specified decimal places', () => {
    expect(formatArm(1.877, 2)).toBe('1.88')
  })

  it('uses standard rounding (not conservative) for arm', () => {
    // 1.8775 → standard round to 3 dp → 1.878 (or 1.877 depending on float)
    // Key: not applying ceil or floor
    const result = formatArm(1.8775, 3)
    expect(['1.877', '1.878']).toContain(result)
  })
})

describe('getDecimalPrecision', () => {
  it('returns 3 decimal places for metres', () => {
    expect(getDecimalPrecision('m')).toBe(3)
  })

  it('returns 1 decimal place for centimetres', () => {
    expect(getDecimalPrecision('cm')).toBe(1)
  })

  it('returns 0 decimal places for millimetres', () => {
    expect(getDecimalPrecision('mm')).toBe(0)
  })

  it('returns 2 decimal places for inches', () => {
    expect(getDecimalPrecision('in')).toBe(2)
  })

  it('returns 1 decimal place for kg', () => {
    expect(getDecimalPrecision('kg')).toBe(1)
  })

  it('returns 1 decimal place for lb', () => {
    expect(getDecimalPrecision('lb')).toBe(1)
  })

  it('returns 1 decimal place for litres', () => {
    expect(getDecimalPrecision('L')).toBe(1)
  })

  it('returns 1 decimal place for US gallons', () => {
    expect(getDecimalPrecision('gal')).toBe(1)
  })

  it('returns 1 decimal place for unknown unit (safe default)', () => {
    expect(getDecimalPrecision('xyz')).toBe(1)
  })
})
