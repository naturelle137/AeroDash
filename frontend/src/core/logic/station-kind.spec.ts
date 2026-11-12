import { describe, it, expect } from 'vitest'
import { requiresOccupancy, resolveStationKind } from './station-kind'

const tank = { unusableFuel: 0, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] }

describe('resolveStationKind', () => {
  it('returns the explicit occupant or baggage kind of a non-fuel station', () => {
    expect(resolveStationKind({ kind: 'occupant', fuelTank: null })).toBe('occupant')
    expect(resolveStationKind({ kind: 'baggage', fuelTank: null })).toBe('baggage')
  })

  it('treats an unclassified non-fuel station as an occupant', () => {
    expect(resolveStationKind({ fuelTank: null })).toBe('occupant')
  })

  it('classifies any station with a fuel tank as fuel', () => {
    expect(resolveStationKind({ fuelTank: tank })).toBe('fuel')
    expect(resolveStationKind({ kind: 'baggage', fuelTank: tank })).toBe('fuel')
  })

  it('falls back to occupant when kind says fuel but no tank exists', () => {
    expect(resolveStationKind({ kind: 'fuel', fuelTank: null })).toBe('occupant')
  })
})

describe('requiresOccupancy', () => {
  it('keeps legacy occupants required regardless of station label', () => {
    expect(requiresOccupancy({ fuelTank: null })).toBe(true)
    expect(requiresOccupancy({ kind: 'occupant', fuelTank: null, occupancy: 'required' })).toBe(true)
  })
  it('exempts only explicitly optional occupants, baggage and fuel', () => {
    expect(requiresOccupancy({ kind: 'occupant', fuelTank: null, occupancy: 'optional' })).toBe(false)
    expect(requiresOccupancy({ kind: 'baggage', fuelTank: null })).toBe(false)
    expect(requiresOccupancy({ fuelTank: tank })).toBe(false)
  })
})
