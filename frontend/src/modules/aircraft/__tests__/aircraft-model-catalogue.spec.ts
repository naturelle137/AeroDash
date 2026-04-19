/**
 * Unit tests for static aircraft model catalogue lookups.
 *
 * Covers: catalogue shape, manufacturer filter, ICAO auto-fill, reverse lookup,
 * unique designator lookup, 'Other' manual entry, and CATALOGUE_VERSION.
 *
 * @see frontend/src/modules/aircraft/data/aircraft-model-catalogue.ts
 */

// @UT-AC-VIEW-001@ (FROM: @IMP-AC-VIEW-001@)

import { describe, it, expect } from 'vitest'
import {
  AIRCRAFT_MODEL_CATALOGUE,
  CATALOGUE_VERSION,
  getManufacturers,
  getModelsByManufacturer,
  findByIcaoDesignator,
  findUniqueByIcaoDesignator,
  getPowertrainHintFor,
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

describe('AIRCRAFT_MODEL_CATALOGUE', () => {
  // @UT-AC-VIEW-001@ (FROM: @IMP-AC-VIEW-001@)
  it('contains at least one entry per expected manufacturer', () => {
    const manufacturers = AIRCRAFT_MODEL_CATALOGUE.map((e) => e.manufacturer)
    expect(manufacturers).toContain('Cessna')
    expect(manufacturers).toContain('Piper')
    expect(manufacturers).toContain('Diamond')
    expect(manufacturers).toContain('Tecnam')
    expect(manufacturers).toContain('Robin')
  })

  // @UT-AC-VIEW-002@ (FROM: @IMP-AC-VIEW-001@)
  it('every entry has a non-empty manufacturer, model, and icaoTypeDesignator', () => {
    for (const entry of AIRCRAFT_MODEL_CATALOGUE) {
      expect(entry.manufacturer.length).toBeGreaterThan(0)
      expect(entry.model.length).toBeGreaterThan(0)
      expect(entry.icaoTypeDesignator.length).toBeGreaterThan(0)
    }
  })

  // @UT-AC-VIEW-003@ (FROM: @IMP-AC-VIEW-001@)
  it('CATALOGUE_VERSION is a non-empty string', () => {
    expect(typeof CATALOGUE_VERSION).toBe('string')
    expect(CATALOGUE_VERSION.length).toBeGreaterThan(0)
  })
})

describe('getManufacturers (extended)', () => {
  // @UT-AC-VIEW-004@ (FROM: @IMP-AC-VIEW-001@)
  it('returns a list containing all unique manufacturers from the catalogue', () => {
    const result = getManufacturers()
    expect(result).toContain('Cessna')
    expect(result).toContain('Piper')
    expect(result).toContain('Diamond')
    expect(result).toContain('Tecnam')
    expect(result).toContain('Robin')
  })

  // @UT-AC-VIEW-005@ (FROM: @IMP-AC-VIEW-001@)
  it("appends 'Other' as the last entry (REQ-UI-002)", () => {
    const result = getManufacturers()
    expect(result[result.length - 1]).toBe('Other')
  })

  // @UT-AC-VIEW-006@ (FROM: @IMP-AC-VIEW-001@)
  it('returns manufacturers in alphabetical order before Other', () => {
    const result = getManufacturers()
    const withoutOther = result.slice(0, -1)
    const sorted = [...withoutOther].sort()
    expect(withoutOther).toEqual(sorted)
  })

  // @UT-AC-VIEW-007@ (FROM: @IMP-AC-VIEW-001@)
  it('does not contain duplicates', () => {
    const result = getManufacturers()
    const unique = new Set(result)
    expect(result.length).toBe(unique.size)
  })
})

describe('getModelsByManufacturer (extended)', () => {
  // @UT-AC-VIEW-008@ (FROM: @IMP-AC-VIEW-001@)
  it('returns all Cessna models from the catalogue', () => {
    const result = getModelsByManufacturer('Cessna')
    expect(result.length).toBeGreaterThan(0)
    for (const entry of result) {
      expect(entry.manufacturer).toBe('Cessna')
    }
  })

  // @UT-AC-VIEW-009@ (FROM: @IMP-AC-VIEW-001@)
  it('returns only models matching the requested manufacturer', () => {
    const result = getModelsByManufacturer('Piper')
    for (const entry of result) {
      expect(entry.manufacturer).toBe('Piper')
    }
    expect(result.some((e) => e.manufacturer === 'Cessna')).toBe(false)
  })

  // @UT-AC-VIEW-010@ (FROM: @IMP-AC-VIEW-001@)
  it("returns an empty array for manufacturer = 'Other' (manual entry mode, REQ-UI-002)", () => {
    const result = getModelsByManufacturer('Other')
    expect(result).toEqual([])
  })

  // @UT-AC-VIEW-011@ (FROM: @IMP-AC-VIEW-001@)
  it('returns an empty array for an unknown manufacturer', () => {
    const result = getModelsByManufacturer('NonExistentOEM')
    expect(result).toEqual([])
  })

  // @UT-AC-VIEW-012@ (FROM: @IMP-AC-VIEW-001@)
  it('each returned entry contains the expected fields', () => {
    const result = getModelsByManufacturer('Diamond')
    for (const entry of result) {
      expect(typeof entry.manufacturer).toBe('string')
      expect(typeof entry.model).toBe('string')
      expect(typeof entry.icaoTypeDesignator).toBe('string')
    }
  })

  // @UT-AC-VIEW-013@ (FROM: @IMP-AC-VIEW-001@)
  it('Diamond has DA40 Diamond Star in its model list', () => {
    const result = getModelsByManufacturer('Diamond')
    const models = result.map((e) => e.model)
    expect(models).toContain('DA40 Diamond Star')
  })
})

describe('findByIcaoDesignator (extended)', () => {
  // @UT-AC-VIEW-014@ (FROM: @IMP-AC-VIEW-001@)
  it('returns the correct entry for a known ICAO designator (C172)', () => {
    const result = findByIcaoDesignator('C172')
    expect(result.length).toBeGreaterThan(0)
    const designators = result.map((e) => e.icaoTypeDesignator)
    expect(designators.every((d) => d === 'C172')).toBe(true)
  })

  // @UT-AC-VIEW-015@ (FROM: @IMP-AC-VIEW-001@)
  it('performs case-insensitive lookup (lowercase input)', () => {
    const upperResult = findByIcaoDesignator('C172')
    const lowerResult = findByIcaoDesignator('c172')
    expect(lowerResult).toEqual(upperResult)
  })

  // @UT-AC-VIEW-016@ (FROM: @IMP-AC-VIEW-001@)
  it('trims whitespace before lookup', () => {
    const result = findByIcaoDesignator('  C172  ')
    expect(result.length).toBeGreaterThan(0)
  })

  // @UT-AC-VIEW-017@ (FROM: @IMP-AC-VIEW-001@)
  it('returns an empty array for an unknown ICAO designator', () => {
    const result = findByIcaoDesignator('ZZZZ')
    expect(result).toEqual([])
  })

  // @UT-AC-VIEW-018@ (FROM: @IMP-AC-VIEW-001@)
  it('returns multiple entries when multiple models share an ICAO designator (PA28)', () => {
    const result = findByIcaoDesignator('PA28')
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  // @UT-AC-VIEW-019@ (FROM: @IMP-AC-VIEW-001@)
  it('reverse lookup returns correct manufacturer for P208 (Tecnam)', () => {
    const result = findByIcaoDesignator('P208')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.manufacturer).toBe('Tecnam')
    expect(result[0]!.model).toBe('P2008 JC')
  })

  // @UT-AC-VIEW-020@ (FROM: @IMP-AC-VIEW-001@)
  it('reverse lookup returns correct manufacturer for DA40 (Diamond)', () => {
    const result = findByIcaoDesignator('DA40')
    expect(result.length).toBe(1)
    expect(result[0]!.manufacturer).toBe('Diamond')
    expect(result[0]!.model).toBe('DA40 Diamond Star')
  })
})

describe('ICAO auto-fill from catalogue entry (REQ-UI-003)', () => {
  // @UT-AC-VIEW-021@ (FROM: @IMP-AC-VIEW-001@)
  it('selecting Cessna C172S Skyhawk SP auto-fills C172 as ICAO designator', () => {
    const models = getModelsByManufacturer('Cessna')
    const entry = models.find((e) => e.model === 'C172S Skyhawk SP')
    expect(entry).toBeDefined()
    expect(entry!.icaoTypeDesignator).toBe('C172')
  })

  // @UT-AC-VIEW-022@ (FROM: @IMP-AC-VIEW-001@)
  it('selecting Piper PA-44-180 Seminole auto-fills PA44 as ICAO designator', () => {
    const models = getModelsByManufacturer('Piper')
    const entry = models.find((e) => e.model === 'PA-44-180 Seminole')
    expect(entry).toBeDefined()
    expect(entry!.icaoTypeDesignator).toBe('PA44')
  })
})

describe("'Other' manufacturer triggers manual entry (REQ-UI-002)", () => {
  // @UT-AC-VIEW-023@ (FROM: @IMP-AC-VIEW-001@)
  it("getManufacturers includes 'Other' as an option", () => {
    expect(getManufacturers()).toContain('Other')
  })

  // @UT-AC-VIEW-024@ (FROM: @IMP-AC-VIEW-001@)
  it("getModelsByManufacturer('Other') returns empty to signal free-text mode", () => {
    expect(getModelsByManufacturer('Other')).toHaveLength(0)
  })
})

// ─── Battery-electric support (REQ-AD-020, REQ-AD-021) ─────────────────────
// @UT-AC-VIEW-025@ (FROM: @IMP-AC-VIEW-001@)
describe('Pipistrel Velis Electro (PIVE) catalogue entry', () => {
  it('lists Pipistrel as a known manufacturer', () => {
    expect(getManufacturers()).toContain('Pipistrel')
  })

  it("includes the Velis Electro model under Pipistrel's models", () => {
    const models = getModelsByManufacturer('Pipistrel')
    expect(models.map((e) => e.model)).toContain('Velis Electro')
  })

  it('Velis Electro uses the PIVE ICAO type designator', () => {
    const entry = findUniqueByIcaoDesignator('PIVE')
    expect(entry).not.toBeNull()
    expect(entry!.manufacturer).toBe('Pipistrel')
    expect(entry!.model).toBe('Velis Electro')
  })

  it('Velis Electro carries an electric powertrain hint', () => {
    const models = getModelsByManufacturer('Pipistrel')
    const entry = models.find((e) => e.model === 'Velis Electro')
    expect(entry).toBeDefined()
    expect(entry!.powertrain).toBe('electric')
  })
})

describe('getPowertrainHintFor (powertrain lookup helper)', () => {
  it('returns "electric" for Pipistrel Velis Electro', () => {
    expect(getPowertrainHintFor('Pipistrel', 'Velis Electro')).toBe('electric')
  })

  it('returns undefined for legacy combustion entries with no explicit hint', () => {
    expect(getPowertrainHintFor('Cessna', 'C152')).toBeUndefined()
  })

  it('returns undefined for the Other manufacturer', () => {
    expect(getPowertrainHintFor('Other', 'Custom Experimental')).toBeUndefined()
  })

  it('returns undefined when the (manufacturer, model) pair is not in the catalogue', () => {
    expect(getPowertrainHintFor('Cessna', 'Not A Real Model')).toBeUndefined()
  })
})
