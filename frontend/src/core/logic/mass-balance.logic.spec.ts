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

    // TOM = 433 + 250 = 683 (> 650)
    const result = computeMassBalanceCore(input)
    expect(result.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(true)
  })

  // @UT-MB-CORE-004@ (FROM: @IMP-MB-001@)
  it('triggers MZFM_EXCEEDED on MZFM exceedance', () => {
    const input = createMathCoreInput()

    input.maxZeroFuelMass = 600
    input.stations[0]!.mass = 200
    // ZFM = 433 + 200 = 633 (> 600)

    const result = computeMassBalanceCore(input)
    expect(result.violations.some((v) => v.type === 'MZFM_EXCEEDED')).toBe(true)
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
    input.fuelStations[0]!.mass = 0
    input.fuelStations[0]!.unusableFuel = 0

    const result = computeMassBalanceCore(input)
    // Mass 50 is halfway. Moment = 100. Arm = 100 / 50 = 2.0
    // Total Mass = 433 + 50 = 483
    // Total Moment = 433*1.877 + 50*2.0 = 812.741 + 100 = 912.741
    // CG = 912.741 / 483 = 1.8897...
    expect(result.takeoffMass).toBe(483)
    expect(result.centerOfGravityPosition).toBeCloseTo(1.8897, 4)
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

  it('throws an error when armLookup contains invalid weight input', () => {
    const input = createMathCoreInput()
    input.stations[0]!.mass = NaN
    input.stations[0]!.arm = null
    input.stations[0]!.armLookup = [
      { massOrVolume: 0, moment: 0 },
      { massOrVolume: 100, moment: 200 }, // Arm = 2.0
    ]

    expect(() => computeMassBalanceCore(input)).toThrowError(
      'Invalid Input: armLookup has an invalid input.',
    )
  })
})
