import { describe, expect, it } from 'vitest'
import { compareAirportSource, ingestAirportSource, scanAirportSources, selectAirportSource } from './airport-source'

// Synthetic fixture: no provider or airport data is represented.
const record = {
  provider: 'Synthetic', dataset: 'fixture', version: '1', recordId: 'r1', jurisdiction: 'test',
  aerodrome: 'TEST', runway: '09', publicationDate: '2026-01-01', effectiveDate: '2026-01-29',
  expiryDate: '2026-03-01', superseded: null, restrictionCoverage: null,
  tora: { value: 900, unit: 'm' }, lda: { value: 2000, unit: 'ft' },
}

describe('airport source ingestion', () => {
  it('preserves source values and separates temporal status from verification', () => {
    expect(ingestAirportSource(record, '2026-01-29')).toEqual({ status: 'valid', source: record, temporalStatus: 'within-declared-dates', verification: { tora: 'unverified', lda: 'unverified' } })
    expect(ingestAirportSource(record, '2026-01-28')).toMatchObject({ temporalStatus: 'not-yet-effective' })
    expect(ingestAirportSource(record, '2026-03-01')).toMatchObject({ temporalStatus: 'within-declared-dates' })
    expect(ingestAirportSource(record, '2026-03-02')).toMatchObject({ temporalStatus: 'expired' })
    expect(ingestAirportSource({ ...record, superseded: true }, '2026-02-01')).toMatchObject({ temporalStatus: 'superseded' })
  })

  it('keeps absent metadata and distances unknown without deriving values', () => {
    expect(ingestAirportSource({ ...record, expiryDate: null, tora: null }, '2026-02-26')).toMatchObject({ temporalStatus: 'unknown', verification: { tora: 'unknown', lda: 'unverified' } })
    expect(ingestAirportSource({ ...record, effectiveDate: null, superseded: false, restrictionCoverage: 'NOTAM unknown', lda: null }, '2026-02-26')).toMatchObject({ temporalStatus: 'unknown', verification: { tora: 'unverified', lda: 'unknown' } })
  })

  it('rejects malformed, conflicting and unsupported input', () => {
    for (const bad of [null, { ...record, expiryDate: '2026-01-01' }, { ...record, tora: { value: -1, unit: 'm' } }, { ...record, extra: true }, { ...record, effectiveDate: '2026-02-30' }, { ...record, restrictionCoverage: '   ' }]) {
      expect(ingestAirportSource(bad, '2026-02-01')).toEqual({ status: 'invalid' })
    }
    expect(ingestAirportSource(record, 'invalid')).toEqual({ status: 'invalid' })
  })
})

describe('airport source scan', () => {
  it('retains each record and its failure or temporal state independently', () => {
    const result = scanAirportSources([record, { ...record, expiryDate: null }, { ...record, superseded: true }, { ...record, tora: -1 }], '2026-03-02')
    expect(result.status).toBe('scanned')
    if (result.status !== 'scanned') throw new Error('Expected scan')
    expect(result.records).toMatchObject([
      { status: 'valid', temporalStatus: 'expired', verification: { tora: 'unverified' } },
      { status: 'valid', temporalStatus: 'unknown' },
      { status: 'valid', temporalStatus: 'superseded' },
      { status: 'invalid' },
    ])
  })

  it('rejects absent, empty or invalid scan input', () => {
    expect(scanAirportSources([], '2026-03-02')).toEqual({ status: 'invalid' })
    expect(scanAirportSources(null, '2026-03-02')).toEqual({ status: 'invalid' })
    expect(scanAirportSources([record], 'invalid')).toEqual({ status: 'invalid' })
  })
})


describe('airport source comparison', () => {
  it('reports changed values and provenance while keeping incoming values unverified', () => {
    const incoming = { ...record, version: '2', expiryDate: null, tora: { value: 901, unit: 'm' } }
    expect(compareAirportSource(record, incoming, '2026-02-01')).toMatchObject({
      status: 'compared', changed: ['version', 'expiryDate', 'tora'],
      incoming: { source: incoming, temporalStatus: 'unknown', verification: { tora: 'unverified', lda: 'unverified' } },
    })
    expect(compareAirportSource(record, { ...record, tora: { unit: 'm', value: 900 } }, '2026-02-01')).toMatchObject({ status: 'compared', changed: [] })
  })

  it('rejects invalid inputs and does not compare different identities', () => {
    expect(compareAirportSource(record, { ...record, recordId: 'other' }, '2026-02-01')).toEqual({ status: 'different-record' })
    expect(compareAirportSource(record, { ...record, lda: -1 }, '2026-02-01')).toEqual({ status: 'invalid' })
    expect(compareAirportSource(record, record, 'bad')).toEqual({ status: 'invalid' })
  })
})

describe('airport source selection', () => {
  it('selects an exact runway and retains its source, temporal and verification states', () => {
    expect(selectAirportSource([record, { ...record, runway: '27' }], 'TEST', '09', '2026-03-02')).toMatchObject({
      status: 'selected', record: { source: record, temporalStatus: 'expired', verification: { tora: 'unverified', lda: 'unverified' } },
    })
    expect(selectAirportSource([{ ...record, expiryDate: null, tora: null }], 'TEST', '09', '2026-02-01')).toMatchObject({
      record: { temporalStatus: 'unknown', verification: { tora: 'unknown', lda: 'unverified' } },
    })
  })

  it('distinguishes missing, ambiguous and invalid data without guessing', () => {
    expect(selectAirportSource([record], 'TEST', '27', '2026-02-01')).toEqual({ status: 'not-found' })
    expect(selectAirportSource([record, { ...record, provider: 'Other' }], 'TEST', '09', '2026-02-01')).toEqual({ status: 'ambiguous' })
    expect(selectAirportSource([record, { ...record, lda: -1 }], 'TEST', '09', '2026-02-01')).toEqual({ status: 'invalid' })
    expect(selectAirportSource([record], ' ', '09', '2026-02-01')).toEqual({ status: 'invalid' })
    expect(selectAirportSource([record], 'TEST', '09', 'bad')).toEqual({ status: 'invalid' })
  })
})
