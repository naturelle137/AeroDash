import { describe, it, expect } from 'vitest'
import { computeMassBalanceCore } from './mass-balance.logic'
import { createMathCoreInput } from './__fixtures__/mass-balance.fixtures'
import type { MathCoreInput } from '../domain/mass-balance.math-types'

const CG_PRECISION = 4

// ── Types ─────────────────────────────────────────────────────────────────────

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
  envelope?: { armOrMoment: number; mass: number }[]
  maximumZeroFuelMass?: number
  basicEmptyMass?: number
  emptyCenterOfGravity?: number
  expectedMtomViolation?: boolean
  expectedMzfmViolation?: boolean
  expectedCgViolation?: boolean
  expectedCgMigrationViolation?: boolean
  expectedViolationType: string
}

type StationOverride = {
  mass: number
  arm?: number | null
  armLookup?: { massOrVolume: number; moment: number }[]
}

type FuelOverride = {
  mass: number
  arm?: number | null
  armLookup?: { massOrVolume: number; moment: number }[]
  unusableFuel?: number
}

type ArmLookupScenario = {
  name: string
  stations: StationOverride[]
  fuel?: FuelOverride[]
  expectedTakeoffMass: number
  expectedTakeoffArm: number
}

type ArmLookupErrorScenario = {
  name: string
  stations: StationOverride[]
  fuel?: FuelOverride[]
  expectedError: string
}

type CgMigrationScenario = {
  name: string
  payload: number[]
  fuel: number[]
  expectedPath: { arm: number; mass: number; label: string }[]
}

type EdgeCaseScenario = {
  name: string
  overrides?: Partial<MathCoreInput>
  payload?: number[]
  fuel?: number[]
  fuelUnusableFuel?: number[]
  expectedTakeoffMass: number
  expectedTakeoffArm: number
  expectedLandingMass: number
  expectedLandingArm: number
}

