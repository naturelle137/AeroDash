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

export function parseGlobalForecast(data: unknown, selected: number): { values: MetarValues; latitude: number; longitude: number } | null {
  if (!data || typeof data !== 'object') throw new Error('malformed')
  const d = data as Record<string, unknown>
  if (typeof d.latitude !== 'number' || !Number.isFinite(d.latitude) || d.latitude < -90 || d.latitude > 90 || typeof d.longitude !== 'number' || !Number.isFinite(d.longitude) || d.longitude < -180 || d.longitude > 180) throw new Error('malformed')
  if (d.utc_offset_seconds !== 0 || !d.hourly || typeof d.hourly !== 'object' || !d.hourly_units || typeof d.hourly_units !== 'object') throw new Error('malformed')
  const units = d.hourly_units as Record<string, unknown>
  if (units.time !== 'iso8601' || units.temperature_2m !== '°C' || units.wind_speed_10m !== 'kn' || units.wind_direction_10m !== '°') throw new Error('malformed')
  const h = d.hourly as Record<string, unknown>
  const times = h.time
  const temperatures = h.temperature_2m
  const speeds = h.wind_speed_10m
  const directions = h.wind_direction_10m
  if (!Array.isArray(times) || !Array.isArray(temperatures) || !Array.isArray(speeds) || !Array.isArray(directions) || [temperatures, speeds, directions].some(a => a.length !== times.length)) throw new Error('malformed')
  if (times.some(t => typeof t !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:00$/.test(t) || !Number.isFinite(Date.parse(`${t}Z`)))) throw new Error('malformed')
  const index = times.findIndex(t => Date.parse(`${t}Z`) === selected)
  if (index < 0) return null
  const values: MetarValues = {}
  const temp: unknown = temperatures[index], speed: unknown = speeds[index], direction: unknown = directions[index]
  if (typeof temp === 'number' && Number.isFinite(temp) && temp >= -100 && temp <= 100) values.temperature = String(temp)
  if (typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 && speed <= 200 && (speed === 0 || (typeof direction === 'number' && Number.isFinite(direction) && direction >= 0 && direction <= 360))) {
    values.wind = { speed: String(speed), direction: speed === 0 ? '' : String(direction === 0 ? 360 : direction), unit: 'kt' }
  }
  return { values, latitude: d.latitude, longitude: d.longitude }
}
