/**
 * Unit tests for static aircraft model catalogue lookups.
 *
 * @see frontend/src/modules/aircraft/data/aircraft-model-catalogue.ts
 */

import { describe, it, expect } from 'vitest'
import {
  getManufacturers,
  getModelsByManufacturer,
  findByIcaoDesignator,
  findUniqueByIcaoDesignator,
} from '../data/aircraft-model-catalogue'

describe('aircraft-model-catalogue', () => {
  // @UT-AC-CAT-001@ (FROM: @IMP-AC-VIEW-001@)
  it('getManufacturers lists sorted names with Other last', () => {
    const m = getManufacturers()
    expect(m[m.length - 1]).toBe('Other')
    expect(m).toContain('Cessna')
    expect(m).toContain('Piper')
    const withoutOther = m.filter((x) => x !== 'Other')
    expect([...withoutOther].sort()).toEqual(withoutOther)
  })

  // @UT-AC-CAT-002@ (FROM: @IMP-AC-VIEW-001@)
  it('getModelsByManufacturer returns only models for that manufacturer', () => {
    const cessna = getModelsByManufacturer('Cessna')
    expect(cessna.every((e) => e.manufacturer === 'Cessna')).toBe(true)
    expect(cessna.map((e) => e.model)).toContain('C152')
    expect(cessna.map((e) => e.model)).not.toContain('P2008 JC')

    const piper = getModelsByManufacturer('Piper')
    expect(piper.every((e) => e.manufacturer === 'Piper')).toBe(true)
    expect(piper).toHaveLength(3)
  })

  // @UT-AC-CAT-003@ (FROM: @IMP-AC-VIEW-001@)
  it('getModelsByManufacturer returns empty for Other', () => {
    expect(getModelsByManufacturer('Other')).toEqual([])
  })

  // @UT-AC-CAT-004@ (FROM: @IMP-AC-VIEW-001@)
  it('findByIcaoDesignator is case-insensitive and returns all matches', () => {
    const pa28 = findByIcaoDesignator('pa28')
    expect(pa28).toHaveLength(2)
    expect(new Set(pa28.map((e) => e.model))).toEqual(
      new Set(['PA-28-161 Warrior III', 'PA-28-181 Archer III']),
    )
  })

  // @UT-AC-CAT-005@ (FROM: @IMP-AC-VIEW-001@)
  it('findUniqueByIcaoDesignator returns entry only for unambiguous 4-char designator', () => {
    expect(findUniqueByIcaoDesignator('P208')).toMatchObject({
      manufacturer: 'Tecnam',
      model: 'P2008 JC',
      icaoTypeDesignator: 'P208',
    })
    expect(findUniqueByIcaoDesignator('pa28')).toBeNull()
    expect(findUniqueByIcaoDesignator('PA28')).toBeNull()
    expect(findUniqueByIcaoDesignator('PA')).toBeNull()
  })
})