type EdgeCaseErrorScenario = {
  name: string
  overrides?: Partial<MathCoreInput>
  expectedError: string
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

const cgScenarios: MassBalanceScenario[] = [
  // @UT-MB-CORE-002@ (FROM: @IMP-MB-CORE-001@, @IMP-MB-CORE-002@, @IMP-MB-CORE-004@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
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
  // @UT-MB-CORE-026@ (FROM: @IMP-MB-CORE-001@, @IMP-MB-CORE-002@, @IMP-MB-CORE-004@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
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
  // @UT-MB-CORE-027@ (FROM: @IMP-MB-CORE-001@, @IMP-MB-CORE-002@, @IMP-MB-CORE-004@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
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
  // @UT-MB-CORE-028@ (FROM: @IMP-MB-CORE-001@, @IMP-MB-CORE-002@, @IMP-MB-CORE-004@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
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
    expectedMtomViolation: true,
    expectedViolationType: 'MTOM_EXCEEDED',
  },
  // @UT-MB-CORE-029@ (FROM: @IMP-MB-CORE-003@)
  {
    name: 'TOM is exactly at MTOM limit',
    payload: [217, 0],
    fuel: [0],
    expectedMtomViolation: false,
    expectedViolationType: 'MTOM_EXCEEDED',
  },
  // @UT-MB-CORE-004@ (FROM: @IMP-MB-CORE-001@)
  {
    name: 'ZFM exceeds MZFM limit',
    payload: [250, 0],
    fuel: [0],
    maximumZeroFuelMass: 600,
    expectedMzfmViolation: true,
    expectedViolationType: 'MZFM_EXCEEDED',
  },
  // @UT-MB-CORE-030@ (FROM: @IMP-MB-CORE-001@)
  {
    name: 'ZFM is exactly at MZFM limit',
    payload: [167, 0],
    fuel: [0],
    maximumZeroFuelMass: 600,
    expectedMzfmViolation: false,
    expectedViolationType: 'MZFM_EXCEEDED',
  },
  // @UT-MB-CORE-005@ (FROM: @IMP-MB-CORE-009@, @IMP-MB-CORE-011@)
  {
    name: 'CG exceeds forward envelope limit',
    payload: [150, 0],
    fuel: [0],
    envelope: [
      { armOrMoment: 1.9, mass: 433 },
      { armOrMoment: 1.978, mass: 433 },
      { armOrMoment: 1.978, mass: 650 },
      { armOrMoment: 1.9, mass: 650 },
    ],
    expectedCgViolation: true,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
  // @UT-MB-CORE-031@ (FROM: @IMP-MB-CORE-009@, @IMP-MB-CORE-011@)
  {
    name: 'CG is exactly at forward envelope limit',
    payload: [150, 0],
    fuel: [0],
    envelope: [
      { armOrMoment: 1.857188679245283, mass: 433 },
      { armOrMoment: 1.978, mass: 433 },
      { armOrMoment: 1.978, mass: 650 },
      { armOrMoment: 1.857188679245283, mass: 650 },
    ],
    expectedCgViolation: false,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
  // @UT-MB-CORE-032@ (FROM: @IMP-MB-CORE-009@, @IMP-MB-CORE-011@)
  {
    name: 'CG exceeds aft envelope limit',
    payload: [0, 200],
    fuel: [0],
    expectedCgViolation: true,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
  // @UT-MB-CORE-033@ (FROM: @IMP-MB-CORE-009@, @IMP-MB-CORE-011@)
  {
    name: 'CG is exactly at aft envelope limit',
    payload: [0, 200],
    fuel: [0],
    envelope: [
      { armOrMoment: 1.877, mass: 433 },
      { armOrMoment: 2.0476161137440765, mass: 433 },
      { armOrMoment: 2.0476161137440765, mass: 650 },
      { armOrMoment: 1.877, mass: 650 },
    ],
    expectedCgViolation: false,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
  // @UT-MB-CORE-006@ (FROM: @IMP-MB-CORE-010@, @IMP-MB-CORE-011@)
  {
    name: 'landing CG exits envelope after fuel burn',
    payload: [],
    fuel: [40],
    fuelArm: [1.35],
    basicEmptyMass: 600,
    emptyCenterOfGravity: 1.99,
    expectedCgMigrationViolation: true,
    expectedViolationType: 'CG_MIGRATION_EXCEEDED',
  },
  // @UT-MB-CORE-034@ (FROM: @IMP-MB-CORE-010@, @IMP-MB-CORE-011@)
  {
    name: 'CG migration stays within envelope',
    payload: [85, 10],
    fuel: [60],
    expectedCgMigrationViolation: false,
    expectedViolationType: 'CG_MIGRATION_EXCEEDED',
  },
]

const armLookupScenarios: ArmLookupScenario[] = [
  // @UT-MB-CORE-007@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'interpolation across payload and fuel stations',
    stations: [
      {
        mass: 50,
        arm: null,
        armLookup: [
          { massOrVolume: 0, moment: 0 },
          { massOrVolume: 100, moment: 200 },
        ],
      },
    ],
    fuel: [
      {
        mass: 70,
        arm: null,
        armLookup: [
          { massOrVolume: 0, moment: 0 },
          { massOrVolume: 100, moment: 180 },
        ],
      },
    ],
    expectedTakeoffMass: 550,
    expectedTakeoffArm: 1.8788,
  },
  // @UT-MB-CORE-008@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'zero fuel mass with lookup table',
    stations: [{ mass: 170 }, { mass: 10 }],
    fuel: [
      {
        mass: 0,
        arm: null,
        armLookup: [
          { massOrVolume: 0, moment: 0 },
          { massOrVolume: 100, moment: 200 },
        ],
      },
    ],
    expectedTakeoffMass: 613,
    expectedTakeoffArm: 1.86445,
  },
  // @UT-MB-CORE-021@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'zero station mass with lookup starting at zero',
    stations: [
      {
        mass: 0,
        arm: null,
        armLookup: [
          { massOrVolume: 0, moment: 0 },
          { massOrVolume: 100, moment: 200 },
        ],
      },
    ],
    fuel: [{ mass: 0 }],
    expectedTakeoffMass: 433,
    expectedTakeoffArm: 1.877,
  },
  // @UT-MB-CORE-022@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'zero station mass with lookup starting above zero',
    stations: [
      {
        mass: 0,
        arm: null,
        armLookup: [
          { massOrVolume: 50, moment: 100 },
          { massOrVolume: 100, moment: 200 },
        ],
      },
    ],
    fuel: [{ mass: 0 }],
    expectedTakeoffMass: 433,
    expectedTakeoffArm: 1.877,
  },
  // @UT-MB-CORE-023@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'single lookup entry',
    stations: [{ mass: 50, arm: null, armLookup: [{ massOrVolume: 50, moment: 100 }] }],
    fuel: [{ mass: 0, unusableFuel: 0 }],
    expectedTakeoffMass: 483,
    expectedTakeoffArm: 1.8897,
  },
  // @UT-MB-CORE-024@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'unsorted lookup table',
    stations: [
      {
        mass: 210,
        arm: null,
        armLookup: [
          { massOrVolume: 100, moment: 200 },
          { massOrVolume: 50, moment: 100 },
          { massOrVolume: 200, moment: 400 },
        ],
      },
    ],
    fuel: [{ mass: 0, unusableFuel: 0 }],
    expectedTakeoffMass: 643,
    expectedTakeoffArm: 1.9172,
  },
  // @UT-MB-CORE-025@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'extrapolation below lowest entry',
    stations: [
      {
        mass: 10,
        arm: null,
        armLookup: [
          { massOrVolume: 100, moment: 200 },
          { massOrVolume: 50, moment: 100 },
          { massOrVolume: 200, moment: 400 },
        ],
      },
    ],
    fuel: [{ mass: 0, unusableFuel: 0 }],
    expectedTakeoffMass: 443,
    expectedTakeoffArm: 1.8798,
  },
]

