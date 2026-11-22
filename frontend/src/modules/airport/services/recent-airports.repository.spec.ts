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
  it('preserves separate runway directions and their declared source dates', () => {
    const first = createManualRunwayRecord({ ...runway, source: 'Chart A', expiryDate: '2026-01-31' }, new Date('2026-01-01T00:00:00Z'))
    const second = createManualRunwayRecord({ ...runway, designator: '27', source: 'Chart B', expiryDate: '2026-02-28' }, new Date('2026-01-02T00:00:00Z'))
    saveRecentAirport(first)
    saveRecentAirport(second)
    expect(loadRecentAirports()).toEqual([second, first])
    saveRecentAirport({ ...first, runway: { ...first.runway, aerodrome: 'a' } })
    expect(loadRecentAirports().map(item => item.runway.designator)).toEqual(['09', '27'])
  })
  it.each(['{', '{}', '[null]', '[{"schemaVersion":999}]'])('ignores malformed history %s', (raw) => {
    localStorage.setItem(RECENT_AIRPORTS_KEY, raw)
    expect(loadRecentAirports()).toEqual([])
  })
})
