/**
 * Integration tests for CAA SSL 07 estimation across the persistence /
 * transmission boundary and into the safety-factor pipeline — proving the data
 * provenance contract of REQ-PF-005 / REQ-PF-017:
 *
 *   applyEstimation (Zod boundary, gap → estimate)
 *     → structuredClone (IndexedDB persistence) + JSON (REST transmission)
 *     → toBaseDistances → applySafetyFactors (Go/No-Go gate)
 *
 * The unit specs prove the estimator in isolation; this file proves an estimated
 * value is never silently laundered into authoritative POH data — its
 * `provenance: 'estimated'` marker survives every serialisation hop and the
 * Go/No-Go computation, so a record read back from storage or the wire still
 * shows the pilot the figure was a generic factor, not certified airframe data.
 *
 * The boundary is intentionally P1↔P1 (no Vue/Pinia): IndexedDB persists via the
 * structured-clone algorithm and the sync transport serialises to JSON, so a
 * structured-clone + JSON round-trip is a faithful proxy for both hops.
 *
 * @see ../performance.estimation.ts
 * @see ../../adapters/performance.estimation.adapter.ts
 */
// @IT-PF-CORE-004@ (FROM: @IMP-PF-CORE-022@, @IMP-PF-CORE-025@, @IMP-PF-CORE-020@)

import { describe, it, expect } from 'vitest'
import { applyEstimation } from '../../adapters/performance.estimation.adapter'
import { toBaseDistances, type EstimationSuccess } from '../performance.estimation'
import { applySafetyFactors } from '../../adapters/performance.safety-factor.adapter'

/** Older POH: take-off and landing rolls only — both 50 ft distances are gaps. */
const ROLL_ONLY_PROFILE = {
  takeoffRoll: 300,
  landingRoll: 250,
}

/** Persistence (IndexedDB structured-clone) followed by transmission (JSON). */
function persistAndTransmit<T>(record: T): T {
  return JSON.parse(JSON.stringify(structuredClone(record))) as T
}

function succeed(result: ReturnType<typeof applyEstimation>): EstimationSuccess {
  expect(result.status).toBe('success')
  if (result.status !== 'success') throw new Error('expected success')
  return result
}

describe('estimated-value provenance across persistence + transmission', () => {
  it('retains the estimated flag and method after a structured-clone + JSON round-trip', () => {
    const original = succeed(applyEstimation(ROLL_ONLY_PROFILE))
    const restored = persistAndTransmit(original)

    expect(restored.anyEstimated).toBe(true)
    expect(restored.distances.takeoffDistance50ft.provenance).toBe('estimated')
    expect(restored.distances.takeoffDistance50ft.method).toBe('caa-ssl-07')
    expect(restored.distances.landingDistance50ft.provenance).toBe('estimated')
    // The persisted record is byte-for-byte equal to what the pilot saw.
    expect(restored).toEqual(original)
  })

  it('never presents an estimated value as authoritative POH data', () => {
    const restored = persistAndTransmit(succeed(applyEstimation(ROLL_ONLY_PROFILE)))
    const isAuthoritativePoh = (d: { provenance: string }) => d.provenance === 'poh'

    // Published rolls stay authoritative; derived 50 ft distances do not.
    expect(isAuthoritativePoh(restored.distances.takeoffRoll)).toBe(true)
    expect(isAuthoritativePoh(restored.distances.takeoffDistance50ft)).toBe(false)
    expect(isAuthoritativePoh(restored.distances.landingDistance50ft)).toBe(false)
  })

  it('keeps a published 50 ft distance authoritative through the round-trip', () => {
    const restored = persistAndTransmit(
      succeed(applyEstimation({ ...ROLL_ONLY_PROFILE, takeoffDistance50ft: 640 })),
    )
    expect(restored.distances.takeoffDistance50ft.provenance).toBe('poh')
    expect(restored.distances.takeoffDistance50ft.value).toBe(640)
    // The unpublished landing distance is still estimated alongside it.
    expect(restored.distances.landingDistance50ft.provenance).toBe('estimated')
  })
})

describe('estimated distances flow into the Go/No-Go pipeline without losing provenance', () => {
  it('feeds the estimated base distances to applySafetyFactors while the flag stays on the persisted record', () => {
    const persisted = persistAndTransmit(succeed(applyEstimation(ROLL_ONLY_PROFILE)))

    const pipeline = applySafetyFactors({
      base: toBaseDistances(persisted.distances),
      factors: { friction: 1, slope: 1, densityAltitude: 1, wind: 1 },
      osf: { preset: 'easa-standard' },
      available: { takeoff: 2000, landing: 2000 },
    })

    expect(pipeline.status).toBe('success')
    if (pipeline.status !== 'success') throw new Error('expected pipeline success')
    // The estimated TOD (300 × 1.9 = 570) is the value the pipeline scaled by the
    // OSF for the take-off required distance — proving the estimate actually
    // drives Go/No-Go (unit correction factors leave only the OSF acting)…
    expect(persisted.distances.takeoffDistance50ft.value).toBeCloseTo(570, 10)
    expect(pipeline.takeoff.fullRequired).toBeCloseTo(570 * pipeline.takeoff.appliedOsf, 6)
    // …yet the record retained alongside it still flags that figure as estimated.
    expect(persisted.distances.takeoffDistance50ft.provenance).toBe('estimated')
  })
})
