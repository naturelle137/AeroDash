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
    expect(() => parseForecast({ ...data, hourly: [data.hourly[0], { ...data.hourly[0], time: '2030-01-01T02:00:00Z' }] }, 'KDFW', now, now)).toThrow('malformed')
    expect(parseForecast({ ...data, freshness: { ...data.freshness, stale: true } }, 'KDFW', Date.parse('2030-01-01T02:00:00Z'), now)?.stale).toBe(true)
  })
})

describe('global model forecast', () => {
  const sample = { latitude: 50.1, longitude: 8.1, utc_offset_seconds: 0, hourly_units: { time: 'iso8601', temperature_2m: '°C', dew_point_2m: '°C', wind_speed_10m: 'kn', wind_direction_10m: '°', wind_gusts_10m: 'kn', precipitation: 'mm', precipitation_probability: '%', cloud_cover: '%', visibility: 'm', freezing_level_height: 'm' }, hourly: { time: ['2030-01-01T02:00'], temperature_2m: [12.3], dew_point_2m: [8], wind_speed_10m: [10.2], wind_direction_10m: [0], wind_gusts_10m: [18], precipitation: [1.2], precipitation_probability: [40], cloud_cover: [75], visibility: [9000], freezing_level_height: [2400] } }
  it('matches an exact UTC hour and retains source units without inventing QNH', () => {
    expect(parseGlobalForecast(sample, Date.parse('2030-01-01T03:00+01:00'))).toEqual({ values: { temperature: '12.3', wind: { direction: '360', speed: '10.2', unit: 'kt' } }, precipitation: 1.2, dewPoint: 8, gust: 18, precipitationProbability: 40, cloudCover: 75, visibility: 9000, freezingLevel: 2400, latitude: 50.1, longitude: 8.1 })
    expect(parseGlobalForecast(sample, Date.parse('2030-01-01T02:30Z'))).toBeNull()
  })
  it('rejects incorrect units and leaves unavailable values missing', () => {
    expect(() => parseGlobalForecast({ ...sample, latitude: 91 }, Date.parse('2030-01-01T02:00Z'))).toThrow('malformed')
    expect(() => parseGlobalForecast({ ...sample, longitude: null }, Date.parse('2030-01-01T02:00Z'))).toThrow('malformed')
    expect(() => parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_gusts_10m: 'km/h' } }, now)).toThrow('malformed')
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, precipitation_probability: [101] } }, Date.parse('2030-01-01T02:00Z'))?.precipitationProbability).toBeNull()
    const at = Date.parse('2030-01-01T02:00Z')
    const { freezing_level_height: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ freezingLevel: null, dewPoint: 8, visibility: 9000 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, freezing_level_height: 'ft' } }, at)).toMatchObject({ freezingLevel: null, cloudCover: 75 })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, freezing_level_height: [null] } }, Date.parse('2030-01-01T02:00Z'))?.freezingLevel).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, freezing_level_height: [99999] } }, Date.parse('2030-01-01T02:00Z'))?.freezingLevel).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, precipitation: 'inch' } }, now)).toThrow('malformed')
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, precipitation: [-1] } }, Date.parse('2030-01-01T02:00Z'))?.precipitation).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, precipitation: [null] } }, Date.parse('2030-01-01T02:00Z'))?.precipitation).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, precipitation_probability: 'mm' } }, now)).toThrow('malformed')
    expect(() => parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, visibility: 'ft' } }, now)).toThrow('malformed')
    expect(() => parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, cloud_cover: 'okta' } }, now)).toThrow('malformed')
    expect(() => parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, dew_point_2m: '°F' } }, now)).toThrow('malformed')
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, dew_point_2m: [null] } }, Date.parse('2030-01-01T02:00Z'))?.dewPoint).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, dew_point_2m: [101] } }, Date.parse('2030-01-01T02:00Z'))?.dewPoint).toBeNull()
    const out = parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, cloud_cover: [101], visibility: [null] } }, Date.parse('2030-01-01T02:00Z'))
    expect([out?.cloudCover, out?.visibility]).toEqual([null, null])
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_gusts_10m: [null] } }, Date.parse('2030-01-01T02:00Z'))?.gust).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_speed_10m: 'km/h' } }, Date.parse('2030-01-01T02:00Z'))).toThrow('malformed')
    expect(() => parseGlobalForecast({ ...sample, hourly: { time: ['2030-01-01T02:00', '2030-01-01T02:00'], temperature_2m: [12, 13], dew_point_2m: [8, 9], wind_speed_10m: [10, 11], wind_direction_10m: [0, 1], wind_gusts_10m: [18], precipitation: [1.2], precipitation_probability: [40], cloud_cover: [75], visibility: [9000], freezing_level_height: [2400] } }, now)).toThrow('malformed')
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, time: ['2030-02-30T02:00'] } }, now)).toThrow('malformed')
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, temperature_2m: [null], wind_direction_10m: [null], wind_gusts_10m: [18], precipitation: [1.2], precipitation_probability: [40], cloud_cover: [75], visibility: [9000], freezing_level_height: [2400] } }, Date.parse('2030-01-01T02:00Z'))).toEqual({ values: {}, precipitation: 1.2, dewPoint: 8, gust: 18, precipitationProbability: 40, cloudCover: 75, visibility: 9000, freezingLevel: 2400, latitude: 50.1, longitude: 8.1 })
  })
})
