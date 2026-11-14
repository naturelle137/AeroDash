import { describe, expect, it } from 'vitest'
import { calculateFuelEndurance } from './fuel-endurance'
import {
  calculateTripArrival,
  calculateTripArrivalCg,
  calculateSequencedTripArrivalCg,
} from './trip-arrival'

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

// Two synthetic tanks; BEM and unusable fuel are already included in takeoff mass/moment.
describe('explicit multi-tank arrival endpoint', () => {
  const tanks = [1, 3].map((tankArmM, index) => ({
    usableFuelKg: 20,
    tankArmM,
    burnSequences: [
      { sequenceName: 'A first', ordinalPosition: index + 1 },
      { sequenceName: 'B first', ordinalPosition: 2 - index },
    ],
  }))
  const base = {
    takeoffMassKg: 600,
    takeoffMomentKgM: 1160,
    tripFuelKg: 30,
    sequenceName: 'A first',
    tanks,
  }
  it.each([
    ['A first', 0, 1160, 600],
    ['B first', 0, 1160, 600],
    ['A first', 20, 1140, 580],
    ['B first', 20, 1100, 580],
    ['A first', 30, 1110, 570],
    ['B first', 30, 1090, 570],
    ['A first', 40, 1080, 560],
    ['B first', 40, 1080, 560],
  ])('%s burn %s kg', (sequenceName, tripFuelKg, moment, mass) => {
    expect(calculateSequencedTripArrivalCg({ ...base, sequenceName, tripFuelKg })).toEqual({
      ok: true,
      arrivalMomentKgM: moment,
      arrivalCgM: moment / mass,
    })
  })
  it('skips empty tanks only during burn, without dropping their sequence obligation', () => {
    const empty = structuredClone(tanks)
    empty[0]!.usableFuelKg = 0
    expect(calculateSequencedTripArrivalCg({ ...base, tanks: empty, tripFuelKg: 10 })).toEqual({
      ok: true,
      arrivalMomentKgM: 1130,
      arrivalCgM: 1130 / 590,
    })
    empty[0]!.burnSequences = []
    expect(calculateSequencedTripArrivalCg({ ...base, tanks: empty, tripFuelKg: 0 }).ok).toBe(false)
  })
  it.each([0, -1, 1.5, NaN, Infinity, 2])(
    'rejects invalid or duplicate position %s',
    (ordinalPosition) => {
      const invalid = structuredClone(tanks)
      invalid[0]!.burnSequences[0]!.ordinalPosition = ordinalPosition
      expect(calculateSequencedTripArrivalCg({ ...base, tanks: invalid })).toEqual({
        ok: false,
        reason: 'INVALID_INPUT',
      })
    },
  )
  it('rejects absent, unknown, incomplete and duplicate entries', () => {
    for (const sequenceName of ['', 'unknown', ' A first '])
      expect(calculateSequencedTripArrivalCg({ ...base, sequenceName }).ok).toBe(false)
    for (const entries of [[], [tanks[0]!.burnSequences[0]!, tanks[0]!.burnSequences[0]!]]) {
      const invalid = structuredClone(tanks)
      invalid[0]!.burnSequences = entries
      expect(calculateSequencedTripArrivalCg({ ...base, tanks: invalid }).ok).toBe(false)
    }
    for (const invalid of [null, {}, { ...base, tanks: [] }, { ...base, tanks: [tanks[0]] }])
      expect(calculateSequencedTripArrivalCg(invalid).ok).toBe(false)
  })
  it('rejects overdraw, inconsistent totals, malformed input and overflow', () => {
    expect(calculateSequencedTripArrivalCg({ ...base, tripFuelKg: 41 })).toEqual({
      ok: false,
      reason: 'TRIP_EXCEEDS_USABLE_FUEL',
    })
    expect(calculateSequencedTripArrivalCg({ ...base, takeoffMassKg: 40 })).toEqual({
      ok: false,
      reason: 'INCONSISTENT_MASS',
    })
    for (const field of ['takeoffMassKg', 'takeoffMomentKgM', 'tripFuelKg'])
      for (const value of [undefined, NaN, Infinity, '30'])
        expect(calculateSequencedTripArrivalCg({ ...base, [field]: value }).ok).toBe(false)
    for (const field of ['usableFuelKg', 'tankArmM']) {
      for (const value of [NaN, Infinity]) {
        const invalid = tanks.map((tank) => ({ ...tank, [field]: value }))
        expect(calculateSequencedTripArrivalCg({ ...base, tanks: invalid }).ok).toBe(false)
      }
    }
    expect(
      calculateSequencedTripArrivalCg({
        ...base,
        tanks: tanks.map((tank) => ({ ...tank, tankArmM: Number.MAX_VALUE })),
      }),
    ).toEqual({ ok: false, reason: 'NUMERIC_OVERFLOW' })
    expect(
      calculateSequencedTripArrivalCg({
        ...base,
        takeoffMassKg: 0.5,
        tripFuelKg: 0,
        takeoffMomentKgM: Number.MAX_VALUE,
        tanks: tanks.map((tank) => ({ ...tank, usableFuelKg: 0 })),
      }),
    ).toEqual({ ok: false, reason: 'NUMERIC_OVERFLOW' })
  })
})
