import { describe, expect, it } from 'vitest'
import { checkAirportSourceTransitions, compareAirportSource, compareAirportSourceBatches, compareAirportSourceSnapshots, ingestAirportSource, scanAirportSources, selectAirportSource } from './airport-source'

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

describe('airport source snapshot comparison', () => {
  it('reports changes and temporal transitions between supplied snapshots', () => {
    const revised = { ...record, version: '2', expiryDate: null }
    const unchanged = { ...record, recordId: 'unchanged', runway: '27' }
    const added = { ...record, recordId: 'added', runway: '18' }
    expect(compareAirportSourceSnapshots([record, unchanged], [revised, unchanged, added], '2026-02-01', '2026-03-02')).toMatchObject({
      status: 'compared', changed: [{ changed: ['version', 'expiryDate'] }], added: [{ source: added }], removed: [],
      transitions: [
        { previousStatus: 'within-declared-dates', record: { source: revised, temporalStatus: 'unknown', verification: { tora: 'unverified' } } },
        { previousStatus: 'within-declared-dates', record: { source: unchanged, temporalStatus: 'expired' } },
      ],
    })
  })

  it('rejects invalid dates, inputs and duplicate identities', () => {
    expect(compareAirportSourceSnapshots([record], [record], 'bad', '2026-03-02')).toEqual({ status: 'invalid' })
    expect(compareAirportSourceSnapshots([record], [record], '2026-03-02', '2026-02-01')).toEqual({ status: 'invalid' })
    expect(compareAirportSourceSnapshots([record], [{ ...record, lda: -1 }], '2026-02-01', '2026-03-02')).toEqual({ status: 'invalid' })
    expect(compareAirportSourceSnapshots([record, record], [record], '2026-02-01', '2026-03-02')).toEqual({ status: 'ambiguous' })
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

describe('airport source temporal transitions', () => {
  it('reports only source-supported state changes while retaining unverified provenance', () => {
    const unknown = { ...record, recordId: 'unknown', effectiveDate: null, expiryDate: null }
    const superseded = { ...record, recordId: 'superseded', superseded: true }
    expect(checkAirportSourceTransitions([record, unknown, superseded], '2026-01-28', '2026-03-02')).toMatchObject({
      status: 'checked', transitions: [{ previousStatus: 'not-yet-effective', record: { source: record, temporalStatus: 'expired', verification: { tora: 'unverified', lda: 'unverified' } } }],
    })
    expect(checkAirportSourceTransitions([record], '2026-02-25', '2026-02-27')).toEqual({ status: 'checked', transitions: [] })
    expect(checkAirportSourceTransitions([record], '2026-03-01', '2026-03-02')).toMatchObject({ transitions: [{ previousStatus: 'within-declared-dates', record: { temporalStatus: 'expired' } }] })
  })

  it('rejects invalid batches and dates, including reversed dates', () => {
    expect(checkAirportSourceTransitions([record, { ...record, lda: -1 }], '2026-02-01', '2026-03-02')).toEqual({ status: 'invalid' })
    expect(checkAirportSourceTransitions([], '2026-02-01', '2026-03-02')).toEqual({ status: 'invalid' })
    expect(checkAirportSourceTransitions([record], 'bad', '2026-03-02')).toEqual({ status: 'invalid' })
    expect(checkAirportSourceTransitions([record], '2026-03-02', '2026-02-01')).toEqual({ status: 'invalid' })
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

describe('airport source batch comparison', () => {
  it('reports additions, removals and changes with incoming verification and provenance', () => {
    const removed = { ...record, recordId: 'removed', runway: '27' }
    const added = { ...record, recordId: 'added', runway: '18', expiryDate: null }
    const revised = { ...record, version: '2', tora: { value: 901, unit: 'm' } }
    expect(compareAirportSourceBatches([record, removed], [revised, added], '2026-03-02')).toMatchObject({
      status: 'compared', added: [{ source: added, temporalStatus: 'unknown', verification: { tora: 'unverified', lda: 'unverified' } }], removed: [removed],
      changed: [{ changed: ['version', 'tora'], incoming: { source: revised, temporalStatus: 'expired', verification: { tora: 'unverified' } } }],
    })
    expect(compareAirportSourceBatches([record], [record], '2026-03-02')).toMatchObject({ status: 'compared', added: [], removed: [], changed: [] })
  })

  it('rejects invalid batches and duplicate identities rather than guessing', () => {
    expect(compareAirportSourceBatches([record], [{ ...record, lda: -1 }], '2026-02-01')).toEqual({ status: 'invalid' })
    expect(compareAirportSourceBatches([record, record], [record], '2026-02-01')).toEqual({ status: 'ambiguous' })
    expect(compareAirportSourceBatches([record], [record, record], '2026-02-01')).toEqual({ status: 'ambiguous' })
    expect(compareAirportSourceBatches([], [record], '2026-02-01')).toEqual({ status: 'invalid' })
    expect(compareAirportSourceBatches([record], [record], 'bad')).toEqual({ status: 'invalid' })
  })
})
