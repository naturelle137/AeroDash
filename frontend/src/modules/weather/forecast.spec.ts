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
  const sample = { latitude: 50.1, longitude: 8.1, utc_offset_seconds: 0, hourly_units: { time: 'iso8601', temperature_2m: '°C', dew_point_2m: '°C', wind_speed_10m: 'kn', wind_direction_10m: '°', wind_gusts_10m: 'kn', precipitation: 'mm', precipitation_probability: '%', cloud_cover: '%', visibility: 'm', freezing_level_height: 'm', cape: 'J/kg', boundary_layer_height: 'm', snowfall: 'cm', snow_depth: 'm', pressure_msl: 'hPa', weather_code: 'wmo code', is_day: '', cloud_cover_low: '%', cloud_cover_mid: '%', cloud_cover_high: '%', relative_humidity_2m: '%', lifted_index: '', convective_inhibition: 'J/kg', wind_speed_80m: 'kn', wind_direction_80m: '°', wind_speed_850hPa: 'kn', wind_direction_850hPa: '°', temperature_850hPa: '°C', geopotential_height_850hPa: 'm', wind_speed_700hPa: 'kn', wind_direction_700hPa: '°', geopotential_height_700hPa: 'm', wind_speed_500hPa: 'kn', wind_direction_500hPa: '°', geopotential_height_500hPa: 'm', wind_speed_600hPa: 'kn', wind_direction_600hPa: '°', geopotential_height_600hPa: 'm', wind_speed_925hPa: 'kn', wind_direction_925hPa: '°', geopotential_height_925hPa: 'm', wind_speed_800hPa: 'kn', wind_direction_800hPa: '°', geopotential_height_800hPa: 'm' }, hourly: { time: ['2030-01-01T02:00'], temperature_2m: [12.3], dew_point_2m: [8], wind_speed_10m: [10.2], wind_direction_10m: [0], wind_gusts_10m: [18], precipitation: [1.2], precipitation_probability: [40], cloud_cover: [75], visibility: [9000], freezing_level_height: [2400], cape: [350], boundary_layer_height: [850], snowfall: [0.4], snow_depth: [0.05], pressure_msl: [1013.2], weather_code: [95], is_day: [1], cloud_cover_low: [60], cloud_cover_mid: [30], cloud_cover_high: [10], relative_humidity_2m: [62], lifted_index: [-2.5], convective_inhibition: [12], wind_speed_80m: [20], wind_direction_80m: [0], wind_speed_850hPa: [35], wind_direction_850hPa: [270], temperature_850hPa: [-2.5], geopotential_height_850hPa: [1480], wind_speed_700hPa: [45], wind_direction_700hPa: [280], geopotential_height_700hPa: [3050], wind_speed_500hPa: [60], wind_direction_500hPa: [290], geopotential_height_500hPa: [5560], wind_speed_600hPa: [50], wind_direction_600hPa: [285], geopotential_height_600hPa: [4200], wind_speed_925hPa: [25], wind_direction_925hPa: [265], geopotential_height_925hPa: [760], wind_speed_800hPa: [30], wind_direction_800hPa: [275], geopotential_height_800hPa: [1950] } }
  it('matches an exact UTC hour and retains source units without inventing QNH', () => {
    expect(parseGlobalForecast(sample, Date.parse('2030-01-01T03:00+01:00'))).toEqual({ values: { temperature: '12.3', wind: { direction: '360', speed: '10.2', unit: 'kt' } }, precipitation: 1.2, dewPoint: 8, dewPointSpread: 4.3, gust: 18, precipitationProbability: 40, cloudCover: 75, visibility: 9000, freezingLevel: 2400, cape: 350, boundaryLayer: 850, snowfall: 0.4, seaLevelPressure: 1013.2, daylight: true, weather: 'thunderstorm', cloudLayers: { low: 60, mid: 30, high: 10 }, humidity: 62, liftedIndex: -2.5, inhibition: 12, snowDepth: 0.05, wind80: { speed: 20, direction: 360 }, wind850: { speed: 35, direction: 270, temperature: -2.5, height: 1480 }, wind700: { speed: 45, direction: 280, height: 3050 }, wind500: { speed: 60, direction: 290, height: 5560 }, wind600: { speed: 50, direction: 285, height: 4200 }, wind925: { speed: 25, direction: 265, height: 760 }, wind800: { speed: 30, direction: 275, height: 1950 }, latitude: 50.1, longitude: 8.1 })
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
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, temperature_2m: [null], wind_direction_10m: [null], wind_gusts_10m: [18], precipitation: [1.2], precipitation_probability: [40], cloud_cover: [75], visibility: [9000], freezing_level_height: [2400] } }, Date.parse('2030-01-01T02:00Z'))).toEqual({ values: {}, precipitation: 1.2, dewPoint: 8, dewPointSpread: null, gust: 18, precipitationProbability: 40, cloudCover: 75, visibility: 9000, freezingLevel: 2400, cape: 350, boundaryLayer: 850, snowfall: 0.4, seaLevelPressure: 1013.2, daylight: true, weather: 'thunderstorm', cloudLayers: { low: 60, mid: 30, high: 10 }, humidity: 62, liftedIndex: -2.5, inhibition: 12, snowDepth: 0.05, wind80: { speed: 20, direction: 360 }, wind850: { speed: 35, direction: 270, temperature: -2.5, height: 1480 }, wind700: { speed: 45, direction: 280, height: 3050 }, wind500: { speed: 60, direction: 290, height: 5560 }, wind600: { speed: 50, direction: 285, height: 4200 }, wind925: { speed: 25, direction: 265, height: 760 }, wind800: { speed: 30, direction: 275, height: 1950 }, latitude: 50.1, longitude: 8.1 })
  })
  it('treats CAPE as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { cape: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ cape: null, freezingLevel: 2400, visibility: 9000 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, cape: 'kJ/kg' } }, at)).toMatchObject({ cape: null, cloudCover: 75 })
    for (const value of [null, -1, 10001]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, cape: [value] } }, at)?.cape).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, cape: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats cloud layers as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { cloud_cover_mid: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ cloudLayers: { low: 60, mid: null, high: 10 }, cloudCover: 75 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, cloud_cover_low: 'okta' } }, at)?.cloudLayers.low).toBeNull()
    for (const value of [null, -1, 101]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, cloud_cover_high: [value] } }, at)?.cloudLayers.high).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, cloud_cover_low: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats model sea-level pressure as optional and plausible only', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { pressure_msl: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ seaLevelPressure: null, snowfall: 0.4 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, pressure_msl: 'inHg' } }, at)).toMatchObject({ seaLevelPressure: null })
    for (const value of [null, 849, 1091]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, pressure_msl: [value] } }, at)?.seaLevelPressure).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, pressure_msl: [1000, 1001] } }, at)).toThrow('malformed')
  })
  it('treats the weather code as optional and known codes only', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { weather_code: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ weather: null, seaLevelPressure: 1013.2 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, weather_code: 'text' } }, at)).toMatchObject({ weather: null })
    for (const value of [null, 4, -1, '95']) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, weather_code: [value] } }, at)?.weather).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, weather_code: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats snowfall as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { snowfall: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ snowfall: null, cape: 350 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, snowfall: 'mm' } }, at)).toMatchObject({ snowfall: null, cloudCover: 75 })
    for (const value of [null, -1, 501]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, snowfall: [value] } }, at)?.snowfall).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, snowfall: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats boundary layer height as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { boundary_layer_height: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ boundaryLayer: null, cape: 350 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, boundary_layer_height: 'ft' } }, at)).toMatchObject({ boundaryLayer: null, cloudCover: 75 })
    for (const value of [null, -1, 10001]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, boundary_layer_height: [value] } }, at)?.boundaryLayer).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, boundary_layer_height: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats relative humidity as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { relative_humidity_2m: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ humidity: null, cape: 350 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, relative_humidity_2m: 'ratio' } }, at)).toMatchObject({ humidity: null, cloudCover: 75 })
    for (const value of [null, -1, 101]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, relative_humidity_2m: [value] } }, at)?.humidity).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, relative_humidity_2m: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats lifted index as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { lifted_index: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ liftedIndex: null, humidity: 62 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, lifted_index: 'K' } }, at)).toMatchObject({ liftedIndex: null, humidity: 62 })
    for (const value of [null, -21, 41]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, lifted_index: [value] } }, at)?.liftedIndex).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, lifted_index: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats 80 m wind as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { wind_speed_80m: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ wind80: null, humidity: 62 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_speed_80m: 'km/h' } }, at)?.wind80).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_direction_80m: [null] } }, at)?.wind80).toEqual({ speed: 20, direction: null })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_80m: [0], wind_direction_80m: [90] } }, at)?.wind80).toEqual({ speed: 0, direction: null })
    for (const value of [null, -1, 301]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_80m: [value] } }, at)?.wind80).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_80m: [1, 2] } }, at)).toThrow('malformed')
  })
  it('derives the temperature–dew point spread only from two valid values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, temperature_2m: [null] } }, at)?.dewPointSpread).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, dew_point_2m: [null] } }, at)?.dewPointSpread).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, dew_point_2m: [13] } }, at)?.dewPointSpread).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, temperature_2m: [8], dew_point_2m: [8] } }, at)?.dewPointSpread).toBe(0)
  })
  it('treats 700 hPa wind as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    expect(parseGlobalForecast(sample, at)?.wind700).toEqual({ speed: 45, direction: 280, height: 3050 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_direction_700hPa: 'rad' } }, at)?.wind700).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, geopotential_height_700hPa: 'ft' } }, at)?.wind700).toEqual({ speed: 45, direction: 280, height: null })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_700hPa: [0] } }, at)?.wind700).toEqual({ speed: 0, direction: null, height: 3050 })
    for (const value of [null, -1, 401]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_700hPa: [value] } }, at)?.wind700).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_direction_700hPa: [1, 2] } }, at)).toThrow('malformed')
  })

  it('treats 500 hPa wind as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    expect(parseGlobalForecast(sample, at)?.wind500).toEqual({ speed: 60, direction: 290, height: 5560 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_direction_500hPa: 'rad' } }, at)?.wind500).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, geopotential_height_500hPa: 'ft' } }, at)?.wind500).toEqual({ speed: 60, direction: 290, height: null })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_500hPa: [0] } }, at)?.wind500).toEqual({ speed: 0, direction: null, height: 5560 })
    for (const value of [null, -1, 401]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_500hPa: [value] } }, at)?.wind500).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_direction_500hPa: [1, 2] } }, at)).toThrow('malformed')
  })

  it('treats 800 hPa wind as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    expect(parseGlobalForecast(sample, at)?.wind800).toEqual({ speed: 30, direction: 275, height: 1950 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_direction_800hPa: 'rad' } }, at)?.wind800).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, geopotential_height_800hPa: 'ft' } }, at)?.wind800).toEqual({ speed: 30, direction: 275, height: null })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_800hPa: [0] } }, at)?.wind800).toEqual({ speed: 0, direction: null, height: 1950 })
    for (const value of [null, -1, 401]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_800hPa: [value] } }, at)?.wind800).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_direction_800hPa: [1, 2] } }, at)).toThrow('malformed')
  })

  it('treats 600 hPa wind as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    expect(parseGlobalForecast(sample, at)?.wind600).toEqual({ speed: 50, direction: 285, height: 4200 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_direction_600hPa: 'rad' } }, at)?.wind600).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, geopotential_height_600hPa: 'ft' } }, at)?.wind600).toEqual({ speed: 50, direction: 285, height: null })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_600hPa: [0] } }, at)?.wind600).toEqual({ speed: 0, direction: null, height: 4200 })
    for (const value of [null, -1, 401]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_600hPa: [value] } }, at)?.wind600).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_direction_600hPa: [1, 2] } }, at)).toThrow('malformed')
  })

  it('treats 925 hPa wind as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    expect(parseGlobalForecast(sample, at)?.wind925).toEqual({ speed: 25, direction: 265, height: 760 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_direction_925hPa: 'rad' } }, at)?.wind925).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, geopotential_height_925hPa: 'ft' } }, at)?.wind925).toEqual({ speed: 25, direction: 265, height: null })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_925hPa: [0] } }, at)?.wind925).toEqual({ speed: 0, direction: null, height: 760 })
    for (const value of [null, -1, 401]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_925hPa: [value] } }, at)?.wind925).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_direction_925hPa: [1, 2] } }, at)).toThrow('malformed')
  })

  it('treats 850 hPa wind as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { wind_speed_850hPa: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ wind850: null, humidity: 62 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, wind_direction_850hPa: 'rad' } }, at)?.wind850).toBeNull()
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_direction_850hPa: [null] } }, at)?.wind850).toMatchObject({ speed: 35, direction: null })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_850hPa: [0] } }, at)?.wind850).toMatchObject({ speed: 0, direction: null })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, temperature_850hPa: 'K', geopotential_height_850hPa: 'ft' } }, at)?.wind850).toEqual({ speed: 35, direction: 270, temperature: null, height: null })
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, temperature_850hPa: [-101], geopotential_height_850hPa: [null] } }, at)?.wind850).toMatchObject({ temperature: null, height: null })
    for (const value of [null, -1, 401]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_850hPa: [value] } }, at)?.wind850).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, wind_speed_850hPa: [1, 2] } }, at)).toThrow('malformed')
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, geopotential_height_850hPa: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats the daylight flag as optional and accepts only 0 or 1', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, is_day: [0] } }, at)?.daylight).toBe(false)
    const { is_day: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ daylight: null, humidity: 62 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, is_day: 'x' } }, at)?.daylight).toBeNull()
    for (const value of [null, 2, -1, '1']) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, is_day: [value] } }, at)?.daylight).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, is_day: [1, 0] } }, at)).toThrow('malformed')
  })

  it('treats convective inhibition as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { convective_inhibition: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ inhibition: null, humidity: 62 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, convective_inhibition: 'hPa' } }, at)).toMatchObject({ inhibition: null, humidity: 62 })
    for (const value of [null, -1, 10001]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, convective_inhibition: [value] } }, at)?.inhibition).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, convective_inhibition: [1, 2] } }, at)).toThrow('malformed')
  })
  it('treats snow depth as optional and rejects implausible values', () => {
    const at = Date.parse('2030-01-01T02:00Z')
    const { snow_depth: _unit, ...otherUnits } = sample.hourly_units
    expect(parseGlobalForecast({ ...sample, hourly_units: otherUnits }, at)).toMatchObject({ snowDepth: null, humidity: 62 })
    expect(parseGlobalForecast({ ...sample, hourly_units: { ...sample.hourly_units, snow_depth: 'cm' } }, at)).toMatchObject({ snowDepth: null, humidity: 62 })
    for (const value of [null, -0.1, 21]) expect(parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, snow_depth: [value] } }, at)?.snowDepth).toBeNull()
    expect(() => parseGlobalForecast({ ...sample, hourly: { ...sample.hourly, snow_depth: [1, 2] } }, at)).toThrow('malformed')
  })
})
