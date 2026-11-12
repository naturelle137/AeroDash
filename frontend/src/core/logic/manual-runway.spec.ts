import { describe, expect, it } from 'vitest'
import {
  EMPTY_MANUAL_RUNWAY_DRAFT,
  MANUAL_RUNWAY_RECORD_VERSION,
  createManualRunwayRecord,
  draftFromManualRunway,
  formatNormalizedManualRunway,
  normalizeManualRunway,
  recoverManualRunwayRecord,
  sameManualRunway,
  validateManualRunway,
  type ManualRunway,
  type ManualRunwayDraft,
} from './manual-runway'
import { FT_TO_M } from './unit-conversion-constants'

// Synthetic runway; not a real aerodrome or published declaration.
const draft = (patch: Partial<ManualRunwayDraft> = {}): ManualRunwayDraft => ({
  aerodrome: 'TEST', designator: '09L', tora: '1000', toraUnit: 'ft', lda: '600', ldaUnit: 'm',
  fieldElevation: '-30.48', fieldElevationUnit: 'm', surfaceType: 'unpaved', surfaceCondition: 'long-grass', ...patch,
})
function valid(input: ManualRunwayDraft): ManualRunway {
  const result = validateManualRunway(input)
  if (result.status !== 'valid') throw new Error(JSON.stringify(result.errors))
  return result.runway
}

describe('validateManualRunway', () => {
  it('keeps distinct original TORA/LDA values and explicit units', () => {
    expect(valid(draft({ aerodrome: '  TEST  ', designator: ' 09L ' }))).toEqual({
      aerodrome: 'TEST', designator: '09L',
      tora: { value: 1000, unit: 'ft' }, lda: { value: 600, unit: 'm' },
      fieldElevation: { value: -30.48, unit: 'm' },
      surface: { type: 'unpaved', condition: 'long-grass' },
    })
  })

  it('reports every missing field of an empty form and never fills defaults', () => {
    const result = validateManualRunway({ ...EMPTY_MANUAL_RUNWAY_DRAFT })
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(Object.keys(result.errors).sort()).toEqual([
      'aerodrome', 'designator', 'fieldElevation', 'fieldElevationUnit', 'lda', 'ldaUnit',
      'surfaceCondition', 'surfaceType', 'tora', 'toraUnit',
    ])
  })

  it.each([
    ['tora', ''], ['tora', '   '], ['tora', '0'], ['tora', '-1'], ['tora', '-0'], ['tora', 'NaN'],
    ['tora', 'Infinity'], ['tora', '1e400'], ['tora', '0x10'], ['tora', '1,000'], ['tora', '12 m'],
    ['lda', ''], ['lda', '0'], ['lda', '-600'], ['lda', 'abc'], ['lda', '-Infinity'],
  ] as const)('rejects %s = %j', (field, value) => {
    const result = validateManualRunway(draft({ [field]: value }))
    expect(result.status === 'invalid' && result.errors[field]).toBeTruthy()
  })

  it.each([
    ['toraUnit', ''], ['toraUnit', 'yd'], ['toraUnit', 'M'], ['ldaUnit', 'km'], ['ldaUnit', ''],
    ['fieldElevationUnit', ''], ['fieldElevationUnit', 'FL'],
  ] as const)('rejects unsupported unit %s = %j', (field, value) => {
    const result = validateManualRunway(draft({ [field]: value }))
    expect(result.status === 'invalid' && result.errors[field]).toBeTruthy()
  })

  it.each(['0', '-0', '-1378', '+12.5', '1.5e3'])('accepts finite field elevation %j, including zero and negative', (value) => {
    expect(valid(draft({ fieldElevation: value })).fieldElevation.value).toBe(Number(value))
  })

  it.each(['', 'NaN', 'Infinity', '1e999', 'ten'])('rejects nonfinite or empty field elevation %j', (value) => {
    const result = validateManualRunway(draft({ fieldElevation: value }))
    expect(result.status === 'invalid' && result.errors.fieldElevation).toBeTruthy()
  })

  it('requires an explicit surface type and a condition belonging to that type', () => {
    for (const patch of [
      { surfaceType: '', surfaceCondition: '' },
      { surfaceType: 'paved', surfaceCondition: '' },
      { surfaceType: 'paved', surfaceCondition: 'long-grass' },
      { surfaceType: 'unpaved', surfaceCondition: 'wet' },
      { surfaceType: 'water', surfaceCondition: 'wet' },
    ]) {
      const result = validateManualRunway(draft(patch))
      expect(result.status === 'invalid' && result.errors.surfaceCondition).toBeTruthy()
    }
    expect(valid(draft({ surfaceType: 'paved', surfaceCondition: 'standing-water' })).surface).toEqual({ type: 'paved', condition: 'standing-water' })
  })

  it('rejects overlong or control-character identities', () => {
    for (const patch of [{ aerodrome: 'x'.repeat(41) }, { designator: 'x'.repeat(21) }, { designator: '09\nL' }]) {
      expect(validateManualRunway(draft(patch)).status).toBe('invalid')
    }
  })
})

