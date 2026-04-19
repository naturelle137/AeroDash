// @UT-MB-CORE-FUEL-MASS-001@ (FROM: @IMP-MB-CORE-FUEL-MASS-001@)

import { describe, it, expect } from 'vitest'
import { normalizeFuelQuantityToKg, isFuelQuantityUnit } from './fuel-mass'

describe('isFuelQuantityUnit', () => {
  it.each(['kg', 'lb', 'L', 'USG', 'IMPgal', 'gal'])('accepts %s', (u) => {
    expect(isFuelQuantityUnit(u)).toBe(true)
  })

  it.each(['m', 'ft', 'in', 'km', '', 'foo'])('rejects %s', (u) => {
    expect(isFuelQuantityUnit(u)).toBe(false)
  })
})

describe('normalizeFuelQuantityToKg', () => {
  it('passes kg through unchanged', () => {
    expect(normalizeFuelQuantityToKg(50, 'kg', ['AvGas 100LL'])).toBe(50)
  })

  it('converts lb to kg', () => {
    expect(normalizeFuelQuantityToKg(100, 'lb', ['AvGas 100LL'])).toBeCloseTo(45.359237, 5)
  })

  it('converts 100 L of AvGas 100LL to 72 kg (regression: bowser report 100 L != 95 kg)', () => {
    expect(normalizeFuelQuantityToKg(100, 'L', ['AvGas 100LL'])).toBeCloseTo(72, 6)
  })

  it('converts 100 L of MoGas to 72 kg', () => {
    expect(normalizeFuelQuantityToKg(100, 'L', ['MoGas'])).toBeCloseTo(72, 6)
  })

  it('converts 100 L of Jet A-1 to 84 kg', () => {
    expect(normalizeFuelQuantityToKg(100, 'L', ['Jet A-1'])).toBeCloseTo(84, 6)
  })

  it('converts 100 L of Diesel to 84 kg', () => {
    expect(normalizeFuelQuantityToKg(100, 'L', ['Diesel'])).toBeCloseTo(84, 6)
  })

  it('converts 10 US gallons of AvGas to 27.254964 kg', () => {
    // 10 USG × 3.785411784 L/USG × 0.72 kg/L = 27.2549648448
    expect(normalizeFuelQuantityToKg(10, 'USG', ['AvGas 100LL'])).toBeCloseTo(27.2549648, 6)
  })

  it('treats "gal" as a US gallon alias', () => {
    expect(normalizeFuelQuantityToKg(10, 'gal', ['AvGas 100LL'])).toBeCloseTo(
      normalizeFuelQuantityToKg(10, 'USG', ['AvGas 100LL']),
      6,
    )
  })

  it('converts 10 Imperial gallons of AvGas to 32.7318 kg', () => {
    // 10 IMPgal × 4.54609 L/IMPgal × 0.72 kg/L = 32.7318...
    expect(normalizeFuelQuantityToKg(10, 'IMPgal', ['AvGas 100LL'])).toBeCloseTo(32.7318, 4)
  })

  it('picks the first permissible fuel type when multiple are allowed', () => {
    // 100 L of AvGas (listed first) = 72 kg; MoGas happens to match, but the
    // test ensures index-0 selection semantics regardless of identical values.
    expect(normalizeFuelQuantityToKg(100, 'L', ['AvGas 100LL', 'Jet A-1'])).toBeCloseTo(72, 6)
  })

  it('falls back to Jet A-1 (0.84 kg/L, heaviest / conservative) when permissibleFuelTypes is empty', () => {
    expect(normalizeFuelQuantityToKg(100, 'L', [])).toBeCloseTo(84, 6)
  })

  it('clamps negative or zero values to 0', () => {
    expect(normalizeFuelQuantityToKg(0, 'L', ['AvGas 100LL'])).toBe(0)
    expect(normalizeFuelQuantityToKg(-5, 'L', ['AvGas 100LL'])).toBe(0)
    expect(normalizeFuelQuantityToKg(-5, 'kg', ['AvGas 100LL'])).toBe(0)
  })
})
