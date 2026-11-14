import { describe, expect, it } from 'vitest'
import { calculateFuelEndurance } from './fuel-endurance'
import { calculateTripArrival, calculateTripArrivalCg } from './trip-arrival'

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

// BEM560 kg at2 m includes unusable fuel. Usable40 kg at1 m gives600 kg/1160 kg·m.
describe('single fixed-arm estimated trip arrival CG', () => {
  const cgInput = { ...input, takeoffMomentKgM: 1160, tankArmM: 1 }
  it.each([
    [0, 1160, 1160 / 600],
    [20, 1140, 1140 / 580],
    [40, 1120, 2],
  ])('subtracts only burned moment for %s kg', (tripFuelKg, arrivalMomentKgM, arrivalCgM) => {
    expect(calculateTripArrivalCg({ ...cgInput, tripFuelKg })).toEqual({
      ok: true,
      arrivalMomentKgM,
      arrivalCgM,
    })
  })
  it('moves forward when fuel is aft of takeoff CG', () => {
    expect(calculateTripArrivalCg({ ...cgInput, takeoffMomentKgM: 1240, tankArmM: 3 })).toEqual({
      ok: true,
      arrivalMomentKgM: 1180,
      arrivalCgM: 1180 / 580,
    })
  })
  it('accepts zero and negative datum-relative geometry', () => {
    expect(calculateTripArrivalCg({ ...cgInput, takeoffMomentKgM: 0, tankArmM: 0 })).toEqual({
      ok: true,
      arrivalMomentKgM: 0,
      arrivalCgM: 0,
    })
    expect(calculateTripArrivalCg({ ...cgInput, takeoffMomentKgM: -1160, tankArmM: -1 })).toEqual({
      ok: true,
      arrivalMomentKgM: -1140,
      arrivalCgM: -1140 / 580,
    })
  })
  for (const field of Object.keys(cgInput)) {
    it.each([undefined, null, '', NaN, Infinity, -Infinity])(
      `rejects malformed ${field} %s`,
      (value) => {
        expect(calculateTripArrivalCg({ ...cgInput, [field]: value })).toEqual({
          ok: false,
          reason: 'INVALID_INPUT',
        })
      },
    )
  }
  it('rejects impossible inventories and burns', () => {
    expect(calculateTripArrivalCg({ ...cgInput, usableFuelKg: 600 })).toEqual({
      ok: false,
      reason: 'INCONSISTENT_MASS',
    })
    expect(calculateTripArrivalCg({ ...cgInput, tripFuelKg: 41 })).toEqual({
      ok: false,
      reason: 'TRIP_EXCEEDS_USABLE_FUEL',
    })
  })
  it('rejects overflow instead of returning nonfinite geometry', () => {
    expect(calculateTripArrivalCg({ ...cgInput, tankArmM: Number.MAX_VALUE })).toEqual({
      ok: false,
      reason: 'NUMERIC_OVERFLOW',
    })
    expect(
      calculateTripArrivalCg({
        takeoffMassKg: 0.5,
        usableFuelKg: 0,
        tripFuelKg: 0,
        takeoffMomentKgM: Number.MAX_VALUE,
        tankArmM: 0,
      }),
    ).toEqual({ ok: false, reason: 'NUMERIC_OVERFLOW' })
  })
})
