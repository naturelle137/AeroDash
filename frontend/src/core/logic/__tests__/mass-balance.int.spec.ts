import { describe, it, expect } from 'vitest'
import { computeMassBalanceCore } from '../mass-balance.logic'
import { createMathCoreInput } from '../__fixtures__/mass-balance.fixtures'
import type { MathCoreInput } from '../../domain/mass-balance.math-types'

const CG_PRECISION = 4

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Scenarios ─────────────────────────────────────────────────────────────────

const armLookupScenarios: ArmLookupScenario[] = [
  // @IT-MB-CORE-001@ (FROM: @IMP-MB-CORE-012@)
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
  // @IT-MB-CORE-002@ (FROM: @IMP-MB-CORE-012@)
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
  // @IT-MB-CORE-003@ (FROM: @IMP-MB-CORE-012@)
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
  // @IT-MB-CORE-004@ (FROM: @IMP-MB-CORE-012@)
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
  // @IT-MB-CORE-005@ (FROM: @IMP-MB-CORE-012@)
  {
    name: 'single lookup entry',
    stations: [{ mass: 50, arm: null, armLookup: [{ massOrVolume: 50, moment: 100 }] }],
    fuel: [{ mass: 0, unusableFuel: 0 }],
    expectedTakeoffMass: 483,
    expectedTakeoffArm: 1.8897,
  },
  // @IT-MB-CORE-006@ (FROM: @IMP-MB-CORE-012@)
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
  // @IT-MB-CORE-007@ (FROM: @IMP-MB-CORE-012@)
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
  // @IT-MB-CORE-008@ (FROM: @IMP-MB-CORE-012@)
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

describe('interpolateArmFromLookup', () => {
  describe('integration via computeMassBalanceCore', () => {
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
})
