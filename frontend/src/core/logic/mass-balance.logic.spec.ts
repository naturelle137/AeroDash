import { describe, it, expect } from 'vitest'
import { computeMassBalanceCore } from './mass-balance.logic'
import { createMathCoreInput } from './__fixtures__/mass-balance.fixtures'

const CG_PRECISION = 4

const cgScenarios: MassBalanceScenario[] = [
  {
    name: 'empty aircraft',
    payload: [0, 0],
    fuel: [0],
    unusableFuel: [3],

    expectedZeroFuelMass: 433,
    expectedZeroFuelMoment: 433 * 1.877,
    expectedZeroFuelCenterOfGravity: 1.877,

    expectedTakeoffMass: 433,
    expectedTakeoffMoment: 433 * 1.877,
    expectedTakeoffCenterOfGravity: 1.877,

    expectedLandingMass: 433,
    expectedLandingMoment: 433 * 1.877,
    expectedLandingCenterOfGravity: 1.877,
  },
  {
    name: 'forward aircraft loading',
    payload: [180, 0],
    fuel: [0],
    unusableFuel: [3],

    expectedZeroFuelMass: 433 + 180,
    expectedZeroFuelMoment: 433 * 1.877 + 180 * 1.8,
    expectedZeroFuelCenterOfGravity: (433 * 1.877 + 180 * 1.8) / (433 + 180),

    expectedTakeoffMass: 433 + 180,
    expectedTakeoffMoment: 433 * 1.877 + 180 * 1.8,
    expectedTakeoffCenterOfGravity: (433 * 1.877 + 180 * 1.8) / (433 + 180),

    expectedLandingMass: 433 + 180,
    expectedLandingMoment: 433 * 1.877 + 180 * 1.8,
    expectedLandingCenterOfGravity: (433 * 1.877 + 180 * 1.8) / (433 + 180),
  },
  {
    name: 'aft aircraft loading',
    payload: [0, 180],
    fuel: [0],
    unusableFuel: [3],

    expectedZeroFuelMass: 433 + 180,
    expectedZeroFuelMoment: 433 * 1.877 + 180 * 2.417,
    expectedZeroFuelCenterOfGravity: (433 * 1.877 + 180 * 2.417) / (433 + 180),

    expectedTakeoffMass: 433 + 180,
    expectedTakeoffMoment: 433 * 1.877 + 180 * 2.417,
    expectedTakeoffCenterOfGravity: (433 * 1.877 + 180 * 2.417) / (433 + 180),

    expectedLandingMass: 433 + 180,
    expectedLandingMoment: 433 * 1.877 + 180 * 2.417,
    expectedLandingCenterOfGravity: (433 * 1.877 + 180 * 2.417) / (433 + 180),
  },
  {
    name: 'typical flight',
    payload: [85, 10],
    fuel: [60],
    unusableFuel: [3],

    expectedZeroFuelMass: 433 + 85 + 10,
    expectedZeroFuelMoment: 433 * 1.877 + 85 * 1.8 + 10 * 2.417,
    expectedZeroFuelCenterOfGravity: (433 * 1.877 + 85 * 1.8 + 10 * 2.417) / (433 + 85 + 10),

    expectedTakeoffMass: 433 + 85 + 10 + 60 - 3,
    expectedTakeoffMoment: 433 * 1.877 + 85 * 1.8 + 10 * 2.417 + (60 - 3) * 2.209,
    expectedTakeoffCenterOfGravity:
      (433 * 1.877 + 85 * 1.8 + 10 * 2.417 + (60 - 3) * 2.209) / (433 + 85 + 10 + 60 - 3),

    expectedLandingMass: 433 + 85 + 10,
    expectedLandingMoment: 433 * 1.877 + 85 * 1.8 + 10 * 2.417,
    expectedLandingCenterOfGravity: (433 * 1.877 + 85 * 1.8 + 10 * 2.417) / (433 + 85 + 10),
  },
]

