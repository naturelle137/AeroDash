import { beforeEach, expect, it, vi } from 'vitest'
import { AIRPORT_SOURCE_STORAGE_KEY, loadAirportSources, saveAirportSources } from './airport-source.repository'

const source = {
  provider: 'Synthetic', dataset: 'fixture', version: '1', recordId: '1', jurisdiction: 'test',
  aerodrome: 'TEST', runway: '09', publicationDate: null, effectiveDate: '2026-01-01',
  expiryDate: '2026-01-31', superseded: null, restrictionCoverage: null,
  tora: { value: 900, unit: 'm' }, lda: null,
}
const exchange = JSON.stringify({ format: 'aerodash-airport-sources', version: 1, records: [{ schemaVersion: 1, retrievedAt: '2026-01-02T00:00:00Z', source, verification: { tora: 'verified' }, temporalStatus: 'fresh' }] })

beforeEach(() => localStorage.clear())

it('persists provenance and reassesses unverified data on each load', () => {
  expect(loadAirportSources('2026-01-20')).toEqual({ status: 'empty' })
  expect(saveAirportSources(exchange, '2026-01-20')).toEqual({ status: 'saved' })
  expect(localStorage.getItem(AIRPORT_SOURCE_STORAGE_KEY)).not.toContain('verified')
  expect(loadAirportSources('2026-02-01')).toMatchObject({ status: 'parsed', records: [{ source, temporalStatus: 'expired', verification: { tora: 'unverified', lda: 'unknown' } }] })
})

it('preserves stored data on invalid input, damaged storage and write failure', () => {
  expect(saveAirportSources(exchange, '2026-01-20').status).toBe('saved')
  const saved = localStorage.getItem(AIRPORT_SOURCE_STORAGE_KEY)
  expect(saveAirportSources('{', '2026-01-20').status).toBe('invalid')
  expect(localStorage.getItem(AIRPORT_SOURCE_STORAGE_KEY)).toBe(saved)
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable') })
  expect(saveAirportSources(exchange, '2026-01-20').status).toBe('unavailable')
  write.mockRestore()
  expect(localStorage.getItem(AIRPORT_SOURCE_STORAGE_KEY)).toBe(saved)
  localStorage.setItem(AIRPORT_SOURCE_STORAGE_KEY, '{')
  expect(saveAirportSources(exchange, '2026-01-20').status).toBe('invalid')
  expect(localStorage.getItem(AIRPORT_SOURCE_STORAGE_KEY)).toBe('{')
})
