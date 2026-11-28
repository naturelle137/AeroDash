import { buildAirportSourceExchange, parseAirportSourceExchange } from '@/core/logic/airport-source'

export const AIRPORT_SOURCE_STORAGE_KEY = 'aerodash.airport.source-exchange.v1'

export function loadAirportSources(checkDate: string) {
  try {
    const raw = localStorage.getItem(AIRPORT_SOURCE_STORAGE_KEY)
    if (raw === null) return { status: 'empty' } as const
    return parseAirportSourceExchange(raw, checkDate)
  } catch {
    return { status: 'unavailable' } as const
  }
}

export function saveAirportSources(text: string, checkDate: string) {
  const incoming = parseAirportSourceExchange(text, checkDate)
  if (incoming.status !== 'parsed') return { status: 'invalid' } as const
  const existing = loadAirportSources(checkDate)
  if (existing.status === 'unavailable' || existing.status === 'invalid') return existing
  const sanitized = buildAirportSourceExchange(incoming.records.flatMap(record => record.status === 'restored' ? [{
    schemaVersion: 1, retrievedAt: record.retrievedAt, source: record.source,
  }] : []), checkDate)
  if (sanitized.status !== 'built') return { status: 'invalid' } as const
  try {
    localStorage.setItem(AIRPORT_SOURCE_STORAGE_KEY, sanitized.text)
    return { status: 'saved' } as const
  } catch {
    return { status: 'unavailable' } as const
  }
}
