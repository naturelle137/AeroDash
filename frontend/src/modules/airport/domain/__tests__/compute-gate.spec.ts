// @UT-AP-STORE-002@ (FROM: @IMP-AP-STORE-002@)
import { describe, it, expect } from 'vitest'
import type { ManualAirportEntry, ManualRunwayOverrides } from '../airport.types'
import { evaluateComputeGate } from '../compute-gate'

function buildEntry(runway: Partial<ManualRunwayOverrides> = {}): ManualAirportEntry {
  return {
    id: 'test-id',
    icao: 'ZZZZ',
    name: '',
    elevationFt: null,
    schemaVersion: 1,
    runway: {
      designator: '09',
      magneticHeadingDeg: 90,
      baseSurfaceType: 'grass',
      slopePercent: null,
      toraM: 600,
      todaM: null,
      asdaM: null,
      ldaM: null,
      surfaceConditionId: 'grass-dry',
      ...runway,
    },
  }
}

describe('evaluateComputeGate', () => {
  it('allows computation when a valid surface condition and a runway length are present', () => {
    const result = evaluateComputeGate(buildEntry())
    expect(result.allowed).toBe(true)
    expect(result.blockers).toEqual([])
    expect(result.message).toBe('')
  })

  it('blocks when no surface condition is selected (REQ-AP-004 mandatory gate)', () => {
    const result = evaluateComputeGate(buildEntry({ surfaceConditionId: null }))
    expect(result.allowed).toBe(false)
    expect(result.blockers).toContain('SURFACE_CONDITION_REQUIRED')
    expect(result.message).toMatch(/surface condition/i)
  })

  it('blocks when the surface condition does not match the base surface type', () => {
    const result = evaluateComputeGate(
      buildEntry({ baseSurfaceType: 'paved', surfaceConditionId: 'grass-long' }),
    )
    expect(result.allowed).toBe(false)
    expect(result.blockers).toContain('SURFACE_CONDITION_INVALID')
  })

  it('blocks when the runway length (TORA) is missing or non-positive', () => {
    expect(evaluateComputeGate(buildEntry({ toraM: null })).blockers).toContain(
      'RUNWAY_LENGTH_REQUIRED',
    )
    expect(evaluateComputeGate(buildEntry({ toraM: 0 })).blockers).toContain(
      'RUNWAY_LENGTH_REQUIRED',
    )
  })

  it('aggregates every outstanding precondition at once', () => {
    const result = evaluateComputeGate(buildEntry({ surfaceConditionId: null, toraM: null }))
    expect(result.blockers).toEqual(['SURFACE_CONDITION_REQUIRED', 'RUNWAY_LENGTH_REQUIRED'])
    expect(result.message.split(' ').length).toBeGreaterThan(3)
  })
})
