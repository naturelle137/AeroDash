import { describe, expect, it } from 'vitest'
import { calculateFuelEndurance } from './fuel-endurance'
import {
  calculateTripArrival,
  calculateTripArrivalCg,
  calculateSequencedTripArrivalCg,
  calculateLookupTripArrivalCg,
} from './trip-arrival'

// Independent synthetic arithmetic, never operational aircraft reference values.
const input = { takeoffMassKg: 600, usableFuelKg: 40, tripFuelKg: 20 }
describe('estimated trip arrival mass', () => {
  it('retains reserve and separates arrival inventory from the budget margin (REQ-FE-005)', () => {
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
  it('blocks 241 minutes at 10 kg/h without clamping (REQ-FE-005)', () => {
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

// Synthetic nonlinear total-moment table (kg, kg·m): segment slopes 1, 2.5 and 4.5 m.
// Base W 560 kg / Z 1120 kg·m, tank q 50 kg with zero unusable fuel.
const knots = [
  { massOrVolume: 0, moment: 0 },
  { massOrVolume: 10, moment: 10 },
  { massOrVolume: 30, moment: 60 },
  { massOrVolume: 50, moment: 150 },
]
const lookupInput = {
  unusableFuelKg: 0,
  takeoffMassKg: 610,
  takeoffMomentKgM: 1270,
  usableFuelKg: 50,
  tripFuelKg: 0,
  lookup: knots,
}
describe('lookup arrival with unusable fuel', () => {
  it.each([[0, 1260, 600], [20, 1170, 580], [40, 1120, 560]])(
    'burns %s kg from the total tank moment', (tripFuelKg, moment, mass) => {
      expect(calculateLookupTripArrivalCg({ ...lookupInput, takeoffMassKg: 600,
        takeoffMomentKgM: 1260, usableFuelKg: 40, unusableFuelKg: 10, tripFuelKg,
      })).toEqual({ ok: true, arrivalMomentKgM: moment, arrivalCgM: moment / mass })
    },
  )
  it('rejects a burn below unusable fuel', () => {
    expect(calculateLookupTripArrivalCg({ ...lookupInput, usableFuelKg: 40,
      unusableFuelKg: 10, tripFuelKg: 41 })).toEqual({ ok: false, reason: 'TRIP_EXCEEDS_USABLE_FUEL' })
  })
})
describe('single lookup-tank arrival CG with zero unusable fuel', () => {
  it.each([
    [0, 1270, 610],
    [10, 1225, 600],
    [20, 1180, 590],
    [30, 1155, 580],
    [50, 1120, 560],
  ])('burn %s kg subtracts F(q) − F(q − b) for moment %s at mass %s', (burn, moment, mass) => {
    const result = calculateLookupTripArrivalCg({ ...lookupInput, tripFuelKg: burn })
    expect(result).toEqual({ ok: true, arrivalMomentKgM: moment, arrivalCgM: moment / mass })
  })
  it('crosses several breakpoints and never freezes the departure arm', () => {
    // Remaining 5 kg sits on the first segment: F(50) − F(5) = 150 − 5.
    const result = calculateLookupTripArrivalCg({ ...lookupInput, tripFuelKg: 45 })
    expect(result).toEqual({ ok: true, arrivalMomentKgM: 1125, arrivalCgM: 1125 / 565 })
    expect(1270 - 45 * (150 / 50)).not.toBe(1125)
  })
  it('returns departure exactly at zero burn and the zero-fuel base at full burn', () => {
    expect(calculateLookupTripArrivalCg(lookupInput)).toMatchObject({ arrivalMomentKgM: 1270 })
    expect(calculateLookupTripArrivalCg({ ...lookupInput, tripFuelKg: 50 })).toMatchObject({
      arrivalMomentKgM: 1120,
      arrivalCgM: 2,
    })
  })
  it('accepts signed and non-monotonic moments', () => {
    const signed = knots.map((k) => ({ ...k, moment: -k.moment }))
    expect(
      calculateLookupTripArrivalCg({
        ...lookupInput,
        takeoffMomentKgM: 970,
        tripFuelKg: 20,
        lookup: signed,
      }),
    ).toEqual({ ok: true, arrivalMomentKgM: 1060, arrivalCgM: 1060 / 590 })
    const wavy = [
      { massOrVolume: 0, moment: 0 },
      { massOrVolume: 20, moment: 40 },
      { massOrVolume: 50, moment: -20 },
    ]
    // F(50) = −20, F(30) = 20: burning 20 kg adds 40 kg·m.
    expect(
      calculateLookupTripArrivalCg({
        ...lookupInput,
        takeoffMomentKgM: 1100,
        tripFuelKg: 20,
        lookup: wavy,
      }),
    ).toEqual({ ok: true, arrivalMomentKgM: 1140, arrivalCgM: 1140 / 590 })
  })
  it('supports an empty current tank only for zero burn after validating geometry', () => {
    const empty = { ...lookupInput, takeoffMassKg: 560, takeoffMomentKgM: 1120, usableFuelKg: 0 }
    expect(calculateLookupTripArrivalCg(empty)).toEqual({
      ok: true,
      arrivalMomentKgM: 1120,
      arrivalCgM: 2,
    })
    expect(calculateLookupTripArrivalCg({ ...empty, tripFuelKg: 1 })).toEqual({
      ok: false,
      reason: 'TRIP_EXCEEDS_USABLE_FUEL',
    })
    expect(calculateLookupTripArrivalCg({ ...empty, lookup: [knots[0]] })).toEqual({
      ok: false,
      reason: 'INVALID_GEOMETRY',
    })
  })
  it.each([
    ['empty', []],
    ['singleton', [{ massOrVolume: 50, moment: 150 }]],
    ['duplicate', [knots[0], knots[2], { massOrVolume: 30, moment: 65 }, knots[3]]],
    ['unsorted', [knots[0], knots[3], knots[2]]],
    ['missing origin', knots.slice(1)],
    ['nonzero origin moment', [{ massOrVolume: 0, moment: 1 }, knots[3]]],
    ['negative axis', [{ massOrVolume: -1, moment: 0 }, knots[0], knots[3]]],
    ['axis above mass bound', [knots[0], { massOrVolume: 200_001, moment: 1 }]],
    ['moment above bound', [knots[0], { massOrVolume: 50, moment: 20_000_001 }]],
    ['moment below bound', [knots[0], { massOrVolume: 50, moment: -20_000_001 }]],
  ])('rejects %s geometry without sorting, clamping or inventing an origin', (_, lookup) => {
    expect(calculateLookupTripArrivalCg({ ...lookupInput, lookup })).toEqual({
      ok: false,
      reason: 'INVALID_GEOMETRY',
    })
  })
  it('rejects a load beyond the table instead of extrapolating', () => {
    expect(
      calculateLookupTripArrivalCg({
        ...lookupInput,
        takeoffMassKg: 611,
        usableFuelKg: 51,
        tripFuelKg: 20,
      }),
    ).toEqual({ ok: false, reason: 'LOOKUP_OUT_OF_RANGE' })
  })
  it.each([
    ['nonfinite knot', { lookup: [knots[0], { massOrVolume: 50, moment: Infinity }] }],
    ['NaN knot', { lookup: [knots[0], { massOrVolume: NaN, moment: 1 }] }],
    ['missing lookup', { lookup: undefined }],
    ['nonfinite moment', { takeoffMomentKgM: Infinity }],
    ['moment above bound', { takeoffMomentKgM: 20_000_001 }],
    ['mass above bound', { takeoffMassKg: 200_001 }],
    ['negative burn', { tripFuelKg: -1 }],
  ])('rejects %s input', (_, patch) => {
    expect(calculateLookupTripArrivalCg({ ...lookupInput, ...patch })).toEqual({
      ok: false,
      reason: 'INVALID_INPUT',
    })
  })
  it('rejects overdraw and inconsistent mass', () => {
    expect(calculateLookupTripArrivalCg({ ...lookupInput, tripFuelKg: 50.001 })).toEqual({
      ok: false,
      reason: 'TRIP_EXCEEDS_USABLE_FUEL',
    })
    expect(calculateLookupTripArrivalCg({ ...lookupInput, takeoffMassKg: 50 })).toEqual({
      ok: false,
      reason: 'INCONSISTENT_MASS',
    })
  })
  it('rejects results outside the existing SI moment and arm bounds', () => {
    const steep = [knots[0], { massOrVolume: 1, moment: -20_000_000 }]
    expect(
      calculateLookupTripArrivalCg({
        takeoffMassKg: 2,
        unusableFuelKg: 0,
        takeoffMomentKgM: 1,
        usableFuelKg: 1,
        tripFuelKg: 1,
        lookup: steep,
      }),
    ).toEqual({ ok: false, reason: 'NUMERIC_OVERFLOW' })
    expect(
      calculateLookupTripArrivalCg({
        takeoffMassKg: 2,
        unusableFuelKg: 0,
        takeoffMomentKgM: 201,
        usableFuelKg: 1,
        tripFuelKg: 1,
        lookup: [knots[0], { massOrVolume: 1, moment: 0 }],
      }),
    ).toEqual({ ok: false, reason: 'NUMERIC_OVERFLOW' })
  })
})

// Independent synthetic reference: lookup tank total moment F(0)=0, F(10)=10, F(30)=60.
describe('mixed fixed-arm and lookup sequence', () => {
  const lookup = [
    { massOrVolume: 0, moment: 0 },
    { massOrVolume: 10, moment: 10 },
    { massOrVolume: 30, moment: 60 },
  ]
  const entry = (sequenceName: string, ordinalPosition: number) => ({
    sequenceName,
    ordinalPosition,
  })
  const tanks = [
    { usableFuelKg: 30, lookup, burnSequences: [entry('L first', 1), entry('F first', 2)] },
    { usableFuelKg: 20, tankArmM: 1, burnSequences: [entry('L first', 2), entry('F first', 1)] },
  ]
  // 560 kg BEM at 2 m + F(30) + 20 kg at 1 m
  const base = { takeoffMassKg: 610, takeoffMomentKgM: 1200, sequenceName: 'L first', tanks }
  it.each([
    ['L first', 0, 1200, 610],
    ['L first', 10, 1175, 600],
    ['L first', 30, 1140, 580],
    ['L first', 40, 1130, 570],
    ['F first', 10, 1190, 600],
    ['F first', 40, 1130, 570],
    ['F first', 50, 1120, 560],
  ])('%s burning %s kg', (sequenceName, tripFuelKg, moment, mass) => {
    const r = calculateSequencedTripArrivalCg({ ...base, sequenceName, tripFuelKg })
    expect(r).toEqual({ ok: true, arrivalMomentKgM: moment, arrivalCgM: moment / mass })
  })
  it('rejects ambiguous, malformed and uncovered geometry without clamping', () => {
    const t = (patch: object) => [{ ...tanks[0]!, ...patch }, tanks[1]!]
    const run = (list: unknown, tripFuelKg = 20) =>
      calculateSequencedTripArrivalCg({ ...base, tripFuelKg, tanks: list })
    expect(run(t({ tankArmM: 1 }))).toEqual({ ok: false, reason: 'INVALID_GEOMETRY' })
    expect(run([tanks[0], { ...tanks[1], tankArmM: undefined }])).toEqual({
      ok: false,
      reason: 'INVALID_GEOMETRY',
    })
    for (const bad of [
      [lookup[2], lookup[0]],
      lookup.slice(1),
      [lookup[0], lookup[0], lookup[2]],
      [{ massOrVolume: 0, moment: 1 }, lookup[2]],
    ])
      expect(run(t({ lookup: bad }))).toEqual({ ok: false, reason: 'INVALID_GEOMETRY' })
    expect(run(t({ lookup: lookup.slice(0, 2) }))).toEqual({
      ok: false,
      reason: 'LOOKUP_OUT_OF_RANGE',
    })
    expect(run(tanks, 51)).toEqual({ ok: false, reason: 'TRIP_EXCEEDS_USABLE_FUEL' })
  })
})

describe('sequenced arrival with a lookup tank holding unusable fuel', () => {
  const lookup = [
    { massOrVolume: 0, moment: 0 },
    { massOrVolume: 10, moment: 10 },
    { massOrVolume: 30, moment: 60 },
  ]
  const entry = (sequenceName: string, ordinalPosition: number) => ({ sequenceName, ordinalPosition })
  // Lookup tank: 10 kg unusable + 20 kg usable = F(30) = 60. Fixed tank: 20 kg at 1 m.
  const tanks = [
    { usableFuelKg: 20, unusableFuelKg: 10, lookup, burnSequences: [entry('L', 1), entry('F', 2)] },
    { usableFuelKg: 20, tankArmM: 1, burnSequences: [entry('L', 2), entry('F', 1)] },
  ]
  const base = { takeoffMassKg: 610, takeoffMomentKgM: 1200, sequenceName: 'L', tanks }
  it.each([
    ['L', 0, 1200, 610],
    ['L', 10, 1175, 600],
    ['L', 20, 1150, 590],
    ['L', 30, 1140, 580],
    ['L', 40, 1130, 570],
    ['F', 10, 1190, 600],
    ['F', 20, 1180, 590],
    ['F', 30, 1155, 580],
    ['F', 40, 1130, 570],
  ])('%s burning %s kg keeps unusable fuel aboard', (sequenceName, tripFuelKg, moment, mass) => {
    expect(calculateSequencedTripArrivalCg({ ...base, sequenceName, tripFuelKg })).toEqual({
      ok: true,
      arrivalMomentKgM: moment,
      arrivalCgM: moment / mass,
    })
  })
  it('rejects burn beyond usable fuel, uncovered load and invalid unusable quantity', () => {
    const run = (list: unknown, tripFuelKg = 20) =>
      calculateSequencedTripArrivalCg({ ...base, tripFuelKg, tanks: list })
    expect(run(tanks, 41)).toEqual({ ok: false, reason: 'TRIP_EXCEEDS_USABLE_FUEL' })
    expect(run([{ ...tanks[0]!, lookup: lookup.slice(0, 2) }, tanks[1]])).toEqual({
      ok: false,
      reason: 'LOOKUP_OUT_OF_RANGE',
    })
    for (const bad of [-1, Number.NaN, Infinity])
      expect(run([{ ...tanks[0]!, unusableFuelKg: bad }, tanks[1]])).toEqual({
        ok: false,
        reason: 'INVALID_INPUT',
      })
  })
})
