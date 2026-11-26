import { recoverManualRunwayRecord, type ManualRunwayRecord } from '@/core/logic/manual-runway'

export const RECENT_AIRPORTS_KEY = 'aerodash.performance.recent-airports.v1'

function sameRunway(a: ManualRunwayRecord, b: ManualRunwayRecord): boolean {
  return a.runway.aerodrome.toLowerCase() === b.runway.aerodrome.toLowerCase()
    && a.runway.designator.toLowerCase() === b.runway.designator.toLowerCase()
}

function readRecentAirports(): ManualRunwayRecord[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_AIRPORTS_KEY) ?? '[]')
    if (!Array.isArray(value)) return null
    const records: ManualRunwayRecord[] = []
    for (const item of value) {
      const result = recoverManualRunwayRecord(JSON.stringify(item))
      if (result.status !== 'loaded') return null
      if (!records.some((record) => sameRunway(record, result.record))) records.push(result.record)
    }
    return records.slice(0, 5)
  } catch { return null }
}

export function loadRecentAirports(): ManualRunwayRecord[] {
  return readRecentAirports() ?? []
}

export function saveRecentAirport(record: ManualRunwayRecord): ManualRunwayRecord[] | null {
  const records = [record, ...loadRecentAirports().filter((item) => !sameRunway(item, record))].slice(0, 5)
  try {
    localStorage.setItem(RECENT_AIRPORTS_KEY, JSON.stringify(records))
    return records
  } catch { return null }
}

export function removeRecentAirport(record: ManualRunwayRecord): ManualRunwayRecord[] | null {
  const existing = readRecentAirports()
  if (!existing) return null
  const records = existing.filter((item) => !sameRunway(item, record))
  try {
    localStorage.setItem(RECENT_AIRPORTS_KEY, JSON.stringify(records))
    return records
  } catch { return null }
}
