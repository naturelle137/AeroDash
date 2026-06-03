import { describe, it, expect, vi } from 'vitest'
import { calculateMassBalance } from './mass-balance.adapter'
import { createMathCoreInput } from '../logic/__fixtures__/mass-balance.fixtures'
import * as logic from '../logic/mass-balance.logic'

describe('M&B Zod Adapter', () => {
  // Test Goal: Value is set to `undefined` and `null` -> Expected: 'REQUIRED'
  const missingRootFields = [
    ['basicEmptyMass', 'BEM'],
    ['emptyCenterOfGravity', 'EMPTY_CG'],
    ['maxTakeoffMass', 'MTOM'],
    ['envelope', 'ENVELOPE'],
    ['stations', 'STATIONS'],
    ['fuelStations', 'FUEL_STATIONS'],
    ['graphType', 'GRAPHTYPE'],
  ] as const

  // Test Goal: Value is set to String (e.g. "100"), NaN and Infinity -> Expected: 'NOT_A_NUMBER'
  const invalidTypeRootFields = [
    ['basicEmptyMass', 'BEM'],
    ['emptyCenterOfGravity', 'EMPTY_CG'],
    ['maxTakeoffMass', 'MTOM'],
    ['maxZeroFuelMass', 'MZFM'],
  ] as const

  // Test Goal: Value is set to -10 -> Expected: 'NEGATIVE_VALUE'
  const negativeRootFields = [
    ['basicEmptyMass', 'BEM'],
    ['maxTakeoffMass', 'MTOM'],
    ['maxZeroFuelMass', 'MZFM'],
  ] as const

  // Test Goal: Value in array element is set to `undefined` and `null` -> Expected: 'REQUIRED'
  const missingArrayFields = [
    ['stations', 0, 'index', 'STATIONS[0].INDEX'],
    ['stations', 0, 'mass', 'STATIONS[0].MASS'],
    ['fuelStations', 0, 'index', 'FUEL_STATIONS[0].INDEX'],
    ['fuelStations', 0, 'mass', 'FUEL_STATIONS[0].MASS'],
    ['fuelStations', 0, 'unusableFuel', 'FUEL_STATIONS[0].UNUSABLEFUEL'],
  ] as const

  // Test Goal: Value is set to String (e.g. "100"), NaN and Infinity -> Expected: 'NOT_A_NUMBER'
  const invalidTypeArrayFields = [
    ['stations', 0, 'index', 'STATIONS[0].INDEX'],
    ['stations', 0, 'mass', 'STATIONS[0].MASS'],
    ['stations', 0, 'arm', 'STATIONS[0].ARM'], // arm can be null but not a string or infinite
    ['fuelStations', 0, 'index', 'FUEL_STATIONS[0].INDEX'],
    ['fuelStations', 0, 'mass', 'FUEL_STATIONS[0].MASS'],
    ['fuelStations', 0, 'arm', 'FUEL_STATIONS[0].ARM'], // arm can be null but not a string or infinite
    ['fuelStations', 0, 'unusableFuel', 'FUEL_STATIONS[0].UNUSABLEFUEL'],
  ] as const

  // Test Goal: Value is set to -10 -> Expected: 'NEGATIVE_VALUE'
  const negativeArrayFields = [
    ['stations', 0, 'index', 'STATIONS[0].INDEX'],
    ['stations', 0, 'mass', 'STATIONS[0].MASS'],
    ['fuelStations', 0, 'index', 'FUEL_STATIONS[0].INDEX'],
    ['fuelStations', 0, 'mass', 'FUEL_STATIONS[0].MASS'],
    ['fuelStations', 0, 'unusableFuel', 'FUEL_STATIONS[0].UNUSABLEFUEL'],
  ] as const

  // Test Goal: Value in sub array element is set to `undefined` and `null` -> Expected: 'REQUIRED'
  const missingNestedArrayFields = [
    ['envelope', 0, 'mass', 'ENVELOPE[0].MASS'],
    ['envelope', 0, 'armOrMoment', 'ENVELOPE[0].ARMORMOMENT'],
  ] as const

  // @UT-AD-CORE-001@ (FROM: @IMP-AD-CORE-002@)
  it.each(missingRootFields)(
    'pushes a field error for missing root field %s input',
    (field, expectedPath) => {
      let input = createMathCoreInput() as unknown as Record<string, unknown>

      input[field] = null
      let result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) => v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'REQUIRED',
        ),
      ).toBe(true)

      input = createMathCoreInput() as unknown as Record<string, unknown>
      result = calculateMassBalance(input)
      expect(result.violations).toHaveLength(0)

      delete input[field]
      result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) => v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'REQUIRED',
        ),
      ).toBe(true)
    },
  )

  // @UT-AD-CORE-002@ (FROM: @IMP-AD-CORE-002@)
  it.each(missingArrayFields)(
    'pushes a field error for arrays with missing %s input',
    (arrayName, index, propName, expectedPath) => {
      let input = createMathCoreInput()

      let targetArray = input[arrayName] as unknown as Record<string, unknown>[]
      let targetItem = targetArray[index]

      if (targetItem) {
        targetItem[propName] = null
      }

      let result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) => v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'REQUIRED',
        ),
      ).toBe(true)

      input = createMathCoreInput()
      result = calculateMassBalance(input)
      expect(result.violations).toHaveLength(0)

      targetArray = input[arrayName] as unknown as Record<string, unknown>[]
      targetItem = targetArray[index]

      if (targetItem) {
        delete targetItem[propName]
      }

      result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) => v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'REQUIRED',
        ),
      ).toBe(true)
    },
  )

  // @UT-AD-CORE-003@ (FROM: @IMP-AD-CORE-002@)
  it.each(missingNestedArrayFields)(
    'pushes a field error for nested arrays with missing %s input',
    (arrayName, index, propName, expectedPath) => {
      let input = createMathCoreInput()

      let targetArray = input[arrayName] as unknown as Record<string, unknown>[]
      let targetItem = targetArray[index]

      if (targetItem) {
        targetItem[propName] = null
      }

      let result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) => v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'REQUIRED',
        ),
      ).toBe(true)

      input = createMathCoreInput()
      result = calculateMassBalance(input)
      expect(result.violations).toHaveLength(0)

      targetArray = input[arrayName] as unknown as Record<string, unknown>[]
      targetItem = targetArray[index]

      if (targetItem) {
        delete targetItem[propName]
      }

      result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) => v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'REQUIRED',
        ),
      ).toBe(true)
    },
  )

  // @UT-AD-CORE-004@ (FROM: @IMP-AD-CORE-002@)
  it.each(invalidTypeRootFields)(
    'pushes a field error if %s input is no number, NaN or infinite',
    (field, expectedPath) => {
      let input = createMathCoreInput() as unknown as Record<string, unknown>

      input[field] = NaN
      let result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NOT_A_NUMBER',
        ),
      ).toBe(true)

      // cleanup violations for testing string next
      input = createMathCoreInput() as unknown as Record<string, unknown>
      result = calculateMassBalance(input)
      expect(result.violations).toHaveLength(0)

      input[field as string] = 'string'
      result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NOT_A_NUMBER',
        ),
      ).toBe(true)

      // cleanup violations for testing Infinity next
      input = createMathCoreInput() as unknown as Record<string, unknown>
      result = calculateMassBalance(input)
      expect(result.violations).toHaveLength(0)

      input[field] = Infinity
      result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NOT_A_NUMBER',
        ),
      ).toBe(true)
    },
  )

  // @UT-AD-CORE-005@ (FROM: @IMP-AD-CORE-002@)
  it.each(invalidTypeArrayFields)(
    'pushes a field error for arrays if %s input is no number, NaN or infinite',
    (arrayName, index, propName, expectedPath) => {
      let input = createMathCoreInput()

      let targetArray = input[arrayName] as unknown as Record<string, unknown>[]
      let targetItem = targetArray[index]

      if (targetItem) {
        targetItem[propName] = NaN
      }

      let result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NOT_A_NUMBER',
        ),
      ).toBe(true)

      input = createMathCoreInput()
      result = calculateMassBalance(input)
      expect(result.violations).toHaveLength(0)

      targetArray = input[arrayName] as unknown as Record<string, unknown>[]
      targetItem = targetArray[index]

      if (targetItem) {
        targetItem[propName] = 'string'
      }

      result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NOT_A_NUMBER',
        ),
      ).toBe(true)

      input = createMathCoreInput()
      result = calculateMassBalance(input)
      expect(result.violations).toHaveLength(0)

      targetArray = input[arrayName] as unknown as Record<string, unknown>[]
      targetItem = targetArray[index]

      if (targetItem) {
        targetItem[propName] = Infinity
      }

      result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NOT_A_NUMBER',
        ),
      ).toBe(true)
    },
  )

  // @UT-AD-CORE-006@ (FROM: @IMP-AD-CORE-002@)
  it.each(negativeRootFields)(
    'pushes a field error for negative values when only positives are allowed in %s',
    (field, expectedPath) => {
      const input = createMathCoreInput()
      input[field] = -100
      const result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NEGATIVE_VALUE',
        ),
      ).toBe(true)
    },
  )

  // @UT-AD-CORE-007@ (FROM: @IMP-AD-CORE-002@)
  it.each(negativeArrayFields)(
    'pushes a field error for arrays with negative %s input',
    (arrayName, index, propName, expectedPath) => {
      const input = createMathCoreInput()

      const targetArray = input[arrayName] as unknown as Record<string, unknown>[]
      const targetItem = targetArray[index]

      if (targetItem) {
        targetItem[propName] = -100
      }

      const result = calculateMassBalance(input)

      // input.stations![0]!.index = null
      // input.fuelStations = input.fuelStations.filter((fs) => fs.index !== input.stations![0]!.index)

      // mutateInput(input)

      // const result = calculateMassBalance(input)

      expect(
        result.violations.some(
          (v) =>
            v.type === 'INVALID_INPUT' && v.field === expectedPath && v.code === 'NEGATIVE_VALUE',
        ),
      ).toBe(true)
    },
  )

  // @UT-AD-CORE-008@ (FROM: @IMP-AD-CORE-003@)
  it('pushes TOO_MANY_ITEMS if combined stations and fuel stations exceed 20', () => {
    const input = createMathCoreInput()

    input.stations = Array.from({ length: 15 }, (_, i) => ({
      index: i,
      mass: 10,
      arm: 1,
      armLookup: [],
    }))
    input.fuelStations = Array.from({ length: 6 }, (_, i) => ({
      index: 15 + i,
      mass: 10,
      arm: 1,
      unusableFuel: 0,
      armLookup: [],
      burnSequences: [],
    }))

    const result = calculateMassBalance(input)

    expect(
      result.violations.some((v) => v.code === 'TOO_MANY_ITEMS' && v.field === 'STATIONS'),
    ).toBe(true)
  })

  // @UT-AD-CORE-009@ (FROM: @IMP-AD-CORE-003@)
  it('pushes DUPLICATE_INDEX if an index is used multiple times across stations and fuelStations', () => {
    const input = createMathCoreInput()

    input.stations[0]!.index = 0
    input.fuelStations[0]!.index = 0

    const result = calculateMassBalance(input)

    expect(result.violations.some((v) => v.code === 'DUPLICATE_INDEX')).toBe(true)
  })

  // @UT-AD-CORE-010@ (FROM: @IMP-AD-CORE-003@)
  it('pushes REQUIRED if both arm and armLookup are missing for a station (XOR)', () => {
    const input = createMathCoreInput()

    input.stations[0]!.arm = null
    input.stations[0]!.armLookup = []

    const result = calculateMassBalance(input)

    expect(
      result.violations.some((v) => v.code === 'REQUIRED' && v.field === 'STATIONS[0].ARM'),
    ).toBe(true)
  })

  // @UT-AD-CORE-011@ (FROM: @IMP-AD-CORE-003@)
  it('pushes NOT_ALLOWED if both arm and armLookup are provided for a station (XOR)', () => {
    const input = createMathCoreInput()

    input.stations[0]!.arm = 1.5
    input.stations[0]!.armLookup = [{ massOrVolume: 10, moment: 100 }]

    const result = calculateMassBalance(input)

    expect(
      result.violations.some((v) => v.code === 'NOT_ALLOWED' && v.field === 'STATIONS[0].ARM'),
    ).toBe(true)
  })

  // @UT-AD-CORE-012@ (FROM: @IMP-AD-CORE-002@)
  it('pushes OUT_OF_RANGE if an index is greater than 19', () => {
    const input = createMathCoreInput()
    input.stations[0]!.index = 25

    const result = calculateMassBalance(input)

    expect(
      result.violations.some((v) => v.code === 'OUT_OF_RANGE' && v.field === 'STATIONS[0].INDEX'),
    ).toBe(true)
  })

  // @UT-AD-CORE-013@ (FROM: @IMP-AD-CORE-002@)
  it('pushes NOT_ALLOWED if graphType enum is invalid', () => {
    const input = createMathCoreInput() as unknown as Record<string, unknown>
    input.graphType = 'invalid_string'

    const result = calculateMassBalance(input)

    expect(result.violations.some((v) => v.code === 'NOT_ALLOWED' && v.field === 'GRAPHTYPE')).toBe(
      true,
    )
  })

  // @UT-MB-CORE-070@ (FROM: @IMP-MB-CORE-014@)
  it('propagates unexpected core logic errors to the caller', () => {
    const input = createMathCoreInput()

    vi.spyOn(logic, 'computeMassBalanceCore').mockImplementationOnce(() => {
      throw new Error('Fatal Core Failure')
    })

    expect(() => calculateMassBalance(input)).toThrow('Fatal Core Failure')
  })

  // ─── .finite() + domain ranges ────────────────────────────────────────────────

  // @UT-MB-CORE-098@ (FROM: @IMP-MB-CORE-016@)
  it('rejects Infinity for basicEmptyMass as INVALID_INPUT (does not produce success:true with NaN CG)', () => {
    const input = createMathCoreInput()
    ;(input as unknown as Record<string, unknown>).basicEmptyMass = Infinity

    const result = calculateMassBalance(input)

    expect(result.success).toBe(false)
    expect(result.violations.some((v) => v.type === 'INVALID_INPUT' && v.field === 'BEM')).toBe(true)
    expect(Number.isNaN(result.takeoffCenterOfGravityPoint.arm)).toBe(true)
  })

  // @UT-MB-CORE-099@ (FROM: @IMP-MB-CORE-016@)
  it('rejects -Infinity for a station arm', () => {
    const input = createMathCoreInput()
    input.stations[0]!.arm = -Infinity

    const result = calculateMassBalance(input)

    expect(result.success).toBe(false)
    expect(
      result.violations.some((v) => v.type === 'INVALID_INPUT' && v.field === 'STATIONS[0].ARM'),
    ).toBe(true)
  })

  // @UT-MB-CORE-100@ (FROM: @IMP-MB-CORE-016@)
  it('rejects NaN for emptyCenterOfGravity', () => {
    const input = createMathCoreInput()
    ;(input as unknown as Record<string, unknown>).emptyCenterOfGravity = NaN

    const result = calculateMassBalance(input)

    expect(result.success).toBe(false)
    expect(
      result.violations.some((v) => v.type === 'INVALID_INPUT' && v.field === 'EMPTY_CG'),
    ).toBe(true)
  })

  // @UT-MB-CORE-101@ (FROM: @IMP-MB-CORE-016@)
  it('rejects an absurd finite mass magnitude (1e30) as OUT_OF_RANGE', () => {
    const input = createMathCoreInput()
    input.stations[0]!.mass = 1e30

    const result = calculateMassBalance(input)

    expect(result.success).toBe(false)
    expect(
      result.violations.some(
        (v) =>
          v.type === 'INVALID_INPUT' && v.field === 'STATIONS[0].MASS' && v.code === 'OUT_OF_RANGE',
      ),
    ).toBe(true)
  })

  // @UT-MB-CORE-102@ (FROM: @IMP-MB-CORE-016@)
  it('rejects an absurd finite maxTakeoffMass (1e308)', () => {
    const input = createMathCoreInput()
    input.maxTakeoffMass = 1e308

    const result = calculateMassBalance(input)

    expect(result.success).toBe(false)
    expect(result.violations.some((v) => v.field === 'MTOM' && v.code === 'OUT_OF_RANGE')).toBe(true)
  })

  // @UT-MB-CORE-103@ (FROM: @IMP-MB-CORE-016@)
  it('still accepts a near-edge finite value just under the ceiling (no false rejection)', () => {
    const input = createMathCoreInput()
    // 199_999 kg is just below the 200_000 kg ceiling — a heavy but finite,
    // in-range value must still compute.
    input.basicEmptyMass = 199_999
    input.maxTakeoffMass = 200_000

    const result = calculateMassBalance(input)

    expect(result.success).toBe(true)
    expect(Number.isFinite(result.takeoffCenterOfGravityPoint.arm)).toBe(true)
  })
})
