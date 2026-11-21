import { recoverManualRunwayRecord, type ManualRunwayRecord } from '@/core/logic/manual-runway'

export const RECENT_AIRPORTS_KEY = 'aerodash.performance.recent-airports.v1'

export function loadRecentAirports(): ManualRunwayRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_AIRPORTS_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    const records: ManualRunwayRecord[] = []
    for (const item of value) {
      const result = recoverManualRunwayRecord(JSON.stringify(item))
      if (result.status !== 'loaded') return []
      if (!records.some((record) => record.runway.aerodrome.toLocaleLowerCase() === result.record.runway.aerodrome.toLocaleLowerCase())) records.push(result.record)
    }
    return records.slice(0, 5)
  } catch { return [] }
}

export function saveRecentAirport(record: ManualRunwayRecord): ManualRunwayRecord[] | null {
  const records = [record, ...loadRecentAirports().filter((item) => item.runway.aerodrome.toLocaleLowerCase() !== record.runway.aerodrome.toLocaleLowerCase())].slice(0, 5)
  try {
    localStorage.setItem(RECENT_AIRPORTS_KEY, JSON.stringify(records))
    return records
  } catch { return null }
}