const armLookupErrorScenarios: ArmLookupErrorScenario[] = [
  // @UT-MB-CORE-009@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'NaN mass input',
    stations: [
      {
        mass: NaN,
        arm: null,
        armLookup: [
          { massOrVolume: 0, moment: 0 },
          { massOrVolume: 100, moment: 200 },
        ],
      },
    ],
    expectedError: 'Invalid Input: armLookup has an invalid input.',
  },
]

const cgMigrationScenarios: CgMigrationScenario[] = [
  // @UT-MB-CORE-035@ (FROM: @IMP-MB-CORE-007@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
  {
    name: 'empty aircraft (no CG shift)',
    payload: [0, 0],
    fuel: [0],
    expectedPath: [
      { arm: 1.877, mass: 433, label: 'Takeoff' },
      { arm: 1.877, mass: 433, label: 'Landing' },
    ],
  },
  // @UT-MB-CORE-036@ (FROM: @IMP-MB-CORE-007@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
  {
    name: 'typical flight',
    payload: [85, 10],
    fuel: [60],
    expectedPath: [
      { arm: 1.9074, mass: 585, label: 'Takeoff' },
      { arm: 1.8748, mass: 528, label: 'Landing' },
    ],
  },
  // @UT-MB-CORE-037@ (FROM: @IMP-MB-CORE-007@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
  {
    name: 'fuel-only loading',
    payload: [0, 0],
    fuel: [80],
    expectedPath: [
      { arm: 1.9271, mass: 510, label: 'Takeoff' },
      { arm: 1.877, mass: 433, label: 'Landing' },
    ],
  },
]

