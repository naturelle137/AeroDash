import { describe, expect, it } from 'vitest'
import { calculateFuelEndurance } from './fuel-endurance'
import { calculateTripArrival } from './trip-arrival'

// Independent synthetic arithmetic, never operational aircraft reference values.
const input = { takeoffMassKg: 600, usableFuelKg: 40, tripFuelKg: 20 }
describe('estimated trip arrival mass', () => {
  it('retains reserve and separates arrival inventory from the budget margin', () => {
    const result = calculateFuelEndurance({
      usableFuelKg: 40,
      consumptionKgPerHour: 10,
      tripMinutes: 120,
      reserveMinutes: 30,
    })
    expect(result).toMatchObject({
      ok: true,
      plan: { tripFuelKg: 20, reserveFuelKg: 5, marginKg: 15 },
    })
    expect(calculateTripArrival(input)).toEqual({
      ok: true,
      takeoffMassKg: 600,
      tripFuelKg: 20,
      arrivalMassKg: 580,
      remainingFuelKg: 20,
    })
  })
  it.each([
    [0, 600, 40],
    [40, 560, 0],
  ])('handles trip burn %s', (tripFuelKg, arrivalMassKg, remainingFuelKg) => {
    expect(calculateTripArrival({ ...input, tripFuelKg })).toEqual({
      ok: true,
      takeoffMassKg: 600,
      tripFuelKg,
      arrivalMassKg,
      remainingFuelKg,
    })
  })
  it('blocks 241 minutes at 10 kg/h without clamping', () => {
    expect(calculateTripArrival({ ...input, tripFuelKg: (241 / 60) * 10 })).toEqual({
      ok: false,
      reason: 'TRIP_EXCEEDS_USABLE_FUEL',
    })
  })
  for (const field of Object.keys(input)) {
    it.each([undefined, '', NaN, Infinity, -Infinity, -1])(
      `rejects invalid ${field}: %s`,
      (value) => {
        expect(calculateTripArrival({ ...input, [field]: value })).toEqual({
          ok: false,
          reason: 'INVALID_INPUT',
        })
      },
    )
  }
  it('rejects zero takeoff mass and inconsistent inventories', () => {
    expect(calculateTripArrival({ ...input, takeoffMassKg: 0 })).toEqual({
      ok: false,
      reason: 'INVALID_INPUT',
    })
    for (const usableFuelKg of [600, 601]) {
      expect(calculateTripArrival({ ...input, usableFuelKg })).toEqual({
        ok: false,
        reason: 'INCONSISTENT_MASS',
      })
    }
  })
  it('permits explicit zero usable fuel with no trip burn', () => {
    expect(calculateTripArrival({ ...input, usableFuelKg: 0, tripFuelKg: 0 })).toMatchObject({
      ok: true,
      arrivalMassKg: 600,
      remainingFuelKg: 0,
    })
  })
})
