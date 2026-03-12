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

  // Test Goal: testing default empty arrays
  const _invalidTypeNestedArrayFields = [
    ['envelope', 0, 'mass', 'ENVELOPE[0].MASS'],
    ['envelope', 0, 'armOrMoment', 'ENVELOPE[0].ARMORMOMENT'],
    // Example for lower structures (needing different test setup):
    // ['stations', 0, 'armLookup', 0, 'massOrVolume', 'STATIONS[0].ARMLOOKUP[0].MASSORVOLUME'],
  ] as const

  // @UT-MB-CORE-010@
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

  // @UT-MB-CORE-011@
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

  it.each(negativeArrayFields)(
    'pushes a field error for arrays with missing %s input',
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

  it('pushes TOO_MANY_ITEMS if combined stations and fuel stations exceed 20', () => {
    const input = createMathCoreInput()

    // Wir erzeugen 15 normale Stationen und 6 Fuel-Stations (Total = 21)
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

  it('pushes DUPLICATE_INDEX if an index is used multiple times across stations and fuelStations', () => {
    const input = createMathCoreInput()

    // Wir erzwingen eine Kollision: Beide bekommen Index 0
    input.stations[0]!.index = 0
    input.fuelStations[0]!.index = 0

    const result = calculateMassBalance(input)

    expect(result.violations.some((v) => v.code === 'DUPLICATE_INDEX')).toBe(true)
  })

  it('pushes REQUIRED if both arm and armLookup are missing for a station (XOR)', () => {
    const input = createMathCoreInput()

    input.stations[0]!.arm = null
    input.stations[0]!.armLookup = [] // Beide leer

    const result = calculateMassBalance(input)

    expect(
      result.violations.some((v) => v.code === 'REQUIRED' && v.field === 'STATIONS[0].ARM'),
    ).toBe(true)
  })

  it('pushes NOT_ALLOWED if both arm and armLookup are provided for a station (XOR)', () => {
    const input = createMathCoreInput()

    input.stations[0]!.arm = 1.5
    input.stations[0]!.armLookup = [{ massOrVolume: 10, moment: 100 }]

    const result = calculateMassBalance(input)

    expect(
      result.violations.some((v) => v.code === 'NOT_ALLOWED' && v.field === 'STATIONS[0].ARM'),
    ).toBe(true)
  })

  it('pushes OUT_OF_RANGE if an index is greater than 19', () => {
    const input = createMathCoreInput()
    input.stations[0]!.index = 25

    const result = calculateMassBalance(input)

    expect(
      result.violations.some((v) => v.code === 'OUT_OF_RANGE' && v.field === 'STATIONS[0].INDEX'),
    ).toBe(true)
  })

  it('pushes NOT_ALLOWED if graphType enum is invalid', () => {
    const input = createMathCoreInput() as unknown as Record<string, unknown>
    input.graphType = 'invalid_string'

    const result = calculateMassBalance(input)

    expect(result.violations.some((v) => v.code === 'NOT_ALLOWED' && v.field === 'GRAPHTYPE')).toBe(
      true,
    )
  })

  it('throws an error and logs if the core logic fails unexpectedly', () => {
    const input = createMathCoreInput()

    // Wir zwingen die Kernlogik dazu, einen Fehler zu werfen
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(logic, 'computeMassBalanceCore').mockImplementationOnce(() => {
      throw new Error('Fatal Core Failure')
    })

    expect(() => calculateMassBalance(input)).toThrow('Fatal Core Failure')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Core failed with:',
      'Fatal Core Failure',
      expect.any(Object),
    )

    consoleSpy.mockRestore()
  })
})