const edgeCaseScenarios: EdgeCaseScenario[] = [
  // @UT-MB-CORE-018@ (FROM: @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
  {
    name: 'zero BEM produces zero CG',
    overrides: { basicEmptyMass: 0 },
    fuel: [0],
    fuelUnusableFuel: [0],
    expectedTakeoffMass: 0,
    expectedTakeoffArm: 0,
    expectedLandingMass: 0,
    expectedLandingArm: 0,
  },
  // @UT-MB-CORE-017@ (FROM: @IMP-MB-CORE-001@)
  {
    name: 'fuel station index shadows payload station with same index',
    overrides: {
      stations: [{ index: 0, mass: 1000, arm: 1.8, armLookup: [] }],
      fuelStations: [
        { index: 0, mass: 10, arm: 2.209, armLookup: [], unusableFuel: 3, burnSequences: [] },
      ],
    },
    expectedTakeoffMass: 440,
    expectedTakeoffArm: 1.8823,
    expectedLandingMass: 433,
    expectedLandingArm: 1.877,
  },
  // @UT-MB-CORE-039@ (FROM: @IMP-MB-CORE-002@)
  {
    name: 'unusable fuel equals total fuel yields zero usable',
    fuel: [50],
    fuelUnusableFuel: [50],
    expectedTakeoffMass: 433,
    expectedTakeoffArm: 1.877,
    expectedLandingMass: 433,
    expectedLandingArm: 1.877,
  },
  // @UT-MB-CORE-040@ (FROM: @IMP-MB-CORE-002@)
  {
    name: 'unusable fuel exceeds total fuel clamps to zero',
    fuel: [20],
    fuelUnusableFuel: [30],
    expectedTakeoffMass: 433,
    expectedTakeoffArm: 1.877,
    expectedLandingMass: 433,
    expectedLandingArm: 1.877,
  },
  // @UT-MB-CORE-041@ (FROM: @IMP-MB-CORE-001@)
  {
    name: 'empty stations array computes BEM-only CG',
    overrides: { stations: [] },
    expectedTakeoffMass: 433,
    expectedTakeoffArm: 1.877,
    expectedLandingMass: 433,
    expectedLandingArm: 1.877,
  },
  // @UT-MB-CORE-042@ (FROM: @IMP-MB-CORE-011@)
  {
    name: 'triangular envelope with minimum 3 vertices',
    overrides: {
      envelope: [
        { armOrMoment: 1.8, mass: 400 },
        { armOrMoment: 2.0, mass: 400 },
        { armOrMoment: 1.9, mass: 700 },
      ],
    },
    expectedTakeoffMass: 433,
    expectedTakeoffArm: 1.877,
    expectedLandingMass: 433,
    expectedLandingArm: 1.877,
  },
]

