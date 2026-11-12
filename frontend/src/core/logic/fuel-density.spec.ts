import { describe, it, expect } from 'vitest'
import {
  getFuelDensityKgPerL,
  fuelVolumeToMassKg,
  FUEL_DENSITY_KG_PER_L,
  CANONICAL_FUEL_TYPES,
  isKnownFuelType,
  isCanonicalFuelType,
} from './fuel-density'

describe('FUEL_DENSITY_KG_PER_L', () => {
  it('contains density 0.72 for AVGAS', () => {
    expect(FUEL_DENSITY_KG_PER_L['AVGAS']).toBe(0.72)
  })

  it('contains density 0.72 for MOGAS', () => {
    expect(FUEL_DENSITY_KG_PER_L['MOGAS']).toBe(0.72)
  })

  it('contains density 0.72 for AvGas 100LL', () => {
    expect(FUEL_DENSITY_KG_PER_L['AvGas 100LL']).toBe(0.72)
  })

  it('contains density 0.72 for AvGas UL91', () => {
    expect(FUEL_DENSITY_KG_PER_L['AvGas UL91']).toBe(0.72)
  })

  it('contains density 0.84 for Jet A-1', () => {
    expect(FUEL_DENSITY_KG_PER_L['Jet A-1']).toBe(0.84)
  })

  it('contains density 0.84 for Diesel', () => {
    expect(FUEL_DENSITY_KG_PER_L['Diesel']).toBe(0.84)
  })
})

describe('getFuelDensityKgPerL', () => {
  it('returns 0.72 for AvGas 100LL', () => {
    expect(getFuelDensityKgPerL('AvGas 100LL')).toBe(0.72)
  })

  it('returns 0.84 for Jet A-1', () => {
    expect(getFuelDensityKgPerL('Jet A-1')).toBe(0.84)
  })

  it('returns conservative fallback 0.84 for unknown fuel type', () => {
    expect(getFuelDensityKgPerL('UnknownFuel')).toBe(0.84)
  })
})

describe('fuelVolumeToMassKg', () => {
  it('converts 100 L of AvGas at 0.72 kg/L to 72 kg (floor)', () => {
    expect(fuelVolumeToMassKg(100, 0.72)).toBe(72)
  })

  it('converts 50 L of Jet A-1 at 0.84 kg/L to 42 kg (floor)', () => {
    expect(fuelVolumeToMassKg(50, 0.84)).toBe(42)
  })

  it('floors fractional kg result (conservative for fuel)', () => {
    // 10 L × 0.72 = 7.2 kg → floor → 7 kg
    expect(fuelVolumeToMassKg(10, 0.72)).toBe(7)
  })

  it('returns 0 for negative volume (clamp)', () => {
    expect(fuelVolumeToMassKg(-5, 0.72)).toBe(0)
  })

  it('returns 0 for zero volume', () => {
    expect(fuelVolumeToMassKg(0, 0.72)).toBe(0)
  })
})

// ─── Canonical fuel-type convergence + fail-closed (BUNDLE 4) ─────────────────

describe('CANONICAL_FUEL_TYPES', () => {
  it('matches the AircraftProfile schema enum set', () => {
    expect([...CANONICAL_FUEL_TYPES]).toEqual([
      'MoGas',
      'AvGas 100LL',
      'Jet A-1',
      'AvGas UL91',
      'Diesel',
    ])
  })

  it('every canonical type resolves to an explicit (non-fallback) density', () => {
    for (const t of CANONICAL_FUEL_TYPES) {
      expect(FUEL_DENSITY_KG_PER_L[t]).toBeDefined()
      expect(isKnownFuelType(t)).toBe(true)
      expect(isCanonicalFuelType(t)).toBe(true)
    }
  })
})

describe('isKnownFuelType', () => {
  it('returns true for canonical types and recognised legacy aliases (non-fallback density)', () => {
    expect(isKnownFuelType('Jet A-1')).toBe(true)
    expect(isKnownFuelType('AVGAS')).toBe(true) // legacy alias → correct density
    expect(isKnownFuelType('MOGAS')).toBe(true)
  })

  it('returns false for a genuinely unknown type that would hit the fallback', () => {
    expect(isKnownFuelType('Kerosene')).toBe(false)
    expect(isKnownFuelType('')).toBe(false)
    expect(isKnownFuelType('avgas')).toBe(false) // wrong casing → fallback risk
  })
})

describe('isCanonicalFuelType', () => {
  it('accepts only the canonical enum (rejects legacy aliases)', () => {
    expect(isCanonicalFuelType('AvGas 100LL')).toBe(true)
    expect(isCanonicalFuelType('AVGAS')).toBe(false)
    expect(isCanonicalFuelType('MOGAS')).toBe(false)
    expect(isCanonicalFuelType('Kerosene')).toBe(false)
  })
})
