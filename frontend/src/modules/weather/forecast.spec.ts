import { describe, expect, it } from 'vitest'
import { parseForecast } from './forecast'

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
