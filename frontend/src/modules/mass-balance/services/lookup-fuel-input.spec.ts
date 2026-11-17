import { describe, expect, it } from 'vitest'
import type { LoadPointDefinition } from '../stores/mass-balance.types'
import { lookupFuelInputReason } from './lookup-fuel-input'

// Synthetic software geometry; not operational aircraft data.
function tank(unit = 'kg'): LoadPointDefinition {
  return {
    name: 'Lookup tank',
    arm: null,
    armLookup: [
      { massOrVolume: 0, moment: 0 },
      { massOrVolume: 50, moment: 150 },
    ],
    unit,
    defaultQuantity: 30,
    operationalLimit: null,
    allowableCategories: null,
    fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
  }
}

describe('raw lookup fuel unit validation', () => {
  it('directs explicit blank-unit correction from approved data without changing inputs', () => {
    const def = tank('')
    const original = structuredClone(def)
    expect(lookupFuelInputReason(def, 30, 'kg-m')).toEqual({
      code: 'UNSUPPORTED_UNIT',
      reason:
        "The tank unit is missing. In the aircraft editor, open Load Stations → Unit and select the unit using the aircraft's approved source data.",
    })
    expect(def).toEqual(original)
  })

  it('keeps source-unit failure ahead of blank tank-unit guidance', () => {
    expect(lookupFuelInputReason(tank(''), 30, 'kg-furlong')).toEqual({
      code: 'UNSUPPORTED_UNIT',
      reason: 'A supported explicit source unit is required for the fuel moment table.',
    })
  })

  it.each(['kg', 'lb', 'L', 'USG', 'IMPgal', 'gal'])(
    'allows explicit supported tank unit %s through raw validation',
    (unit) => expect(lookupFuelInputReason(tank(unit), 30, 'kg-m')).toBeNull(),
  )

  it.each(['bucket', ' '])('keeps unknown unit %j strictly rejected', (unit) => {
    expect(lookupFuelInputReason(tank(unit), 30, 'kg-m')).toEqual({
      code: 'UNSUPPORTED_UNIT',
      reason:
        'An explicit supported tank unit and fuel type are required; fallback density is not used.',
    })
  })

  it.each([[], ['Mystery'], ['AvGas 100LL', 'Mystery']])(
    'keeps unknown or missing fuel types %j strictly rejected',
    (...fuelTypes) => {
      const def = tank()
      def.fuelTank!.permissibleFuelTypes = fuelTypes
      expect(lookupFuelInputReason(def, 30, 'kg-m')?.code).toBe('UNSUPPORTED_UNIT')
    },
  )

  it('keeps invalid raw geometry rejected after explicit units', () => {
    const def = tank()
    def.armLookup[0]!.massOrVolume = -1
    expect(lookupFuelInputReason(def, 30, 'kg-m')?.code).toBe('INVALID_GEOMETRY')
  })

  it('leaves fixed-arm and non-fuel stations to their existing validation', () => {
    const fixed = tank('')
    fixed.arm = 2
    expect(lookupFuelInputReason(fixed, 30, 'kg-m')).toBeNull()
    const nonFuel = tank('')
    nonFuel.fuelTank = null
    expect(lookupFuelInputReason(nonFuel, 30, 'kg-m')).toBeNull()
  })
})