const limitViolationScenarios: LimitViolationScenario[] = [
  // @UT-MB-CORE-003@ (FROM: @IMP-MB-CORE-003@)
  {
    name: 'TOM exceeds MTOM limit',
    payload: [250, 0],
    fuel: [0],
    unusableFuel: [3],
    expectedMtomViolation: true,
    expectedViolationType: 'MTOM_EXCEEDED',
  },
  {
    name: 'TOM is exactly at MTOM limit',
    payload: [217, 0],
    fuel: [0],
    unusableFuel: [3],
    expectedMtomViolation: false,
    expectedViolationType: 'MTOM_EXCEEDED',
  },
  // @UT-MB-CORE-004@ (FROM: @IMP-MB-CORE-001@)
  {
    name: 'ZFM exceeds MZFM limit',
    payload: [250, 0],
    fuel: [0],
    unusableFuel: [3],
    maximumZeroFuelMass: 600,
    expectedMzfmViolation: true,
    expectedViolationType: 'MZFM_EXCEEDED',
  },
  {
    name: 'ZFM is exactly at MZFM limit',
    payload: [167, 0],
    fuel: [0],
    unusableFuel: [3],
    maximumZeroFuelMass: 600,
    expectedMzfmViolation: false,
    expectedViolationType: 'MZFM_EXCEEDED',
  },
  // @UT-MB-CORE-005@ (FROM: @IMP-MB-009@, @IMP-MB-CORE-011@ )
  {
    name: 'CG exceeds forward envelope limit',
    payload: [150, 0],
    fuel: [0],
    unusableFuel: [3],
    envelope: [
      { armOrMoment: 1.9, mass: 433 },
      { armOrMoment: 1.978, mass: 433 },
      { armOrMoment: 1.978, mass: 650 },
      { armOrMoment: 1.9, mass: 650 },
    ],
    expectedCgViolation: true,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
  {
    name: 'CG is exactly at forward envelope limit',
    payload: [150, 0],
    fuel: [0],
    unusableFuel: [3],
    envelope: [
      { armOrMoment: 1.857188679245283, mass: 433 },
      { armOrMoment: 1.978, mass: 433 },
      { armOrMoment: 1.978, mass: 650 },
      { armOrMoment: 1.857188679245283, mass: 650 },
    ],
    expectedCgViolation: false,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
  {
    name: 'CG exceeds aft envelope limit',
    payload: [0, 200],
    fuel: [0],
    unusableFuel: [3],
    expectedCgViolation: true,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
  {
    name: 'CG is exactly at aft envelope limit',
    payload: [0, 200],
    fuel: [0],
    unusableFuel: [3],
    envelope: [
      { armOrMoment: 1.877, mass: 433 },
      { armOrMoment: 2.0476161137440765, mass: 433 },
      { armOrMoment: 2.0476161137440765, mass: 650 },
      { armOrMoment: 1.877, mass: 650 },
    ],
    expectedCgViolation: false,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
]

type MassBalanceScenario = {
  name: string
  payload: number[]
  fuel: number[]
  unusableFuel: number[]
  expectedZeroFuelMass: number
  expectedZeroFuelMoment: number
  expectedZeroFuelCenterOfGravity: number
  expectedTakeoffMass: number
  expectedTakeoffMoment: number
  expectedTakeoffCenterOfGravity: number
  expectedLandingMass: number
  expectedLandingMoment: number
  expectedLandingCenterOfGravity: number
}

type LimitViolationScenario = {
  name: string
  payload: number[]
  payloadArm?: number[]
  fuel: number[]
  fuelArm?: number[]
  unusableFuel: number[]
  envelope?: { armOrMoment: number; mass: number }[]
  maximumZeroFuelMass?: number
  expectedMtomViolation?: boolean
  expectedMzfmViolation?: boolean
  expectedCgViolation?: boolean
  expectedCgMigrationViolation?: boolean
  expectedViolationType: string
}

function expectCgPoint(
  point: { mass: number; moment: number; arm: number },
  mass: number,
  moment: number,
  arm: number,
) {
  expect(point.mass).toBe(mass)
  expect(point.moment).toBeCloseTo(moment, CG_PRECISION)
  expect(point.arm).toBeCloseTo(arm, CG_PRECISION)
}

function expectCgState(
  result: ReturnType<typeof computeMassBalanceCore>,
  scenario: MassBalanceScenario,
) {
  expectCgPoint(
    result.zeroFuelCenterOfGravityPoint,
    scenario.expectedZeroFuelMass,
    scenario.expectedZeroFuelMoment,
    scenario.expectedZeroFuelCenterOfGravity,
  )

  expectCgPoint(
    result.takeoffCenterOfGravityPoint,
    scenario.expectedTakeoffMass,
    scenario.expectedTakeoffMoment,
    scenario.expectedTakeoffCenterOfGravity,
  )

  expectCgPoint(
    result.landingCenterOfGravityPoint,
    scenario.expectedLandingMass,
    scenario.expectedLandingMoment,
    scenario.expectedLandingCenterOfGravity,
  )
}

function expectLimitViolation(
  violations: { type: string; field?: string; code?: string; stationIndex?: number }[],
  expectedViolationType: string | null,
  shouldExist: boolean,
) {
  const violation = violations.find((v) => v.type === expectedViolationType)
  if (shouldExist) {
    expect(violation).toBeDefined()
    expect(violation?.type).toBe(expectedViolationType)
  } else {
    expect(violation).toBeUndefined()
  }
  //expect(violation?.field).toBe(scenario.expectedField ?? undefined)
  //expect(violation?.code).toBe(scenario.expectedCode ?? undefined)
  //expect(violation?.stationIndex).toBe(scenario.expectedStationIndex ?? undefined)
}

function expectLimitViolationState(
  result: ReturnType<typeof computeMassBalanceCore>,
  scenario: LimitViolationScenario,
) {
  if (scenario.expectedMtomViolation !== undefined) {
    expectLimitViolation(
      result.violations,
      scenario.expectedViolationType,
      scenario.expectedMtomViolation,
    )
  }
  if (scenario.expectedMzfmViolation !== undefined) {
    expectLimitViolation(
      result.violations,
      scenario.expectedViolationType,
      scenario.expectedMzfmViolation,
    )
  }
  if (scenario.expectedCgViolation !== undefined) {
    expectLimitViolation(
      result.violations,
      scenario.expectedViolationType,
      scenario.expectedCgViolation,
    )
  }
  if (scenario.expectedCgMigrationViolation !== undefined) {
    expectLimitViolation(
      result.violations,
      scenario.expectedViolationType,
      scenario.expectedCgMigrationViolation,
    )
  }
}

describe('Mass & Balance Math-Core Logic', () => {
  describe('CG point calculations', () => {
    // @UT-MB-CORE-001@
    // obsolete

    // @UT-MB-CORE-002@ (FROM: @IMP-MB-CORE-001@, @IMP-MB-CORE-002@, @IMP-MB-CORE-004@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
    it.each(cgScenarios)('computes CG for ZFM, TOM and Landing for $name', (scenario) => {
      // Arrange
      const input = createMathCoreInput()

      scenario.payload.forEach((mass, i) => {
        input.stations[i]!.mass = mass
      })
      scenario.fuel.forEach((mass, i) => {
        input.fuelStations[i]!.mass = mass
      })
      scenario.unusableFuel.forEach((mass, i) => {
        input.fuelStations[i]!.unusableFuel = mass
      })

      // Act
      const result = computeMassBalanceCore(input)

      // Assert
      expectCgState(result, scenario)
    })
  })

  describe('limit violations', () => {
    it.each(limitViolationScenarios)('evaluates $expectedViolationType when $name', (scenario) => {
      const input = createMathCoreInput()

      scenario.payload.forEach((mass, i) => {
        input.stations[i]!.mass = mass
      })
      scenario.payloadArm?.forEach((arm, i) => {
        input.stations[i]!.arm = arm
      })
      scenario.fuel.forEach((mass, i) => {
        input.fuelStations[i]!.mass = mass
      })
      scenario.fuelArm?.forEach((arm, i) => {
        input.fuelStations[i]!.arm = arm
      })
      input.envelope = scenario.envelope ?? input.envelope
      input.maxZeroFuelMass = scenario.maximumZeroFuelMass ?? null

      const result = computeMassBalanceCore(input)

      expectLimitViolationState(result, scenario)
    })

    // @UT-MB-CORE-006@ (FROM: @IMP-MB-CORE-010@, @IMP-MB-CORE-011@ )
    it('triggers CG_MIGRATION_EXCEEDED when migration ends out of envelope', () => {
      const input = createMathCoreInput()
      // Start at safe takeoff (BEM 433, CG 1.877)
      // Add forward fuel that keeps us in for takeoff, but burning it moves us too far forward?
      // Wait, burning fuel usually moves it FORWARD or AFT.
      // In Tecnam P2008, fuel is at 2.209 (AFT). Burning it moves CG FORWARD.
      // So if we have very little fuel and are near the forward limit, burning it might exit forward.

      // Reverse scenario: Takeoff is AFT safe, burning fuel makes it stay safe?
      // Let's force a scenario:
      // Tapeoff: Mass 640, Arm 1.95 (Safe range [1.841, 1.978])
      // Landing: Mass 600, Arm 1.
      input.stations = []
      input.basicEmptyMass = 600
      input.emptyCenterOfGravity = 1.99 // Out AFT
      input.fuelStations[0]!.mass = 40
      input.fuelStations[0]!.arm = 1.35

      const result = computeMassBalanceCore(input)
      expect(result.violations.some((v) => v.type === 'CG_MIGRATION_EXCEEDED')).toBe(true)
    })
  })

  describe('arm lookup tables', () => {
    // @UT-MB-CORE-007@ (FROM: @IMP-MB-CORE-012@)
    it('interpolates arm correctly from lookup table', () => {
      const input = createMathCoreInput()
      input.stations[0]!.mass = 50
      input.stations[0]!.arm = null
      input.stations[0]!.armLookup = [
        { massOrVolume: 0, moment: 0 },
        { massOrVolume: 100, moment: 200 }, // Arm = 2.0
      ]
      input.stations[1]!.mass = 0
      input.stations[1]!.arm = null
      input.stations[1]!.armLookup = []
      input.fuelStations[0]!.mass = 70
      input.fuelStations[0]!.arm = null
      input.fuelStations[0]!.armLookup = [
        { massOrVolume: 0, moment: 0 },
        { massOrVolume: 100, moment: 180 }, // Arm = 2.0
      ]
      // add a second fuel station to fuelstation array with index 3
      input.fuelStations.push({
        index: 3,
        mass: 0,
        arm: null,
        armLookup: [],
        unusableFuel: 0,
        burnSequences: [],
      })

      const result = computeMassBalanceCore(input)
      // Station Mass 50 is halfway. Station Moment = 100. Arm = 100 / 50 = 2.0
      // Fuel Station Mass 70, arm lookup at 70: Moment = 126. Arm = 126 / 70 = 1.8
      // Usable fuel = max(0, 70 - 3) = 67 (unusable already in BEM)
      // Total Mass = 433 + 50 + 67 = 550
      // Total Moment = 433*1.877 + 50*2.0 + 67*1.8 = 812.741 + 100 + 120.6 = 1033.341
      // CG = 1033.341 / 550 = 1.87880...
      expect(result.takeoffCenterOfGravityPoint.mass).toBe(550)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.8788, CG_PRECISION)
    })

    // @UT-MB-CORE-008@ (FROM: @IMP-MB-CORE-012@)
    it('look up arm for empty mass correctly from lookup table', () => {
      const input = createMathCoreInput()

      input.stations[0]!.mass = 170
      input.stations[1]!.mass = 10
      input.fuelStations[0]!.mass = 0
      input.fuelStations[0]!.arm = null
      input.fuelStations[0]!.armLookup = [
        { massOrVolume: 0, moment: 0 },
        { massOrVolume: 100, moment: 200 },
      ]

      const result = computeMassBalanceCore(input)
      // Total Mass = 433 + 170 + 10 = 613
      // Total Moment = 433*1.877 + 170*1.8 + 10*2.417 = 812.741 + 306 + 24.17 = 1142.911
      // CG = 1142.911 / 613 = 1.86445...
      expect(result.takeoffCenterOfGravityPoint.mass).toBe(613)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.86445, CG_PRECISION)
    })

    // @UT-MB-CORE-009@ (FROM: @IMP-MB-CORE-012@)
    it('throws an error when armLookup contains invalid weight input', () => {
      const input = createMathCoreInput()
      input.stations[0]!.mass = NaN
      input.stations[0]!.arm = null
      input.stations[0]!.armLookup = [
        { massOrVolume: 0, moment: 0 },
        { massOrVolume: 100, moment: 200 }, // Arm = 2.0
      ]

      expect(() => computeMassBalanceCore(input)).toThrow(
        'Invalid Input: armLookup has an invalid input.',
      )
    })
    // @UT-MB-CORE-021@ (FROM: @IMP-MB-CORE-012@)
    it('lookupArm returns zero, when mass is zero with lookup table', () => {
      const input = createMathCoreInput()
      input.stations[0]!.mass = 0
      input.stations[0]!.arm = null
      input.stations[0]!.armLookup = [
        { massOrVolume: 0, moment: 0 },
        { massOrVolume: 100, moment: 200 },
      ]
      input.fuelStations[0]!.mass = 0
      const result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.877, CG_PRECISION)
    })

    // @UT-MB-CORE-022@ (FROM: @IMP-MB-CORE-012@)
    it('lookupArm returns zero, when mass is zero with lookup table with first entry is not zero', () => {
      const input = createMathCoreInput()
      input.stations[0]!.mass = 0
      input.stations[0]!.arm = null
      input.stations[0]!.armLookup = [
        { massOrVolume: 50, moment: 100 },
        { massOrVolume: 100, moment: 200 },
      ]
      input.fuelStations[0]!.mass = 0
      const result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.877, CG_PRECISION)
    })

    // @UT-MB-CORE-023@ (FROM: @IMP-MB-CORE-012@)
    it('lookupArm calculates arm immediately, when only one entry in lookup table', () => {
      const input = createMathCoreInput()
      input.stations[0]!.mass = 50
      input.stations[0]!.arm = null
      input.stations[0]!.armLookup = [{ massOrVolume: 50, moment: 100 }] // Arm = 2.0
      input.fuelStations[0]!.unusableFuel = 0
      input.fuelStations[0]!.mass = 0

      const result = computeMassBalanceCore(input)

      // CG = (433*1.877 + 50*2.0) / 483 = 1.890...
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.8897, CG_PRECISION)
    })

    // @UT-MB-CORE-024@ (FROM: @IMP-MB-CORE-012@)
    it('lookupArm calculates arm correctly, when sorting an unsorted lookup table', () => {
      const input = createMathCoreInput()
      input.stations[0]!.mass = 210
      input.stations[0]!.arm = null
      input.stations[0]!.armLookup = [
        // arm = 2.0
        { massOrVolume: 100, moment: 200 },
        { massOrVolume: 50, moment: 100 },
        { massOrVolume: 200, moment: 400 },
      ]
      input.fuelStations[0]!.unusableFuel = 0
      input.fuelStations[0]!.mass = 0

      const result = computeMassBalanceCore(input)

      // CG = (433*1.877 + 210*2.0) / 643 = 1.917...
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.9172, CG_PRECISION)
    })

    // @UT-MB-CORE-025@ (FROM: @IMP-MB-CORE-012@)
    it('lookupArm calculates arm correctly, when extrapolation is needed', () => {
      const input = createMathCoreInput()
      input.stations[0]!.mass = 10
      input.stations[0]!.arm = null
      input.stations[0]!.armLookup = [
        // arm = 2.0
        { massOrVolume: 100, moment: 200 },
        { massOrVolume: 50, moment: 100 },
        { massOrVolume: 200, moment: 400 },
      ]
      input.fuelStations[0]!.unusableFuel = 0
      input.fuelStations[0]!.mass = 0

      const result = computeMassBalanceCore(input)

      // CG = (433*1.877 + 10*2.0) / 443 = 1.880...
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.8798, CG_PRECISION)
    })
  })
  describe('input validation', () => {
    // @UT-MB-CORE-017@ (FROM: @IMP-MB-CORE-001@)
    it('defined a station as fuel station, if the same index is used twice', () => {
      const input = createMathCoreInput()
      input.stations[0]!.index = 0
      input.stations[0]!.mass = 1000
      input.fuelStations[0]!.index = 0
      input.fuelStations[0]!.mass = 10

      const result = computeMassBalanceCore(input)
      expect(result.zeroFuelCenterOfGravityPoint.mass).toBe(433)
      // Usable fuel = max(0, 10 - 3) = 7 (unusable already in BEM)
      expect(result.takeoffCenterOfGravityPoint.mass).toBe(440)
    })
  })
  describe('edge cases', () => {
    // @UT-MB-CORE-018@ (FROM: @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
    it('sets takeoff and landing cg to zero, when takeoff and landing mass are zero', () => {
      const input = createMathCoreInput()
      input.basicEmptyMass = 0
      input.fuelStations[0]!.unusableFuel = 0
      input.fuelStations[0]!.mass = 0

      const result = computeMassBalanceCore(input)
      expect(result.takeoffCenterOfGravityPoint.mass).toBe(0)
      expect(result.landingCenterOfGravityPoint.mass).toBe(0)
      expect(result.takeoffCenterOfGravityPoint.arm).toBe(0)
      expect(result.landingCenterOfGravityPoint.arm).toBe(0)
    })
  })
  describe('graph type', () => {
    // @UT-MB-CORE-019@ (FROM: @IMP-MB-CORE-009@)
    it('uses graph type "moment" correctly', () => {
      const input = createMathCoreInput()
      input.graphType = 'moment'
      input.envelope = [
        { armOrMoment: 797.153, mass: 433 },
        { armOrMoment: 856.474, mass: 433 },
        { armOrMoment: 1285.7, mass: 650 },
        { armOrMoment: 1196.65, mass: 650 },
      ]
      input.fuelStations[0]!.mass = 0

      let result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.mass).toBe(433)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.877, CG_PRECISION)

      input.stations[0]!.mass = 170
      input.stations[1]!.mass = 10
      input.fuelStations[0]!.mass = 30

      result = computeMassBalanceCore(input)

      expect(result.zeroFuelCenterOfGravityPoint.mass).toBe(613)
      // TOM = 613 + usable(30-3=27) = 640
      expect(result.takeoffCenterOfGravityPoint.mass).toBe(640)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.87899, 4)
      // LM = ZFM = 613 (unusable fuel already in BEM)
      expect(result.landingCenterOfGravityPoint.mass).toBe(613)
      expect(result.landingCenterOfGravityPoint.arm).toBeCloseTo(1.86445, CG_PRECISION)
    })

    // @UT-MB-CORE-020@ (FROM: @IMP-MB-CORE-011@)
    it('does not calculate with incomplete envelope', () => {
      const input = createMathCoreInput()
      input.envelope = [
        { armOrMoment: 1.841, mass: 433 },
        { armOrMoment: 1.978, mass: 650 },
      ]

      expect(() => computeMassBalanceCore(input)).toThrow(
        'Invalid Input: Envelope must have at least 3 vertices.',
      )
    })
  })
})
