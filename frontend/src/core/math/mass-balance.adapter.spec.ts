import { describe, it, expect } from 'vitest'
import { calculateMassBalance } from './mass-balance.adapter'
import type { MathCoreInput, EnvelopePoint } from '@/modules/mass-balance/stores/mass-balance.types'

describe('Mass & Balance Math-Core Adapter', () => {
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

  // @UT-MB-005@ (FROM: @IMP-MB-005@)
  it('calculates BEM only state correctly', () => {
    const input = createBaseInput()
    const result = calculateMassBalance(input)

    expect(result.takeoffMass).toBe(433)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.877, 3)
    expect(result.violations).toHaveLength(0)
  })

  it('calculates ZFM and TOM correctly with payload and fuel', () => {
    const input: MathCoreInput = {
      ...createBaseInput(),
      stations: [
        { index: 0, weight: 170, arm: 1.8, armLookup: null }, // Seats
        { index: 1, weight: 10, arm: 2.417, armLookup: null }, // Baggage
        { index: 2, weight: 30, arm: 2.209, armLookup: null }, // Fuel
      ],
      fuelStations: [
        {
          index: 2,
          weight: 30,
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

  // @UT-MB-002@ (FROM: @IMP-MB-002@)
  it('triggers MTOM_EXCEEDED on MTOM exceedance', () => {
    const input = createBaseInput()
    input.maxTakeoffMass = 650
    input.stations = [{ index: 0, weight: 250, arm: 1.8, armLookup: null }]
    // TOM = 433 + 250 = 683 (> 650)

    const result = calculateMassBalance(input)
    expect(result.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(true)
  })

  // @UT-MB-001@ (FROM: @IMP-MB-001@)
  it('triggers MZFM_EXCEEDED on MZFM exceedance', () => {
    const input = createBaseInput()
    input.maxZeroFuelMass = 600
    input.stations = [{ index: 0, weight: 200, arm: 1.8, armLookup: null }]
    // ZFM = 433 + 200 = 633 (> 600)

    const result = calculateMassBalance(input)
    expect(result.violations.some((v) => v.type === 'MZFM_EXCEEDED')).toBe(true)
  })

  // @UT-MB-004@ (FROM: @IMP-MB-004@)
  it('triggers CG_OUT_OF_ENVELOPE when CG is out of envelope', () => {
    const input = createBaseInput()
    // Move CG forward out of envelope (Envelope min arm is 1.841)
    // We need a light mass and very forward arm.
    // BEM 433, CG 1.877
    input.stations = [{ index: 0, weight: 50, arm: 1.0, armLookup: null }]

    // Moment = 433*1.877 + 50*1.0 = 812.741 + 50 = 862.741
    // Total Mass = 483
    // CG = 862.741 / 483 = 1.786... (< 1.841)

    const result = calculateMassBalance(input)
    expect(result.violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')).toBe(true)
  })

  // @UT-MB-003@ (FROM: @IMP-MB-003@, @IMP-MB-004@)
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
        weight: 40,
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

  it('interpolates arm correctly from lookup table', () => {
    const input = createBaseInput()
    input.stations = [
      {
        index: 0,
        weight: 50,
        arm: null,
        armLookup: [
          { massOrVolume: 0, moment: 0 },
          { massOrVolume: 100, moment: 200 }, // Arm = 2.0
        ],
      },
    ]

    const result = calculateMassBalance(input)
    // Weight 50 is halfway. Moment = 100. Arm = 100 / 50 = 2.0
    // Total Mass = 433 + 50 = 483
    // Total Moment = 433*1.877 + 50*2.0 = 812.741 + 100 = 912.741
    // CG = 912.741 / 483 = 1.8897...
    expect(result.takeoffMass).toBe(483)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.8897, 4)
  })
})
