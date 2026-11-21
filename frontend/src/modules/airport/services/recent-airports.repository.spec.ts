import { beforeEach, describe, expect, it } from 'vitest'
import { createManualRunwayRecord, type ManualRunway } from '@/core/logic/manual-runway'
import { loadRecentAirports, RECENT_AIRPORTS_KEY, saveRecentAirport } from './recent-airports.repository'

const runway: ManualRunway = { aerodrome: 'A', designator: '09', tora: { value: 1000, unit: 'm' }, lda: { value: 900, unit: 'm' }, fieldElevation: { value: 0, unit: 'ft' }, surface: { type: 'paved', condition: 'dry' } }
const record = (aerodrome: string) => createManualRunwayRecord({ ...runway, aerodrome }, new Date('2026-01-01T00:00:00Z'))

beforeEach(() => localStorage.clear())
describe('recent airports', () => {
  it('persists five unique airports in use order', () => {
    for (const name of ['A', 'B', 'C', 'D', 'E', 'F', 'c']) saveRecentAirport(record(name))
    expect(loadRecentAirports().map((item) => item.runway.aerodrome)).toEqual(['c', 'F', 'E', 'D', 'B'])
  })
  it.each(['{', '{}', '[null]', '[{"schemaVersion":999}]'])('ignores malformed history %s', (raw) => {
    localStorage.setItem(RECENT_AIRPORTS_KEY, raw)
    expect(loadRecentAirports()).toEqual([])
  })
})
