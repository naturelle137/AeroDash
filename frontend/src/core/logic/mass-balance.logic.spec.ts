import { describe, it, expect } from 'vitest'
import { computeMassBalanceCore } from './mass-balance.logic'
import { createMathCoreInput } from './__fixtures__/mass-balance.fixtures'

describe('Mass & Balance Math-Core Logic', () => {
  // @UT-MB-CORE-001@ (FROM: @IMP-MB-CORE-002@, @IMP-MB-CORE-005@)
  it('calculates BEM only state correctly', () => {
    const input = createMathCoreInput()

    for (const station of input.stations) {
      station.mass = 0
    }
    for (const fuelStation of input.fuelStations) {
      fuelStation.mass = 0
      fuelStation.unusableFuel = 0
    }

    const result = computeMassBalanceCore(input)

    expect(result.takeoffMass).toBe(433)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.877, 3)
    expect(result.violations).toHaveLength(0)
  })

  // @UT-MB-CORE-002@ (FROM: @IMP-MB-CORE-002@, @IMP-MB-CORE-005@)
  it('calculates ZFM and TOM correctly with payload and fuel', () => {
    const input = createMathCoreInput()

    input.stations[0]!.mass = 170
    input.stations[1]!.mass = 10
    input.fuelStations[0]!.mass = 30

    const result = computeMassBalanceCore(input)

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
    const input = createMathCoreInput()

    input.stations[0]!.mass = 250
    input.fuelStations[0]!.mass = 0
    input.fuelStations[0]!.unusableFuel = 0

    // TOM = 433 + 250 = 683 (> 650)
    let result = computeMassBalanceCore(input)
    expect(result.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(true)

    input.stations[0]!.mass = 217

    // TOM = 433 + 217 = 650 (! > 650)
    result = computeMassBalanceCore(input)
    console.log(result.takeoffMass)
    expect(result.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(false)
  })

  // @UT-MB-CORE-004@ (FROM: @IMP-MB-001@)
  it('triggers MZFM_EXCEEDED on MZFM exceedance', () => {
    const input = createMathCoreInput()

    input.maxZeroFuelMass = 600
    input.stations[0]!.mass = 200
    // ZFM = 433 + 200 = 633 (> 600)

    let result = computeMassBalanceCore(input)
    expect(result.violations.some((v) => v.type === 'MZFM_EXCEEDED')).toBe(true)

    input.stations[0]!.mass = 167

    // ZFM = 433 + 167 = 600 (! > 600)
    result = computeMassBalanceCore(input)
    expect(result.violations.some((v) => v.type === 'MZFM_EXCEEDED')).toBe(false)
  })

  // @UT-MB-CORE-005@ (FROM: @IMP-MB-009@, @IMP-MB-CORE-011@ )
  it('triggers CG_OUT_OF_ENVELOPE when CG is out of envelope', () => {
    const input = createMathCoreInput()
    // Move CG forward out of envelope (Envelope min arm is 1.841)
    // We need a light mass and very forward arm.
    // BEM 433, CG 1.877
    input.stations[0]!.mass = 50
    input.stations[0]!.arm = 1.0

    // Moment = 433*1.877 + 50*1.0 = 812.741 + 50 = 862.741
    // Total Mass = 483
    // CG = 862.741 / 483 = 1.786... (< 1.841)

    const result = computeMassBalanceCore(input)
    expect(result.violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')).toBe(true)
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
    // Fuel Station Mass 70 is 70%. Fuel Station Moment = 126. Arm = 180 / 70 = 1.8
    // Total Mass = 433 + 50 + 70 = 553
    // Total Moment = 433*1.877 + 50*2.0 + 70*1.8 = 812.741 + 100 + 126 = 1038.741
    // CG = 1038.741 / 553 = 1.87837...
    expect(result.takeoffMass).toBe(553)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.8784, 4)
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
    expect(result.takeoffMass).toBe(613)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.86445, 4)
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

  // @UT-MB-CORE-017@ (FROM: @IMP-MB-CORE-001@)
  it('defined a station as fuel station, if the same index is used twice', () => {
    const input = createMathCoreInput()
    input.stations[0]!.index = 0
    input.stations[0]!.mass = 1000
    input.fuelStations[0]!.index = 0
    input.fuelStations[0]!.mass = 10

    const result = computeMassBalanceCore(input)
    expect(result.zeroFuelMass).toBe(433)
    expect(result.takeoffMass).toBe(443)
  })

  // @UT-MB-CORE-018@ (FROM: @IMP-MB-CORE-005@, @IMP-MB-CORE-006@)
  it('sets takeoff and landing cg to zero, when takeoff and landing mass are zero', () => {
    const input = createMathCoreInput()
    input.basicEmptyMass = 0
    input.fuelStations[0]!.unusableFuel = 0
    input.fuelStations[0]!.mass = 0

    const result = computeMassBalanceCore(input)
    expect(result.takeoffMass).toBe(0)
    expect(result.landingMass).toBe(0)
    expect(result.takeoffCenterOfGravity.arm).toBe(0)
    expect(result.landingCenterOfGravity.arm).toBe(0)
  })

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

    expect(result.takeoffMass).toBe(433)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.877, 3)

    input.stations[0]!.mass = 170
    input.stations[1]!.mass = 10
    input.fuelStations[0]!.mass = 30

    result = computeMassBalanceCore(input)

    expect(result.zeroFuelMass).toBe(613)
    expect(result.takeoffMass).toBe(643)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.8805, 4)
    expect(result.landingMass).toBe(616)
    expect(result.landingCenterOfGravity.mass).toBe(616)
    expect(result.landingCenterOfGravity.arm).toBeCloseTo(1.8661, 4)
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

    expect(result.centerOfGravityPosition).toBeCloseTo(1.877, 3)
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

    expect(result.centerOfGravityPosition).toBeCloseTo(1.877, 3)
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
    expect(result.centerOfGravityPosition).toBeCloseTo(1.89, 3)
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
    expect(result.centerOfGravityPosition).toBeCloseTo(1.917, 3)
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
    expect(result.centerOfGravityPosition).toBeCloseTo(1.88, 3)
  })
})