describe('normalizeManualRunway', () => {
  // NIST SP 811 Appendix B.9: 1 ft = 0.3048 m exactly. Independent arithmetic vectors only.
  it.each([
    [{ tora: '1000', toraUnit: 'ft', lda: '1000', ldaUnit: 'm', fieldElevation: '1000', fieldElevationUnit: 'ft' }, 304.8, 1000, 304.8, 1000],
    [{ tora: '304.8', toraUnit: 'm', lda: '3280', ldaUnit: 'ft', fieldElevation: '-30.48', fieldElevationUnit: 'm' }, 304.8, 999.744, -30.48, -100],
    [{ tora: '1', toraUnit: 'ft', lda: '1', ldaUnit: 'ft', fieldElevation: '0', fieldElevationUnit: 'm' }, 0.3048, 0.3048, 0, 0],
  ] as const)('converts each value independently %#', (patch, toraM, ldaM, elevationM, elevationFt) => {
    const normalized = normalizeManualRunway(valid(draft(patch)))!
    expect(normalized.toraM).toBeCloseTo(toraM, 9)
    expect(normalized.ldaM).toBeCloseTo(ldaM, 9)
    expect(normalized.fieldElevationM).toBeCloseTo(elevationM, 9)
    expect(normalized.fieldElevationFt).toBeCloseTo(elevationFt, 9)
  })

  it('rejects conversions overflowing to nonfinite values', () => {
    expect(normalizeManualRunway(valid(draft({ tora: '1.7e308', toraUnit: 'ft' })))).not.toBeNull()
    const huge = valid(draft({ fieldElevation: '1.7976931348623157e308', fieldElevationUnit: 'm' }))
    expect(huge.fieldElevation.value / FT_TO_M).toBe(Infinity)
    expect(normalizeManualRunway(huge)).toBeNull()
  })

  it('formats available distances down and elevation to nearest without negative zero', () => {
    const display = formatNormalizedManualRunway({ toraM: 1000 * FT_TO_M, ldaM: 999.99, fieldElevationM: -0.04, fieldElevationFt: -100.05 })
    expect(display).toEqual({ toraM: '304.8', ldaM: '999.9', fieldElevationM: '0.0', fieldElevationFt: '-100.0' })
    expect(formatNormalizedManualRunway({ toraM: 3280 * FT_TO_M, ldaM: 0.3048, fieldElevationM: 1, fieldElevationFt: 1 }).toraM).toBe('999.7')
  })
})

describe('storage record recovery', () => {
  const runway = valid(draft())
  const record = createManualRunwayRecord(runway, new Date('2026-11-12T10:00:00.000Z'))

  it('round-trips original values, units and version', () => {
    expect(record.schemaVersion).toBe(MANUAL_RUNWAY_RECORD_VERSION)
    const recovered = recoverManualRunwayRecord(JSON.stringify(record))
    expect(recovered).toEqual({ status: 'loaded', record })
    expect(draftFromManualRunway(runway)).toEqual(draft())
    expect(sameManualRunway(valid(draftFromManualRunway(runway)), runway)).toBe(true)
  })

  it('distinguishes empty, corrupt and future records', () => {
    expect(recoverManualRunwayRecord(null)).toEqual({ status: 'empty' })
    expect(recoverManualRunwayRecord('{not json')).toEqual({ status: 'corrupt' })
    expect(recoverManualRunwayRecord('null')).toEqual({ status: 'corrupt' })
    expect(recoverManualRunwayRecord(JSON.stringify({ ...record, schemaVersion: 2 }))).toEqual({ status: 'unsupported-version', schemaVersion: 2 })
    expect(recoverManualRunwayRecord(JSON.stringify({ ...record, schemaVersion: 0 }))).toEqual({ status: 'corrupt' })
  })

  it.each([
    ['zero TORA', { tora: { value: 0, unit: 'm' } }],
    ['negative LDA', { lda: { value: -1, unit: 'm' } }],
    ['unsupported unit', { lda: { value: 600, unit: 'yd' } }],
    ['missing surface', { surface: undefined }],
    ['mismatched condition', { surface: { type: 'paved', condition: 'long-grass' } }],
    ['string elevation', { fieldElevation: { value: '12', unit: 'm' } }],
    ['extra field', { slope: 1 }],
    ['untrimmed identity', { designator: ' 09L' }],
  ])('rejects stored %s', (_name, patch) => {
    const tampered = { ...record, runway: { ...record.runway, ...patch } }
    expect(recoverManualRunwayRecord(JSON.stringify(tampered))).toEqual({ status: 'corrupt' })
  })

  it('rejects invalid timestamps', () => {
    expect(recoverManualRunwayRecord(JSON.stringify({ ...record, savedAt: 'yesterday' }))).toEqual({ status: 'corrupt' })
  })
})
