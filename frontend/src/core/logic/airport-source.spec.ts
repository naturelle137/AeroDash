import { describe, expect, it } from 'vitest'
import { ingestAirportSource, scanAirportSources } from './airport-source'

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
