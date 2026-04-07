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
  // @UT-MB-CORE-005@ (FROM: @IMP-MB-CORE-008@, @IMP-MB-CORE-011@)
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
  // @UT-MB-CORE-031@ (FROM: @IMP-MB-CORE-008@, @IMP-MB-CORE-011@)
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
  // @UT-MB-CORE-032@ (FROM: @IMP-MB-CORE-008@, @IMP-MB-CORE-011@)
  {
    name: 'CG exceeds aft envelope limit',
    payload: [0, 200],
    fuel: [0],
    expectedCgViolation: true,
    expectedViolationType: 'CG_OUT_OF_ENVELOPE',
  },
  // @UT-MB-CORE-033@ (FROM: @IMP-MB-CORE-008@, @IMP-MB-CORE-011@)
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
  // @UT-MB-CORE-017@ (FROM: @IMP-MB-CORE-001@)
  {
    name: 'fuel station index does not shadow payload station with same index',
    overrides: {
      stations: [{ index: 0, mass: 1000, arm: 1.8, armLookup: [] }],
      fuelStations: [
        { index: 0, mass: 10, arm: 2.209, armLookup: [], unusableFuel: 3, burnSequences: [] },
      ],
    },
    expectedTakeoffMass: 433 + 7 + 1000,
    expectedTakeoffArm: (433 * 1.877 + 7 * 2.209 + 1000 * 1.8) / (433 + 7 + 1000),
    expectedLandingMass: 433 + 1000,
    expectedLandingArm: (433 * 1.877 + 1000 * 1.8) / (433 + 1000),
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

    // @UT-MB-CORE-095@ (FROM: @IMP-MB-CORE-003@, @IMP-MB-CORE-008@)
    it('emits only MTOM_EXCEEDED (not CG_OUT_OF_ENVELOPE) when TOM exceeds MTOM but arm is within horizontal limits', () => {
      const input = createMathCoreInput()
      // payload[0] = 250 → TOM = 433+250 = 683 > 650 MTOM, arm ≈ 1.84 (within 1.841–1.978)
      input.stations[0]!.mass = 250
      input.fuelStations[0]!.mass = 0

      const result = computeMassBalanceCore(input)

      expect(result.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(true)
      expect(result.violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')).toBe(false)
    })

    // @UT-MB-CORE-096@ (FROM: @IMP-MB-CORE-003@, @IMP-MB-CORE-008@)
    it('emits no violation when TOM is exactly at MTOM and arm is within horizontal limits', () => {
      const input = createMathCoreInput()
      // payload[0] = 217 → TOM = 433+217 = 650 = MTOM exactly, arm within envelope
      input.stations[0]!.mass = 217
      input.fuelStations[0]!.mass = 0

      const result = computeMassBalanceCore(input)

      expect(result.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(false)
      expect(result.violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')).toBe(false)
    })

    // @UT-MB-CORE-097@ (FROM: @IMP-MB-CORE-003@, @IMP-MB-CORE-008@)
    it('emits both MTOM_EXCEEDED and CG_OUT_OF_ENVELOPE when TOM exceeds MTOM AND arm is outside arm limits', () => {
      const input = createMathCoreInput({
        envelope: [
          { armOrMoment: 1.9, mass: 433 },
          { armOrMoment: 1.978, mass: 433 },
          { armOrMoment: 1.978, mass: 650 },
          { armOrMoment: 1.9, mass: 650 },
        ],
      })
      // payload[0] arm = 1.8 (forward of envelope left = 1.9), large enough to exceed MTOM
      input.stations[0]!.mass = 300
      input.fuelStations[0]!.mass = 0

      const result = computeMassBalanceCore(input)

      expect(result.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(true)
      expect(result.violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')).toBe(true)
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

    // @UT-MB-CORE-038@ (FROM: @IMP-MB-CORE-007@, @IMP-MB-CORE-008@, @IMP-MB-CORE-010@, @IMP-MB-CORE-011@)
    it('adds intermediate CG waypoints when two tanks share a burn sequence', () => {
      const input = createMathCoreInput({
        stations: [],
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.5, mass: 350 },
          { armOrMoment: 2.5, mass: 350 },
          { armOrMoment: 2.5, mass: 500 },
          { armOrMoment: 1.5, mass: 500 },
        ],
        fuelStations: [
          {
            index: 0,
            mass: 50,
            arm: 3.0,
            armLookup: [],
            unusableFuel: 0,
            burnSequences: [{ sequenceName: 'main', ordinalPosition: 0 }],
          },
          {
            index: 1,
            mass: 30,
            arm: 4.0,
            armLookup: [],
            unusableFuel: 0,
            burnSequences: [{ sequenceName: 'main', ordinalPosition: 1 }],
          },
        ],
      })
      input.basicEmptyMass = 400
      input.emptyCenterOfGravity = 2.0

      const zfmMoment = 400 * 2.0
      const takeoffMass = 480
      const takeoffMoment = zfmMoment + 50 * 3.0 + 30 * 4.0
      const afterFirstBurnMass = takeoffMass - 50
      const afterFirstBurnMoment = takeoffMoment - 50 * 3.0
      const afterFirstBurnArm = afterFirstBurnMoment / afterFirstBurnMass

      const result = computeMassBalanceCore(input)

      expect(result.migrationPath).toHaveLength(3)
      expect(result.migrationPath[0]!.label).toBe('Takeoff')
      expect(result.migrationPath[1]!.label).toBe('main #1')
      expect(result.migrationPath[1]!.mass).toBe(afterFirstBurnMass)
      expect(result.migrationPath[1]!.arm).toBeCloseTo(afterFirstBurnArm, CG_PRECISION)
      expect(result.migrationPath[2]!.label).toBe('Landing')
    })

    // @UT-MB-CORE-085@ (FROM: @IMP-MB-CORE-010@, @IMP-MB-CORE-011@)
    it('checks burn waypoints against envelope in moment space when graphType is moment', () => {
      const input = createMathCoreInput({
        stations: [],
        graphType: 'moment',
        fuelStations: [
          {
            index: 0,
            mass: 50,
            arm: 3.0,
            armLookup: [],
            unusableFuel: 0,
            burnSequences: [{ sequenceName: 'main', ordinalPosition: 0 }],
          },
          {
            index: 1,
            mass: 30,
            arm: 4.0,
            armLookup: [],
            unusableFuel: 0,
            burnSequences: [{ sequenceName: 'main', ordinalPosition: 1 }],
          },
        ],
      })
      input.basicEmptyMass = 400
      input.emptyCenterOfGravity = 2.0
      const takeoffMoment = 400 * 2.0 + 50 * 3.0 + 30 * 4.0
      input.envelope = [
        { armOrMoment: 1050, mass: 470 },
        { armOrMoment: 1090, mass: 470 },
        { armOrMoment: 1090, mass: 490 },
        { armOrMoment: 1050, mass: 490 },
      ]

      const result = computeMassBalanceCore(input)

      expect(takeoffMoment).toBeGreaterThan(1050)
      expect(result.violations.some((v) => v.type === 'CG_MIGRATION_EXCEEDED')).toBe(true)
    })

    // @UT-MB-CORE-094@ (FROM: @IMP-MB-CORE-010@, @IMP-MB-CORE-011@, @IMP-MB-CORE-015@)
    it('detects CG migration violation when burn-down path exits and re-enters a concave envelope between waypoints', () => {
      // Reproduces issue #120: the burn-down LINE SEGMENT crosses the envelope
      // boundary between Takeoff and Landing waypoints, but both discrete
      // endpoints are inside the envelope. The pre-fix implementation missed
      // this because it only tested point containment at the waypoints.
      //
      // Geometry (non-convex / concave envelope — the crucial requirement):
      //   Envelope vertices (armOrMoment, mass):
      //     (0.5, 300) → (1.5, 400) [diagonal kink: left boundary moves right above mass=400]
      //     (1.5, 400) → (1.5, 500) [left vertical above kink]
      //     (1.5, 500) → (2.5, 500) [top]
      //     (2.5, 500) → (2.5, 300) [right]
      //     (2.5, 300) → (0.5, 300) [bottom]
      //   The kink at (1.5, 400) makes this a CONCAVE polygon: between mass=300 and
      //   mass=400 the left boundary is the diagonal, but above mass=400 it becomes
      //   the vertical x=1.5. This is the same geometry as the Cessna 172S Utility
      //   envelope where a slanted left boundary creates a concave region.
      //
      // Takeoff point: (arm=1.6, mass=450) — inside (mass>400, arm=1.6 > x_left=1.5) ✓
      // Landing point: (arm=1.3, mass=330) — inside (mass=330, x_left=0.5+(330-300)/100=0.8 < 1.3) ✓
      // Segment at mass=400 (the kink): arm = 1.6 + (400-450)/(330-450)*(1.3-1.6)
      //   = 1.6 + (−50/−120)*(−0.3) = 1.6 − 0.125 = 1.475
      //   x_left at mass=400 = 1.5 (kink vertex) → 1.475 < 1.5 → OUTSIDE! → should trigger violation
      //
      // BEM and fuel engineered to produce exactly these CG positions:
      //   ZFM  = 330 kg, arm = 1.3  → moment = 429
      //   Fuel = 120 kg, arm = 2.425 → TOM = 450, moment = 720, arm = 1.6
      const input = createMathCoreInput({
        stations: [],
        graphType: 'arm',
        envelope: [
          { armOrMoment: 0.5, mass: 300 },
          { armOrMoment: 1.5, mass: 400 },
          { armOrMoment: 1.5, mass: 500 },
          { armOrMoment: 2.5, mass: 500 },
          { armOrMoment: 2.5, mass: 300 },
        ],
        fuelStations: [
          {
            index: 0,
            mass: 120,
            arm: 2.425,
            armLookup: [],
            unusableFuel: 0,
            burnSequences: [],
          },
        ],
      })
      input.basicEmptyMass = 330
      input.emptyCenterOfGravity = 1.3
      input.maxTakeoffMass = 1000

      const result = computeMassBalanceCore(input)

      expect(result.violations.some((v) => v.type === 'CG_MIGRATION_EXCEEDED')).toBe(true)
    })

    // @UT-MB-CORE-086@ (FROM: @IMP-MB-CORE-010@, @IMP-MB-CORE-011@)
    it('accepts burn waypoints in moment space when envelope contains the migration path', () => {
      const input = createMathCoreInput({
        stations: [],
        graphType: 'moment',
        fuelStations: [
          {
            index: 0,
            mass: 50,
            arm: 3.0,
            armLookup: [],
            unusableFuel: 0,
            burnSequences: [{ sequenceName: 'main', ordinalPosition: 0 }],
          },
          {
            index: 1,
            mass: 30,
            arm: 4.0,
            armLookup: [],
            unusableFuel: 0,
            burnSequences: [{ sequenceName: 'main', ordinalPosition: 1 }],
          },
        ],
      })
      input.basicEmptyMass = 400
      input.emptyCenterOfGravity = 2.0
      input.envelope = [
        { armOrMoment: 700, mass: 350 },
        { armOrMoment: 1200, mass: 350 },
        { armOrMoment: 1200, mass: 500 },
        { armOrMoment: 700, mass: 500 },
      ]

      const result = computeMassBalanceCore(input)

      expect(result.violations.filter((v) => v.type === 'CG_MIGRATION_EXCEEDED')).toHaveLength(0)
      expect(result.success).toBe(true)
    })
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
  })

  describe('graph type', () => {
    // @UT-MB-CORE-019@ (FROM: @IMP-MB-CORE-008@)
    it('uses graph type "moment" correctly for takeoff', () => {
      const input = createMathCoreInput()
      input.graphType = 'moment'
      input.envelope = [
        { armOrMoment: 797.153, mass: 433 },
        { armOrMoment: 856.474, mass: 433 },
        { armOrMoment: 1285.7, mass: 650 },
        { armOrMoment: 1196.65, mass: 650 },
      ]
      input.fuelStations[0]!.mass = 0

      let expectedZeroFuelMass = input.basicEmptyMass + input.fuelStations[0]!.mass
      let expectedTakeoffMass = expectedZeroFuelMass
      let expectedTakeoffCg =
        (input.basicEmptyMass * input.emptyCenterOfGravity +
          input.stations[0]!.mass * input.stations[0]!.arm! +
          input.stations[1]!.mass * input.stations[1]!.arm!) /
        expectedTakeoffMass

      let result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.mass).toBe(expectedTakeoffMass)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(expectedTakeoffCg, CG_PRECISION)

      input.stations[0]!.mass = 170
      input.stations[1]!.mass = 10
      input.fuelStations[0]!.mass = 30

      expectedZeroFuelMass =
        input.basicEmptyMass + input.stations[0]!.mass + input.stations[1]!.mass
      expectedTakeoffMass =
        expectedZeroFuelMass + input.fuelStations[0]!.mass - input.fuelStations[0]!.unusableFuel
      expectedTakeoffCg =
        (input.basicEmptyMass * input.emptyCenterOfGravity +
          input.stations[0]!.mass * input.stations[0]!.arm! +
          input.stations[1]!.mass * input.stations[1]!.arm! +
          input.fuelStations[0]!.mass * input.fuelStations[0]!.arm! -
          input.fuelStations[0]!.unusableFuel * input.fuelStations[0]!.arm!) /
        expectedTakeoffMass

      result = computeMassBalanceCore(input)

      expect(result.zeroFuelCenterOfGravityPoint.mass).toBe(expectedZeroFuelMass)
      expect(result.takeoffCenterOfGravityPoint.mass).toBe(expectedTakeoffMass)
      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(expectedTakeoffCg, CG_PRECISION)
      expect(result.violations.filter((v) => v.type === 'CG_OUT_OF_ENVELOPE')).toHaveLength(0)
      expect(result.success).toBe(true)
    })

    // @UT-MB-CORE-079@ (FROM: @IMP-MB-CORE-010@)
    it('uses graph type "moment" correctly for landing', () => {
      const input = createMathCoreInput()
      input.graphType = 'moment'
      input.envelope = [
        { armOrMoment: 797.153, mass: 433 },
        { armOrMoment: 856.474, mass: 433 },
        { armOrMoment: 1285.7, mass: 650 },
        { armOrMoment: 1196.65, mass: 650 },
      ]
      input.fuelStations[0]!.mass = 0

      let expectedZeroFuelMass = input.basicEmptyMass + input.fuelStations[0]!.mass
      let expectedLandingMass = expectedZeroFuelMass
      let expectedLandingCg =
        (input.basicEmptyMass * input.emptyCenterOfGravity +
          input.stations[0]!.mass * input.stations[0]!.arm! +
          input.stations[1]!.mass * input.stations[1]!.arm!) /
        expectedLandingMass

      let result = computeMassBalanceCore(input)

      expect(result.landingCenterOfGravityPoint.mass).toBe(expectedLandingMass)
      expect(result.landingCenterOfGravityPoint.arm).toBeCloseTo(expectedLandingCg, CG_PRECISION)

      input.stations[0]!.mass = 170
      input.stations[1]!.mass = 10
      input.fuelStations[0]!.mass = 30

      expectedZeroFuelMass =
        input.basicEmptyMass + input.stations[0]!.mass + input.stations[1]!.mass
      expectedLandingMass = expectedZeroFuelMass
      expectedLandingCg =
        (input.basicEmptyMass * input.emptyCenterOfGravity +
          input.stations[0]!.mass * input.stations[0]!.arm! +
          input.stations[1]!.mass * input.stations[1]!.arm!) /
        expectedLandingMass

      result = computeMassBalanceCore(input)

      expect(result.zeroFuelCenterOfGravityPoint.mass).toBe(expectedZeroFuelMass)
      expect(result.landingCenterOfGravityPoint.mass).toBe(expectedLandingMass)
      expect(result.landingCenterOfGravityPoint.arm).toBeCloseTo(expectedLandingCg, CG_PRECISION)
      expect(result.violations.filter((v) => v.type === 'CG_MIGRATION_EXCEEDED')).toHaveLength(0)
      expect(result.success).toBe(true)
    })
  })

  describe('[white box tests]', () => {
    // @UT-MB-CORE-068@ (FROM: @IMP-MB-CORE-001@)
    // Unique station and fuel station indices are validated by the adapter,
    // therefore the logic uses all provided station values for zero fuel mass.
    it('uses station values for zero fuel mass if fuel station index matches', () => {
      const input = createMathCoreInput()
      input.stations = [{ index: 0, mass: 100, arm: 2.0, armLookup: [] }]
      input.fuelStations = [
        { index: 0, mass: 0, arm: 2.0, armLookup: [], unusableFuel: 0, burnSequences: [] },
      ]

      const result = computeMassBalanceCore(input)

      expect(result.zeroFuelCenterOfGravityPoint.mass).toBe(input.basicEmptyMass + 100)
    })

    // @UT-MB-CORE-069@ (FROM: @IMP-MB-CORE-001@)
    it('includes station in zero fuel mass when it does NOT match a fuel station index', () => {
      const input = createMathCoreInput()
      input.stations = [{ index: 0, mass: 100, arm: 2.0, armLookup: [] }]
      input.fuelStations = [
        { index: 1, mass: 300, arm: 2.0, armLookup: [], unusableFuel: 0, burnSequences: [] },
      ]

      const result = computeMassBalanceCore(input)
      expect(result.zeroFuelCenterOfGravityPoint.mass).toBe(input.basicEmptyMass + 100)
    })

    // @UT-MB-CORE-082@ (FROM: @IMP-MB-CORE-001@)
    it('does not include fuel mass in zero fuel mass', () => {
      const input = createMathCoreInput()
      input.stations = []
      input.fuelStations = [
        { index: 0, mass: 100, arm: 2.0, armLookup: [], unusableFuel: 0, burnSequences: [] },
      ]

      const result = computeMassBalanceCore(input)
      expect(result.zeroFuelCenterOfGravityPoint.mass).toBe(input.basicEmptyMass)
    })

    // @UT-MB-CORE-071@ (FROM: @IMP-MB-CORE-001@)
    it('throws an error if neither arm nor armLookup for the station are provided', () => {
      const input = createMathCoreInput()
      input.stations = [{ index: 0, mass: 100, arm: null, armLookup: [] }]

      expect(() => computeMassBalanceCore(input)).toThrow(
        `CRITICAL DOMAIN ERROR: Station ${input.stations[0]!.index} is missing both arm and armLookup.`,
      )
    })

    // @UT-MB-CORE-076@ (FROM: @IMP-MB-CORE-001@)
    it('uses station arm if provided', () => {
      const input = createMathCoreInput()
      input.stations = [{ index: 0, mass: 100, arm: 2.0, armLookup: [] }]
      const expectedZeroFuelCg =
        (input.emptyCenterOfGravity * input.basicEmptyMass +
          input.stations[0]!.mass * input.stations[0]!.arm!) /
        (input.basicEmptyMass + input.stations[0]!.mass)

      const result = computeMassBalanceCore(input)

      expect(result.zeroFuelCenterOfGravityPoint.arm).toBeCloseTo(expectedZeroFuelCg, CG_PRECISION)
    })

    // @UT-MB-CORE-077@ (FROM: @IMP-MB-CORE-001@)
    it('uses station arm lookup if provided', () => {
      const input = createMathCoreInput()
      input.stations = [
        { index: 0, mass: 100, arm: null, armLookup: [{ massOrVolume: 100, moment: 100 }] },
      ]
      const expectedZeroFuelCg =
        (input.emptyCenterOfGravity * input.basicEmptyMass +
          input.stations[0]!.mass *
            (input.stations[0]!.armLookup[0]!.moment! /
              input.stations[0]!.armLookup[0]!.massOrVolume!)) /
        (input.basicEmptyMass + input.stations[0]!.mass)

      const result = computeMassBalanceCore(input)

      expect(result.zeroFuelCenterOfGravityPoint.arm).toBeCloseTo(expectedZeroFuelCg, CG_PRECISION)
    })

    // @UT-MB-CORE-078@ (FROM: @IMP-MB-CORE-001@)
    it('uses station arm lookup if both arm and lookup table are provided', () => {
      const input = createMathCoreInput()
      input.stations = [
        { index: 0, mass: 100, arm: 2.0, armLookup: [{ massOrVolume: 100, moment: 100 }] },
      ]
      const expectedZeroFuelCg =
        (input.emptyCenterOfGravity * input.basicEmptyMass +
          input.stations[0]!.mass *
            (input.stations[0]!.armLookup[0]!.moment! /
              input.stations[0]!.armLookup[0]!.massOrVolume!)) /
        (input.basicEmptyMass + input.stations[0]!.mass)

      const result = computeMassBalanceCore(input)

      expect(result.zeroFuelCenterOfGravityPoint.arm).toBeCloseTo(expectedZeroFuelCg, CG_PRECISION)
    })

    // @UT-MB-CORE-072@ (FROM: @IMP-MB-CORE-002@)
    it('throws an error if neither arm nor armLookup for the fuel station are provided', () => {
      const input = createMathCoreInput()
      input.fuelStations = [
        { index: 0, mass: 100, arm: null, armLookup: [], unusableFuel: 0, burnSequences: [] },
      ]

      expect(() => computeMassBalanceCore(input)).toThrow(
        `CRITICAL DOMAIN ERROR: Fuel Station ${input.fuelStations[0]!.index} is missing both arm and armLookup.`,
      )
    })

    // @UT-MB-CORE-073@ (FROM: @IMP-MB-CORE-002@)
    it('uses fuel station arm if provided', () => {
      const input = createMathCoreInput()
      input.fuelStations = [
        { index: 0, mass: 100, arm: 2.0, armLookup: [], unusableFuel: 0, burnSequences: [] },
      ]
      const expectedTakeoffCg =
        (input.emptyCenterOfGravity * input.basicEmptyMass +
          input.fuelStations[0]!.mass * input.fuelStations[0]!.arm!) /
        (input.basicEmptyMass + input.fuelStations[0]!.mass)

      const result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(expectedTakeoffCg, CG_PRECISION)
    })

    // @UT-MB-CORE-074@ (FROM: @IMP-MB-CORE-002@)
    it('uses fuel station arm lookup if provided', () => {
      const input = createMathCoreInput()
      input.fuelStations = [
        {
          index: 0,
          mass: 100,
          arm: null,
          armLookup: [{ massOrVolume: 100, moment: 100 }],
          unusableFuel: 0,
          burnSequences: [],
        },
      ]
      const expectedTakeoffCg =
        (input.emptyCenterOfGravity * input.basicEmptyMass +
          input.fuelStations[0]!.mass *
            (input.fuelStations[0]!.armLookup[0]!.moment! /
              input.fuelStations[0]!.armLookup[0]!.massOrVolume!)) /
        (input.basicEmptyMass + input.fuelStations[0]!.mass)

      const result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(expectedTakeoffCg, CG_PRECISION)
    })

    // @UT-MB-CORE-075@ (FROM: @IMP-MB-CORE-002@)
    it('uses fuel station arm lookup if both arm and lookup table are provided', () => {
      const input = createMathCoreInput()
      input.fuelStations = [
        {
          index: 0,
          mass: 100,
          arm: 2.0,
          armLookup: [{ massOrVolume: 100, moment: 100 }],
          unusableFuel: 0,
          burnSequences: [],
        },
      ]
      const expectedTakeoffCg =
        (input.emptyCenterOfGravity * input.basicEmptyMass +
          input.fuelStations[0]!.mass *
            (input.fuelStations[0]!.armLookup[0]!.moment! /
              input.fuelStations[0]!.armLookup[0]!.massOrVolume!)) /
        (input.basicEmptyMass + input.fuelStations[0]!.mass)

      const result = computeMassBalanceCore(input)

      expect(result.takeoffCenterOfGravityPoint.arm).toBeCloseTo(expectedTakeoffCg, CG_PRECISION)
    })

    // @UT-MB-CORE-080@ (FROM: @IMP-MB-CORE-002@)
    it('throws an error if zeroFuelMass is exactly 0', () => {
      const input = createMathCoreInput()
      input.stations = [{ index: 0, mass: -433, arm: 2.0, armLookup: [] }]

      expect(() => computeMassBalanceCore(input)).toThrow(
        'CRITICAL DOMAIN ERROR: zeroFuelMass is <= 0. Cannot compute center of gravity.',
      )
    })

    // @UT-MB-CORE-081@ (FROM: @IMP-MB-CORE-002@)
    it('throws an error if zeroFuelMass is smaller than 0', () => {
      const input = createMathCoreInput()
      input.stations = [{ index: 0, mass: -435, arm: 2.0, armLookup: [] }]

      expect(() => computeMassBalanceCore(input)).toThrow(
        'CRITICAL DOMAIN ERROR: zeroFuelMass is <= 0. Cannot compute center of gravity.',
      )
    })
  })
})