const edgeCaseErrorScenarios: EdgeCaseErrorScenario[] = [
  // @UT-MB-CORE-020@ (FROM: @IMP-MB-CORE-011@)
  {
    name: 'envelope with fewer than 3 vertices',
    overrides: {
      envelope: [
        { armOrMoment: 1.841, mass: 433 },
        { armOrMoment: 1.978, mass: 650 },
      ],
    },
    expectedError: 'Invalid Input: Envelope must have at least 3 vertices.',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function buildArmLookupInput(scenario: {
  stations: StationOverride[]
  fuel?: FuelOverride[]
}): MathCoreInput {
  const input = createMathCoreInput()
  scenario.stations.forEach((s, i) => {
    if (!input.stations[i]) return
    input.stations[i]!.mass = s.mass
    if (s.arm !== undefined) input.stations[i]!.arm = s.arm
    if (s.armLookup) input.stations[i]!.armLookup = s.armLookup
  })
  scenario.fuel?.forEach((f, i) => {
    if (!input.fuelStations[i]) return
    input.fuelStations[i]!.mass = f.mass
    if (f.arm !== undefined) input.fuelStations[i]!.arm = f.arm
    if (f.armLookup) input.fuelStations[i]!.armLookup = f.armLookup
    if (f.unusableFuel !== undefined) input.fuelStations[i]!.unusableFuel = f.unusableFuel
  })
  return input
}

function buildEdgeCaseInput(scenario: EdgeCaseScenario): MathCoreInput {
  const input = createMathCoreInput(scenario.overrides)
  scenario.payload?.forEach((mass, i) => {
    input.stations[i]!.mass = mass
  })
  scenario.fuel?.forEach((mass, i) => {
    input.fuelStations[i]!.mass = mass
  })
  scenario.fuelUnusableFuel?.forEach((uf, i) => {
    input.fuelStations[i]!.unusableFuel = uf
  })
  return input
}

function expectMigrationPath(
  result: ReturnType<typeof computeMassBalanceCore>,
  expectedPath: CgMigrationScenario['expectedPath'],
) {
  expect(result.migrationPath).toHaveLength(expectedPath.length)
  expectedPath.forEach((expected, i) => {
    const point = result.migrationPath[i]!
    expect(point.label).toBe(expected.label)
    expect(point.mass).toBe(expected.mass)
    expect(point.arm).toBeCloseTo(expected.arm, CG_PRECISION)
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Mass & Balance Math-Core Logic', () => {
  describe('CG point calculations', () => {
    it.each(cgScenarios)('computes CG for ZFM, TOM and Landing for $name', (scenario) => {
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

      const result = computeMassBalanceCore(input)

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
      if (scenario.basicEmptyMass !== undefined) input.basicEmptyMass = scenario.basicEmptyMass
      if (scenario.emptyCenterOfGravity !== undefined)
        input.emptyCenterOfGravity = scenario.emptyCenterOfGravity

      const result = computeMassBalanceCore(input)

      expectLimitViolationState(result, scenario)
    })
  })

  describe('arm lookup tables', () => {
    it.each(armLookupScenarios)('resolves arm for $name', (scenario) => {
      const input = buildArmLookupInput(scenario)

      const result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.mass).toBe(scenario.expectedTakeoffMass)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(
        scenario.expectedTakeoffArm,
        CG_PRECISION,
      )
    })

    it.each(armLookupErrorScenarios)('throws on $name', (scenario) => {
      const input = buildArmLookupInput(scenario)

      expect(() => computeMassBalanceCore(input)).toThrow(scenario.expectedError)
    })
  })

  describe('CG migration', () => {
    it.each(cgMigrationScenarios)('produces correct migration path for $name', (scenario) => {
      const input = createMathCoreInput()
      scenario.payload.forEach((mass, i) => {
        input.stations[i]!.mass = mass
      })
      scenario.fuel.forEach((mass, i) => {
        input.fuelStations[i]!.mass = mass
      })

      const result = computeMassBalanceCore(input)

      expectMigrationPath(result, scenario.expectedPath)
    })

    // @UT-MB-CORE-038@ (FROM: @IMP-MB-CORE-007@)
    // eslint-expect-error-next-line
    it.todo('calculates burn-down polygon vertices for multi-sequence fuel burn (REQ-MB-008)') // oxlint-disable-line
  })

  describe('edge cases', () => {
    it.each(edgeCaseScenarios)('$name', (scenario) => {
      const input = buildEdgeCaseInput(scenario)

      const result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.mass).toBe(scenario.expectedTakeoffMass)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(
        scenario.expectedTakeoffArm,
        CG_PRECISION,
      )
      expect(result.landingCenterOfGravityPoint.mass).toBe(scenario.expectedLandingMass)
      expect(result.landingCenterOfGravityPoint.arm).toBeCloseTo(
        scenario.expectedLandingArm,
        CG_PRECISION,
      )
    })

    it.each(edgeCaseErrorScenarios)('throws on $name', (scenario) => {
      const input = createMathCoreInput(scenario.overrides)

      expect(() => computeMassBalanceCore(input)).toThrow(scenario.expectedError)
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
      expect(result.takeoffCenterOfGravityPoint.mass).toBe(640)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.87899, 4)
      expect(result.landingCenterOfGravityPoint.mass).toBe(613)
      expect(result.landingCenterOfGravityPoint.arm).toBeCloseTo(1.86445, CG_PRECISION)
    })
  })
})
