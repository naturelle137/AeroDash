import { describe, it, expect } from 'vitest'
import { resolveStationKind } from './station-kind'

const tank = { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] }

describe('resolveStationKind', () => {
  // @UT-AD-CORE-068@ (FROM: @IMP-AD-CORE-024@)
  it('returns the explicit occupant or baggage kind of a non-fuel station', () => {
    expect(resolveStationKind({ kind: 'occupant', fuelTank: null })).toBe('occupant')
    expect(resolveStationKind({ kind: 'baggage', fuelTank: null })).toBe('baggage')
  })

  // @UT-AD-CORE-069@ (FROM: @IMP-AD-CORE-024@)
  it('treats an unclassified non-fuel station as an occupant', () => {
    expect(resolveStationKind({ fuelTank: null })).toBe('occupant')
  })

  // @UT-AD-CORE-070@ (FROM: @IMP-AD-CORE-024@)
  it('classifies any station with a fuel tank as fuel', () => {
    expect(resolveStationKind({ fuelTank: tank })).toBe('fuel')
    expect(resolveStationKind({ kind: 'baggage', fuelTank: tank })).toBe('fuel')
  })

  // @UT-AD-CORE-071@ (FROM: @IMP-AD-CORE-024@)
  it('falls back to occupant when kind says fuel but no tank exists', () => {
    expect(resolveStationKind({ kind: 'fuel', fuelTank: null })).toBe('occupant')
  })
})
