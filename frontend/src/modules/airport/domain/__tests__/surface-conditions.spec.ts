// @UT-AP-STORE-001@ (FROM: @IMP-AP-STORE-001@)
import { describe, it, expect } from 'vitest'
import {
  surfaceConditionsFor,
  isValidSurfaceCondition,
  surfaceConditionLabel,
} from '../surface-conditions'

describe('surfaceConditionsFor', () => {
  it('returns the six paved conditions required by REQ-AP-004', () => {
    const ids = surfaceConditionsFor('paved').map((o) => o.id)
    expect(ids).toEqual([
      'paved-dry',
      'paved-wet',
      'paved-standing-water',
      'paved-slush',
      'paved-snow',
      'paved-ice',
    ])
  })

  it('returns the five grass/unpaved conditions required by REQ-AP-004', () => {
    const ids = surfaceConditionsFor('grass').map((o) => o.id)
    expect(ids).toEqual([
      'grass-dry',
      'grass-long',
      'grass-wet-soft',
      'grass-damaged-turf',
      'grass-snow-ice',
    ])
  })

  it('labels the long-grass option with its length band', () => {
    const long = surfaceConditionsFor('grass').find((o) => o.id === 'grass-long')
    expect(long?.label).toContain('Long Grass')
  })
})

describe('isValidSurfaceCondition', () => {
  it('accepts a condition that belongs to the base surface type', () => {
    expect(isValidSurfaceCondition('paved', 'paved-wet')).toBe(true)
    expect(isValidSurfaceCondition('grass', 'grass-long')).toBe(true)
  })

  it('rejects a condition from the other surface type (no "Long Grass" on asphalt)', () => {
    expect(isValidSurfaceCondition('paved', 'grass-long')).toBe(false)
    expect(isValidSurfaceCondition('grass', 'paved-ice')).toBe(false)
  })

  it('rejects null and unknown ids', () => {
    expect(isValidSurfaceCondition('paved', null)).toBe(false)
    expect(isValidSurfaceCondition('paved', 'not-a-real-id')).toBe(false)
  })
})

describe('surfaceConditionLabel', () => {
  it('returns the pilot-facing label for a valid selection', () => {
    expect(surfaceConditionLabel('paved', 'paved-dry')).toBe('Dry')
  })

  it('returns null for null, unknown, or cross-surface ids', () => {
    expect(surfaceConditionLabel('paved', null)).toBeNull()
    expect(surfaceConditionLabel('paved', 'grass-long')).toBeNull()
    expect(surfaceConditionLabel('grass', 'unknown')).toBeNull()
  })
})
