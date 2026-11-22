import type { MetarValues } from './metar-values'

const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export function parseForecast(data: unknown, station: string, selected: number, now: number): { values: MetarValues; valid: string; fetched: string; stale: boolean } | null {
  if (!data || typeof data !== 'object') throw new Error('malformed')
  const d = data as Record<string, unknown>
  if (d.airportIdent !== station || !Array.isArray(d.hourly) || !d.freshness || typeof d.freshness !== 'object') throw new Error('malformed')
  if (d.hourly.length === 0) return null
  const freshness = d.freshness as Record<string, unknown>
  if (typeof freshness.forecastFetchedAt !== 'string' || typeof freshness.stale !== 'boolean') throw new Error('malformed')
  const fetched = Date.parse(freshness.forecastFetchedAt)
  if (!Number.isFinite(fetched) || fetched > now) throw new Error('malformed')
  const rows = d.hourly.map((item: unknown): Record<string, unknown> & { timestamp: number } => {
    if (!item || typeof item !== 'object') throw new Error('malformed')
    const row = item as Record<string, unknown>
    if (typeof row.time !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/.test(row.time) || !Number.isFinite(Date.parse(row.time))) throw new Error('malformed')
    return { ...row, timestamp: Date.parse(row.time) }
  })
  const row = rows.find(item => item.timestamp === selected)
  if (!row) return null
  const values: MetarValues = {}
  if (typeof row.tempF === 'number' && Number.isFinite(row.tempF) && row.tempF >= -148 && row.tempF <= 212) values.temperature = String(Math.round((row.tempF - 32) * 50 / 9) / 10)
  const direction = directions.indexOf(String(row.windDir))
  if (typeof row.windSpeedKt === 'number' && Number.isFinite(row.windSpeedKt) && row.windSpeedKt >= 0 && row.windSpeedKt <= 200 && (row.windSpeedKt === 0 || direction >= 0)) {
    values.wind = { direction: row.windSpeedKt === 0 ? '' : String(direction === 0 ? 360 : direction * 22.5), speed: String(row.windSpeedKt), unit: 'kt' }
  }
  return { values, valid: new Date(row.timestamp).toISOString(), fetched: new Date(fetched).toISOString(), stale: freshness.stale || now - fetched > 4 * 60 * 60 * 1000 }
}
