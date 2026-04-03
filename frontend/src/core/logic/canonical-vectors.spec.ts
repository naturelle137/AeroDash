import { describe, it, expect } from 'vitest'
import { computeMassBalanceCore } from './mass-balance.logic'
import {
  CanonicalVectorFileSchema,
  type CanonicalVector,
  type CanonicalVectorFile,
} from './__fixtures__/canonical-vectors.schema'
import type { MathCoreInput } from '../domain/mass-balance.math-types'

import da40Raw from './__fixtures__/vectors/da40-mb.vectors.json'
import p2008Raw from './__fixtures__/vectors/p2008-mb.vectors.json'

function parseVectorFile(raw: unknown, label: string): CanonicalVectorFile {
  const result = CanonicalVectorFileSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(
      `Schema validation failed for ${label}:\n${result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    )
  }
  return result.data
}

function toMathCoreInput(v: CanonicalVector): MathCoreInput {
  return {
    basicEmptyMass: v.input.basicEmptyMass,
    emptyCenterOfGravity: v.input.emptyCenterOfGravity,
    maxTakeoffMass: v.input.maxTakeoffMass,
    maxZeroFuelMass: v.input.maxZeroFuelMass,
    graphType: v.input.graphType,
    envelope: v.input.envelope,
    stations: v.input.stations,
    fuelStations: v.input.fuelStations,
  }
}

function expectCgPoint(
  actual: { arm: number; mass: number; moment: number },
  expected: { arm: number; mass: number; moment: number },
  tolerance: number,
) {
  expect(actual.mass).toBe(expected.mass)
  expect(actual.moment).toBeCloseTo(expected.moment, tolerance)
  expect(actual.arm).toBeCloseTo(expected.arm, tolerance)
}

const da40File = parseVectorFile(da40Raw, 'da40-mb.vectors.json')
const p2008File = parseVectorFile(p2008Raw, 'p2008-mb.vectors.json')

describe('Canonical Math Test Vectors', () => {
  describe(`${da40File.aircraft} (${da40File.vectors.length} vectors)`, () => {
    // @UT-MB-CORE-083@ (FROM: @IMP-MB-CORE-001@, @IMP-MB-CORE-002@, @IMP-MB-CORE-003@, @IMP-MB-CORE-004@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@, @IMP-MB-CORE-008@)
    it.each(da40File.vectors)('$id: $description', (vector) => {
      const input = toMathCoreInput(vector)
      const result = computeMassBalanceCore(input)

      expectCgPoint(
        result.zeroFuelCenterOfGravityPoint,
        vector.expected.zeroFuelCg,
        vector.tolerance,
      )
      expectCgPoint(
        result.takeoffCenterOfGravityPoint,
        vector.expected.takeoffCg,
        vector.tolerance,
      )
      expectCgPoint(
        result.landingCenterOfGravityPoint,
        vector.expected.landingCg,
        vector.tolerance,
      )

      const actualViolationTypes = result.violations.map((v) => v.type).sort()
      const expectedViolationTypes = [...vector.expected.violations].sort()
      expect(actualViolationTypes).toEqual(expectedViolationTypes)
      expect(result.success).toBe(vector.expected.success)
    })
  })

  describe(`${p2008File.aircraft} (${p2008File.vectors.length} vectors)`, () => {
    // @UT-MB-CORE-084@ (FROM: @IMP-MB-CORE-001@, @IMP-MB-CORE-002@, @IMP-MB-CORE-003@, @IMP-MB-CORE-004@, @IMP-MB-CORE-005@, @IMP-MB-CORE-006@, @IMP-MB-CORE-008@)
    it.each(p2008File.vectors)('$id: $description', (vector) => {
      const input = toMathCoreInput(vector)
      const result = computeMassBalanceCore(input)

      expectCgPoint(
        result.zeroFuelCenterOfGravityPoint,
        vector.expected.zeroFuelCg,
        vector.tolerance,
      )
      expectCgPoint(
        result.takeoffCenterOfGravityPoint,
        vector.expected.takeoffCg,
        vector.tolerance,
      )
      expectCgPoint(
        result.landingCenterOfGravityPoint,
        vector.expected.landingCg,
        vector.tolerance,
      )

      const actualViolationTypes = result.violations.map((v) => v.type).sort()
      const expectedViolationTypes = [...vector.expected.violations].sort()
      expect(actualViolationTypes).toEqual(expectedViolationTypes)
      expect(result.success).toBe(vector.expected.success)
    })
  })
})
