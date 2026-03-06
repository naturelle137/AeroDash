import { describe, it, expect } from 'vitest'
import { calculateMassBalance } from './mass-balance.adapter'
import type { MathCoreInput, EnvelopePoint } from '@/modules/mass-balance/stores/mass-balance.types'

const defaultEnvelope: EnvelopePoint[] = [
  { armOrMoment: 1.841, mass: 433 },
  { armOrMoment: 1.978, mass: 433 },
  { armOrMoment: 1.978, mass: 650 },
  { armOrMoment: 1.841, mass: 650 },
]

const createBaseInput = (): MathCoreInput => ({
  stations: [],
  basicEmptyMass: 433,
  emptyCenterOfGravity: 1.877,
  maxTakeoffMass: 650,
  maxZeroFuelMass: null,
  envelope: defaultEnvelope,
  graphType: 'arm',
  fuelStations: [],
})

describe('Mass & Balance Math-Core Adapter', () => {
  // @UT-MB-CORE-001@ (FROM: @IMP-MB-CORE-002@, @IMP-MB-CORE-005@)
  it('calculates BEM only state correctly', () => {
    const input = createBaseInput()
    const result = calculateMassBalance(input)

    expect(result.takeoffMass).toBe(433)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.877, 3)
    expect(result.violations).toHaveLength(0)
  })

  // @UT-MB-CORE-002@ (FROM: @IMP-MB-CORE-002@, @IMP-MB-CORE-005@)
  it('calculates ZFM and TOM correctly with payload and fuel', () => {
    const input: MathCoreInput = {
      ...createBaseInput(),
      stations: [
        { index: 0, mass: 170, arm: 1.8, armLookup: null }, // Seats
        { index: 1, mass: 10, arm: 2.417, armLookup: null }, // Baggage
        { index: 2, mass: 30, arm: 2.209, armLookup: null }, // Fuel
      ],
      fuelStations: [
        {
          index: 2,
          mass: 30,
          arm: 2.209,
          armLookup: null,
          unusableFuel: 3, // 3kg unusable
          burnSequences: [],
        },
      ],
    }

    const result = calculateMassBalance(input)

    // ZFM = 433 + 170 + 10 = 613
    // ZF Moment = 433*1.877 + 170*1.8 + 10*2.417 = 812.741 + 306 + 24.17 = 1142.911
    // ZF CG = 1142.911 / 613 = 1.8644...
    expect(result.zeroFuelMass).toBe(613)

    // TOM = 613 + 30 = 643
    // Takeoff Moment = 1142.911 + 30 * 2.209 = 1142.911 + 66.27 = 1209.181
    // Takeoff CG = 1209.181 / 643 = 1.8805...
    expect(result.takeoffMass).toBe(643)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.8805, 4)

    // LM = 613 + 3(unusable) = 616
    // Landing Moment = 1142.911 + 3 * 2.209 = 1142.911 + 6.627 = 1149.538
    // Landing CG = 1149.538 / 616 = 1.8661...
    expect(result.landingMass).toBe(616)
    expect(result.landingCenterOfGravity.mass).toBe(616)
    expect(result.landingCenterOfGravity.arm).toBeCloseTo(1.8661, 4)
  })

  // @UT-MB-CORE-003@ (FROM: @IMP-MB-CORE-003@)
  it('triggers MTOM_EXCEEDED on MTOM exceedance', () => {
    const input = createBaseInput()
    input.maxTakeoffMass = 650
    input.stations = [{ index: 0, mass: 250, arm: 1.8, armLookup: null }]
    // TOM = 433 + 250 = 683 (> 650)

    const result = calculateMassBalance(input)
    expect(result.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(true)
  })

  // @UT-MB-CORE-004@ (FROM: @IMP-MB-001@)
  it('triggers MZFM_EXCEEDED on MZFM exceedance', () => {
    const input = createBaseInput()
    input.maxZeroFuelMass = 600
    input.stations = [{ index: 0, mass: 200, arm: 1.8, armLookup: null }]
    // ZFM = 433 + 200 = 633 (> 600)

    const result = calculateMassBalance(input)
    expect(result.violations.some((v) => v.type === 'MZFM_EXCEEDED')).toBe(true)
  })

  // @UT-MB-CORE-005@ (FROM: @IMP-MB-009@, @IMP-MB-CORE-011@ )
  it('triggers CG_OUT_OF_ENVELOPE when CG is out of envelope', () => {
    const input = createBaseInput()
    // Move CG forward out of envelope (Envelope min arm is 1.841)
    // We need a light mass and very forward arm.
    // BEM 433, CG 1.877
    input.stations = [{ index: 0, mass: 50, arm: 1.0, armLookup: null }]

    // Moment = 433*1.877 + 50*1.0 = 812.741 + 50 = 862.741
    // Total Mass = 483
    // CG = 862.741 / 483 = 1.786... (< 1.841)

    const result = calculateMassBalance(input)
    expect(result.violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')).toBe(true)
  })

  // @UT-MB-CORE-006@ (FROM: @IMP-MB-CORE-010@, @IMP-MB-CORE-011@ )
  it('triggers CG_MIGRATION_EXCEEDED when migration ends out of envelope', () => {
    const input = createBaseInput()
    // Start at safe takeoff (BEM 433, CG 1.877)
    // Add forward fuel that keeps us in for takeoff, but burning it moves us too far forward?
    // Wait, burning fuel usually moves it FORWARD or AFT.
    // In Tecnam P2008, fuel is at 2.209 (AFT). Burning it moves CG FORWARD.
    // So if we have very little fuel and are near the forward limit, burning it might exit forward.

    // Reverse scenario: Takeoff is AFT safe, burning fuel makes it stay safe?
    // Let's force a scenario:
    // Tapeoff: Mass 640, Arm 1.95 (Safe range [1.841, 1.978])
    // Landing: Mass 600, Arm 1.99 (Out AFT)

    input.stations = []
    input.basicEmptyMass = 600
    input.emptyCenterOfGravity = 1.99 // Out AFT
    input.fuelStations = [
      {
        index: 0,
        mass: 40,
        arm: 1.35, // Far forward
        armLookup: null,
        unusableFuel: 0,
        burnSequences: [],
      },
    ]

    // Takeoff: Mass 640, Moment = 600*1.99 + 40*1.35 = 1194 + 54 = 1248
    // Takeoff CG = 1248 / 640 = 1.95 (Safe: 1.841 < 1.95 < 1.978)

    // Landing: Mass 600, Moment = 1194
    // Landing CG = 1.99 (Out AFT: > 1.978)

    const result = calculateMassBalance(input)
    expect(result.violations.some((v) => v.type === 'CG_MIGRATION_EXCEEDED')).toBe(true)
  })

  // @UT-MB-CORE-007@ (FROM: @IMP-MB-CORE-012@)
  it('interpolates arm correctly from lookup table', () => {
    const input = createBaseInput()
    input.stations = [
      {
        index: 0,
        mass: 50,
        arm: null,
        armLookup: [
          { massOrVolume: 0, moment: 0 },
          { massOrVolume: 100, moment: 200 }, // Arm = 2.0
        ],
      },
    ]

    const result = calculateMassBalance(input)
    // Mass 50 is halfway. Moment = 100. Arm = 100 / 50 = 2.0
    // Total Mass = 433 + 50 = 483
    // Total Moment = 433*1.877 + 50*2.0 = 812.741 + 100 = 912.741
    // CG = 912.741 / 483 = 1.8897...
    expect(result.takeoffMass).toBe(483)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.8897, 4)
  })

  // @UT-MB-CORE-008@ (FROM: @IMP-MB-CORE-012@)
  it('look up arm for empty mass correctly from lookup table', () => {
    const input: MathCoreInput = {
      ...createBaseInput(),
      stations: [
        { index: 0, mass: 170, arm: 1.8, armLookup: null }, // Seats
        { index: 1, mass: 10, arm: 2.417, armLookup: null }, // Baggage
        { index: 2, mass: 0, arm: null, armLookup: null }, // Fuel
      ],
      fuelStations: [
        {
          index: 2,
          mass: 0,
          arm: null,
          armLookup: [
            { massOrVolume: 0, moment: 0 },
            { massOrVolume: 100, moment: 200 },
          ],
          unusableFuel: 3, // 3kg unusable
          burnSequences: [],
        },
      ],
    }

    const result = calculateMassBalance(input)
    // Total Mass = 433 + 170 + 10 = 613
    // Total Moment = 433*1.877 + 170*1.8 + 10*2.417 = 812.741 + 306 + 24.17 = 1142.911
    // CG = 1142.911 / 613 = 1.86445...
    expect(result.takeoffMass).toBe(613)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.86445, 4)
  })

  // @UT-MB-CORE-009@ (FROM: @IMP-MB-CORE-012@)
  it('returns INVALID_INPUT when mass is NaN', () => {
    const input: MathCoreInput = {
      ...createBaseInput(),
      stations: [
        {
          index: 0,
          mass: NaN,
          arm: null,
          armLookup: [
            { massOrVolume: 0, moment: 0 },
            { massOrVolume: 100, moment: 200 },
          ],
        },
      ],
    }

    const result = calculateMassBalance(input)
    expect(result.violations.some((v) => v.type === 'INVALID_INPUT')).toBe(true)
  })
})
describe('M&B numeric input violations', () => {
  const requiredInputFields = [
    ['basicEmptyMass', 'BEM'],
    ['emptyCenterOfGravity', 'EMPTY_CG'],
    ['maxTakeoffMass', 'MTOM'],
  ] as const

  const requiredInputTypeNumber = [
    ['basicEmptyMass', 'BEM'],
    ['emptyCenterOfGravity', 'EMPTY_CG'],
    ['maxTakeoffMass', 'MTOM'],
    ['maxZeroFuelMass', 'MZFM'],
  ] as const

  const requiredArrayFields = [
    [
      'station index',
      (input: MathCoreInput) => {
        type StationType = Partial<MathCoreInput['stations'][number]>
        delete (input.stations[0] as StationType).index
      },
      'STATIONS[0].INDEX',
    ],
    [
      'station mass (non-fuel)',
      (input: MathCoreInput) => {
        type StationType = Partial<MathCoreInput['stations'][number]>
        delete (input.stations[0] as StationType).mass
      },
      'STATIONS[0].MASS',
    ],
    [
      'station arm (when armLookup is null)',
      (input: MathCoreInput) => {
        type StationType = Partial<MathCoreInput['stations'][number]>
        delete (input.stations[0] as StationType).arm
      },
      'STATIONS[0].ARM',
    ],
    [
      'fuel station index',
      (input: MathCoreInput) => {
        type StationType = Partial<MathCoreInput['fuelStations'][number]>
        delete (input.fuelStations[0] as StationType).index
      },
      'FUEL_STATIONS[0].INDEX',
    ],
    [
      'fuel station unusable fuel',
      (input: MathCoreInput) => {
        type StationType = Partial<MathCoreInput['fuelStations'][number]>
        delete (input.fuelStations[0] as StationType).unusableFuel
      },
      'FUEL_STATIONS[0].UNUSABLE_FUEL',
    ],
  ] as const

  it.each(requiredInputFields)(
    'pushes a field error for missing %s input',
    (field, expectedPath) => {
      const input = createBaseInput() as Partial<MathCoreInput>

      delete input[field]

      const result = calculateMassBalance(input as unknown as MathCoreInput)

      expect(
        result.violations.some(
          (v) => v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'REQUIRED',
        ),
      ).toBe(true)
    },
  )

  it.each(requiredArrayFields)(
    'pushes a field error for arrays with missing %s input',
    (description, mutateInput, expectedPath) => {
      const input: MathCoreInput = {
        ...createBaseInput(),
        stations: [
          { index: 0, mass: 170, arm: 1.8, armLookup: null }, // Seats
          {
            index: 1,
            mass: 10,
            arm: null,
            armLookup: [
              { massOrVolume: 0, moment: 0 },
              { massOrVolume: 100, moment: 200 },
            ],
          }, // Baggage
          { index: 2, mass: 0, arm: null, armLookup: null }, // Fuel
        ],
        fuelStations: [
          {
            index: 2,
            mass: 0,
            arm: null,
            armLookup: [
              { massOrVolume: 0, moment: 0 },
              { massOrVolume: 100, moment: 200 },
            ],
            unusableFuel: 3, // 3kg unusable
            burnSequences: [],
          },
        ],
      }

      input.stations![0]!.armLookup = null
      input.fuelStations = input.fuelStations.filter((fs) => fs.index !== input.stations![0]!.index)

      mutateInput(input)

      const result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) => v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'REQUIRED',
        ),
      ).toBe(true)
    },
  )

  it.each(requiredInputTypeNumber)(
    'pushes a field error if %s input is no number or NaN',
    (field, expectedPath) => {
      let input = createBaseInput() as unknown as Record<string, unknown>

      input[field as string] = NaN
      let result = calculateMassBalance(input as unknown as MathCoreInput)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NOT_A_NUMBER',
        ),
      ).toBe(true)

      // cleanup violations for testing string next
      input = createBaseInput() as unknown as Record<string, unknown>
      result = calculateMassBalance(input as unknown as MathCoreInput)
      expect(result.violations).toHaveLength(0)

      input[field as string] = 'string'
      result = calculateMassBalance(input as unknown as MathCoreInput)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NOT_A_NUMBER',
        ),
      ).toBe(true)
    },
  )

  it('pushes a field error for infinite input values', () => {
    const input = createBaseInput()
    input.basicEmptyMass = Infinity
    const result = calculateMassBalance(input)

    expect(
      result.violations.some(
        (v) => v.type === 'INVALID_INPUT' && v.field === 'BEM' && v.code === 'LIMIT_REACHED',
      ),
    ).toBe(true)
  })

  it('pushes a field error for negative values when only positives are allowed', () => {
    const input = createBaseInput()
    input.maxTakeoffMass = -100
    const result = calculateMassBalance(input)

    expect(
      result.violations.some(
        (v) => v.type === 'INVALID_INPUT' && v.field === 'MTOM' && v.code === 'NEGATIVE_VALUE',
      ),
    ).toBe(true)
  })
})
// ;(describe('M&B input validation'),
//   () => {
//     it('', () => {})
//   })

// const missingRequiredInput = (): MathCoreInput => ({
//   stations: [],
//   basicEmptyMass: 433,
//   emptyCenterOfGravity: 1.877,
//   maxTakeoffMass: 650,
//   maxZeroFuelMass: null,
//   envelope: defaultEnvelope,
//   graphType: 'arm',
//   fuelStations: [],
//})
