import { recoverManualRunwayRecord, type ManualRunwayRecord } from '@/core/logic/manual-runway'

export const RECENT_AIRPORTS_KEY = 'aerodash.performance.recent-airports.v1'

function sameRunway(a: ManualRunwayRecord, b: ManualRunwayRecord): boolean {
  return a.runway.aerodrome.toLowerCase() === b.runway.aerodrome.toLowerCase()
    && a.runway.designator.toLowerCase() === b.runway.designator.toLowerCase()
}

const MAX_RECENT_AIRPORTS = 5

// The cap counts distinct aerodromes; every runway direction saved for a kept aerodrome stays.
function limitToRecentAirports(records: ManualRunwayRecord[]): ManualRunwayRecord[] {
  const kept = new Set<string>()
  return records.filter((record) => {
    const aerodrome = record.runway.aerodrome.toLowerCase()
    if (!kept.has(aerodrome) && kept.size >= MAX_RECENT_AIRPORTS) return false
    kept.add(aerodrome)
    return true
  })
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
    return limitToRecentAirports(records)
  } catch { return null }
}

export function loadRecentAirports(): ManualRunwayRecord[] | null {
  return readRecentAirports()
}

export function saveRecentAirport(record: ManualRunwayRecord): ManualRunwayRecord[] | null {
  const existing = readRecentAirports()
  if (!existing) return null
  const records = limitToRecentAirports([record, ...existing.filter((item) => !sameRunway(item, record))])
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
