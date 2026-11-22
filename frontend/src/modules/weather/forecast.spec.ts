import { describe, expect, it } from 'vitest'
import { parseForecast, parseGlobalForecast } from './forecast'

const now = Date.parse('2030-01-01T00:00:00Z')
const data = { airportIdent: 'KDFW', freshness: { forecastFetchedAt: '2029-12-31T23:30:00Z', stale: false }, hourly: [{ time: '2029-12-31T20:00:00-06:00', tempF: 68, windDir: 'NNE', windSpeedKt: 10 }] }
describe('hourly forecast', () => {
  it('selects the exact UTC instant and converts Fahrenheit and compass wind', () => {
    expect(parseForecast(data, 'KDFW', Date.parse('2030-01-01T02:00:00Z'), now)).toEqual({ values: { temperature: '20', wind: { direction: '22.5', speed: '10', unit: 'kt' } }, valid: '2030-01-01T02:00:00.000Z', fetched: '2029-12-31T23:30:00.000Z', stale: false })
    expect(parseForecast(data, 'KDFW', Date.parse('2030-01-01T02:30:00Z'), now)).toBeNull()
  })
  it('rejects mismatched stations and malformed timestamps; marks stale data', () => {
    expect(() => parseForecast(data, 'EDDF', now, now)).toThrow('malformed')
    expect(() => parseForecast({ ...data, hourly: [{ time: 'bad' }] }, 'KDFW', now, now)).toThrow('malformed')
    expect(parseForecast({ ...data, freshness: { ...data.freshness, stale: true } }, 'KDFW', Date.parse('2030-01-01T02:00:00Z'), now)?.stale).toBe(true)
  })
})

describe('global model forecast', () => {
  const sample = { utc_offset_seconds: 0, hourly_units: { time: 'iso8601', temperature_2m: '°C', wind_speed_10m: 'kn', wind_direction_10m: '°' }, hourly: { time: ['2030-01-01T02:00'], temperature_2m: [12.3], wind_speed_10m: [10.2], wind_direction_10m: [0] } }
  it('matches an exact UTC hour and retains source units without inventing QNH', () => {
    expect(parseGlobalForecast(sample, Date.parse('2030-01-01T03:00+01:00'))).toEqual({ temperature: '12.3', wind: { direction: '360', speed: '10.2', unit: 'kt' } })
    expect(parseGlobalForecast(sample, Date.parse('2030-01-01T02:30Z'))).toBeNull()
  })
  it('rejects incorrect units and leaves unavailable values missing', () => {
    expect(() => parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_speed_10m: 'km/h' } }, Date.parse('2030-01-01T02:00Z'))).toThrow('malformed')
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, temperature_2m: [null], wind_direction_10m: [null] } }, Date.parse('2030-01-01T02:00Z'))).toEqual({})
  })
})
