// @UT-PF-CORE-045@ (FROM: @IMP-PF-CORE-021@, @IMP-PF-CORE-022@, @IMP-PF-CORE-023@, @IMP-PF-CORE-024@)

import { describe, it, expect } from 'vitest'
import {
  CAA_SSL_07_RATIOS,
  ESTIMATION_METHOD_LABEL,
  estimateObstacleDistance,
  estimateBaseDistances,
  toBaseDistances,
  type EstimationSuccess,
} from './performance.estimation'

function expectSuccess(result: ReturnType<typeof estimateBaseDistances>): EstimationSuccess {
  expect(result.status).toBe('success')
  if (result.status !== 'success') throw new Error('expected success')
  return result
}

const FULL_POH = {
  takeoffRoll: 300,
  takeoffDistance50ft: 600,
  landingRoll: 250,
  landingDistance50ft: 450,
}

describe('CAA SSL 07 constants', () => {
  it('pins the take-off and landing conversion ratios from CAA SSL 07', () => {
    expect(CAA_SSL_07_RATIOS.takeoff).toBe(1.9)
    expect(CAA_SSL_07_RATIOS.landing).toBe(1.67)
  })

  it('freezes the ratios so they cannot be mutated at runtime', () => {
    expect(Object.isFrozen(CAA_SSL_07_RATIOS)).toBe(true)
  })

  it('exposes the verbatim provenance label for UI and export', () => {
    expect(ESTIMATION_METHOD_LABEL).toBe('ESTIMATED (CAA SSL 07)')
  })
})

describe('estimateObstacleDistance', () => {
  it('derives TOD from TOR via ×1.9', () => {
    expect(estimateObstacleDistance('takeoff', 300)).toBeCloseTo(570, 10)
  })

  it('derives LD from LR via ×1.67', () => {
    expect(estimateObstacleDistance('landing', 200)).toBeCloseTo(334, 10)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'throws on a non-finite roll (%s)',
    (roll) => {
      expect(() => estimateObstacleDistance('takeoff', roll)).toThrow(/finite/)
    },
  )

  it.each([0, -1, -250])('throws on a non-positive roll (%s)', (roll) => {
    expect(() => estimateObstacleDistance('landing', roll)).toThrow(/strictly positive/)
  })
})

describe('estimateBaseDistances — POH precedence', () => {
  it('marks every distance as POH when all four are published', () => {
    const { distances, anyEstimated } = expectSuccess(estimateBaseDistances(FULL_POH))
    expect(anyEstimated).toBe(false)
    for (const d of Object.values(distances)) {
      expect(d.provenance).toBe('poh')
      expect(d.method).toBeNull()
    }
    expect(distances.takeoffDistance50ft.value).toBe(600)
    expect(distances.landingDistance50ft.value).toBe(450)
  })

  it('prefers a published 50 ft distance over the estimate when both roll and distance exist', () => {
    const { distances, anyEstimated } = expectSuccess(
      estimateBaseDistances({ ...FULL_POH, takeoffDistance50ft: 999 }),
    )
    expect(anyEstimated).toBe(false)
    expect(distances.takeoffDistance50ft.provenance).toBe('poh')
    expect(distances.takeoffDistance50ft.value).toBe(999)
  })
})

describe('estimateBaseDistances — estimation', () => {
  it('estimates a missing TOD from TOR and flags only it', () => {
    const { distances, anyEstimated } = expectSuccess(
      estimateBaseDistances({
        takeoffRoll: 300,
        landingRoll: 250,
        landingDistance50ft: 450,
      }),
    )
    expect(anyEstimated).toBe(true)
    expect(distances.takeoffRoll.provenance).toBe('poh')
    expect(distances.takeoffDistance50ft.provenance).toBe('estimated')
    expect(distances.takeoffDistance50ft.method).toBe('caa-ssl-07')
    expect(distances.takeoffDistance50ft.value).toBeCloseTo(570, 10)
    expect(distances.landingDistance50ft.provenance).toBe('poh')
  })

  it('estimates a missing LD from LR via ×1.67', () => {
    const { distances } = expectSuccess(
      estimateBaseDistances({
        takeoffRoll: 300,
        takeoffDistance50ft: 600,
        landingRoll: 200,
      }),
    )
    expect(distances.landingDistance50ft.provenance).toBe('estimated')
    expect(distances.landingDistance50ft.value).toBeCloseTo(334, 10)
  })

  it('estimates both 50 ft distances when only the rolls are published', () => {
    const { distances, anyEstimated } = expectSuccess(
      estimateBaseDistances({ takeoffRoll: 300, landingRoll: 200 }),
    )
    expect(anyEstimated).toBe(true)
    expect(distances.takeoffDistance50ft.provenance).toBe('estimated')
    expect(distances.landingDistance50ft.provenance).toBe('estimated')
  })
})

describe('estimateBaseDistances — typed failures (never throws)', () => {
  it('reports insufficient_data when the take-off roll is missing', () => {
    const result = estimateBaseDistances({ takeoffDistance50ft: 600, landingRoll: 200 })
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') throw new Error('expected failure')
    expect(result.reason).toBe('insufficient_data')
  })

  it('reports insufficient_data when the landing roll is missing', () => {
    const result = estimateBaseDistances({ takeoffRoll: 300, landingDistance50ft: 450 })
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') throw new Error('expected failure')
    expect(result.reason).toBe('insufficient_data')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -10])(
    'reports invalid_input for a present-but-malformed value (%s)',
    (bad) => {
      const result = estimateBaseDistances({ takeoffRoll: bad, landingRoll: 200 })
      expect(result.status).toBe('failure')
      if (result.status !== 'failure') throw new Error('expected failure')
      expect(result.reason).toBe('invalid_input')
    },
  )

  it('reports invalid_input for a malformed published 50 ft distance', () => {
    const result = estimateBaseDistances({ takeoffRoll: 300, takeoffDistance50ft: -1, landingRoll: 200 })
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') throw new Error('expected failure')
    expect(result.reason).toBe('invalid_input')
  })
})

describe('toBaseDistances', () => {
  it('flattens provenance-tagged distances to the plain SI base distances', () => {
    const { distances } = expectSuccess(
      estimateBaseDistances({ takeoffRoll: 300, landingRoll: 200 }),
    )
    expect(toBaseDistances(distances)).toEqual({
      takeoffRoll: 300,
      takeoffDistance50ft: estimateObstacleDistance('takeoff', 300),
      landingRoll: 200,
      landingDistance50ft: estimateObstacleDistance('landing', 200),
    })
  })
})
