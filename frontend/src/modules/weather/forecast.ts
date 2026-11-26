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
  if (new Set(rows.map(row => row.timestamp)).size !== rows.length) throw new Error('malformed')
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

const weatherCodes: Record<number, string> = { 0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'depositing rime fog', 51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle', 56: 'light freezing drizzle', 57: 'dense freezing drizzle', 61: 'slight rain', 63: 'moderate rain', 65: 'heavy rain', 66: 'light freezing rain', 67: 'heavy freezing rain', 71: 'slight snow', 73: 'moderate snow', 75: 'heavy snow', 77: 'snow grains', 80: 'slight rain showers', 81: 'moderate rain showers', 82: 'violent rain showers', 85: 'slight snow showers', 86: 'heavy snow showers', 95: 'thunderstorm', 96: 'thunderstorm with slight hail', 99: 'thunderstorm with heavy hail' }

export function parseGlobalForecast(data: unknown, selected: number): { values: MetarValues; dewPoint: number | null; dewPointSpread: number | null; precipitation: number | null; gust: number | null; precipitationProbability: number | null; cloudCover: number | null; visibility: number | null; freezingLevel: number | null; cape: number | null; boundaryLayer: number | null; snowfall: number | null; seaLevelPressure: number | null; daylight: boolean | null; weather: string | null; cloudLayers: { low: number | null; mid: number | null; high: number | null }; humidity: number | null; liftedIndex: number | null; inhibition: number | null; snowDepth: number | null; wind80: { speed: number; direction: number | null } | null; wind850: { speed: number; direction: number | null; temperature: number | null; height: number | null } | null; wind700: { speed: number; direction: number | null; height: number | null } | null; wind500: { speed: number; direction: number | null; height: number | null } | null; wind600: { speed: number; direction: number | null; height: number | null } | null; wind925: { speed: number; direction: number | null; height: number | null } | null; wind800: { speed: number; direction: number | null; height: number | null } | null; latitude: number; longitude: number } | null {
  if (!data || typeof data !== 'object') throw new Error('malformed')
  const d = data as Record<string, unknown>
  if (typeof d.latitude !== 'number' || !Number.isFinite(d.latitude) || d.latitude < -90 || d.latitude > 90 || typeof d.longitude !== 'number' || !Number.isFinite(d.longitude) || d.longitude < -180 || d.longitude > 180) throw new Error('malformed')
  if (d.utc_offset_seconds !== 0 || !d.hourly || typeof d.hourly !== 'object' || !d.hourly_units || typeof d.hourly_units !== 'object') throw new Error('malformed')
  const units = d.hourly_units as Record<string, unknown>
  if (units.time !== 'iso8601' || units.temperature_2m !== '°C' || units.dew_point_2m !== '°C' || units.wind_speed_10m !== 'kn' || units.wind_direction_10m !== '°' || units.wind_gusts_10m !== 'kn' || units.precipitation !== 'mm' || units.precipitation_probability !== '%' || units.cloud_cover !== '%' || units.visibility !== 'm') throw new Error('malformed')
  const h = d.hourly as Record<string, unknown>
  const times = h.time
  const temperatures = h.temperature_2m
  const dewPoints = h.dew_point_2m
  const speeds = h.wind_speed_10m
  const directions = h.wind_direction_10m
  const gusts = h.wind_gusts_10m
  const precipitation = h.precipitation
  const probabilities = h.precipitation_probability
  const clouds = h.cloud_cover
  const visibilities = h.visibility
  const freezingLevels = units.freezing_level_height === 'm' ? h.freezing_level_height : undefined
  const capes = units.cape === 'J/kg' ? h.cape : undefined
  const layerHeights = units.boundary_layer_height === 'm' ? h.boundary_layer_height : undefined
  const snowfalls = units.snowfall === 'cm' ? h.snowfall : undefined
  const pressures = units.pressure_msl === 'hPa' ? h.pressure_msl : undefined
  const indices = units.lifted_index === '' ? h.lifted_index : undefined
  if (indices !== undefined && (!Array.isArray(indices) || !Array.isArray(times) || indices.length !== times.length)) throw new Error('malformed')
  const inhibitions = units.convective_inhibition === 'J/kg' ? h.convective_inhibition : undefined
  if (inhibitions !== undefined && (!Array.isArray(inhibitions) || !Array.isArray(times) || inhibitions.length !== times.length)) throw new Error('malformed')
  const winds80 = units.wind_speed_80m === 'kn' && units.wind_direction_80m === '°' ? { speeds: h.wind_speed_80m, directions: h.wind_direction_80m } : undefined
  if (winds80 !== undefined && (!Array.isArray(winds80.speeds) || !Array.isArray(winds80.directions) || !Array.isArray(times) || winds80.speeds.length !== times.length || winds80.directions.length !== times.length)) throw new Error('malformed')
  const winds850 = units.wind_speed_850hPa === 'kn' && units.wind_direction_850hPa === '°' ? h : undefined
  const winds700 = units.wind_speed_700hPa === 'kn' && units.wind_direction_700hPa === '°' ? h : undefined
  const heights700 = units.geopotential_height_700hPa === 'm' ? h.geopotential_height_700hPa : undefined
  for (const list of winds700 === undefined ? [] : [h.wind_speed_700hPa, h.wind_direction_700hPa]) if (!Array.isArray(list) || !Array.isArray(times) || list.length !== times.length) throw new Error('malformed')
  if (heights700 !== undefined && (!Array.isArray(heights700) || !Array.isArray(times) || heights700.length !== times.length)) throw new Error('malformed')
  const winds500 = units.wind_speed_500hPa === 'kn' && units.wind_direction_500hPa === '°' ? h : undefined
  const heights500 = units.geopotential_height_500hPa === 'm' ? h.geopotential_height_500hPa : undefined
  for (const list of winds500 === undefined ? [] : [h.wind_speed_500hPa, h.wind_direction_500hPa]) if (!Array.isArray(list) || !Array.isArray(times) || list.length !== times.length) throw new Error('malformed')
  if (heights500 !== undefined && (!Array.isArray(heights500) || !Array.isArray(times) || heights500.length !== times.length)) throw new Error('malformed')
  const winds600 = units.wind_speed_600hPa === 'kn' && units.wind_direction_600hPa === '°' ? h : undefined
  const heights600 = units.geopotential_height_600hPa === 'm' ? h.geopotential_height_600hPa : undefined
  for (const list of winds600 === undefined ? [] : [h.wind_speed_600hPa, h.wind_direction_600hPa]) if (!Array.isArray(list) || !Array.isArray(times) || list.length !== times.length) throw new Error('malformed')
  if (heights600 !== undefined && (!Array.isArray(heights600) || !Array.isArray(times) || heights600.length !== times.length)) throw new Error('malformed')
  const winds925 = units.wind_speed_925hPa === 'kn' && units.wind_direction_925hPa === '°' ? h : undefined
  const heights925 = units.geopotential_height_925hPa === 'm' ? h.geopotential_height_925hPa : undefined
  for (const list of winds925 === undefined ? [] : [h.wind_speed_925hPa, h.wind_direction_925hPa]) if (!Array.isArray(list) || !Array.isArray(times) || list.length !== times.length) throw new Error('malformed')
  if (heights925 !== undefined && (!Array.isArray(heights925) || !Array.isArray(times) || heights925.length !== times.length)) throw new Error('malformed')
  const winds800 = units.wind_speed_800hPa === 'kn' && units.wind_direction_800hPa === '°' ? h : undefined
  const heights800 = units.geopotential_height_800hPa === 'm' ? h.geopotential_height_800hPa : undefined
  for (const list of winds800 === undefined ? [] : [h.wind_speed_800hPa, h.wind_direction_800hPa]) if (!Array.isArray(list) || !Array.isArray(times) || list.length !== times.length) throw new Error('malformed')
  if (heights800 !== undefined && (!Array.isArray(heights800) || !Array.isArray(times) || heights800.length !== times.length)) throw new Error('malformed')
  const temps850 = units.temperature_850hPa === '°C' ? h.temperature_850hPa : undefined
  const heights850 = units.geopotential_height_850hPa === 'm' ? h.geopotential_height_850hPa : undefined
  for (const list of winds850 === undefined ? [] : [h.wind_speed_850hPa, h.wind_direction_850hPa]) if (!Array.isArray(list) || !Array.isArray(times) || list.length !== times.length) throw new Error('malformed')
  for (const list of [temps850, heights850]) if (list !== undefined && (!Array.isArray(list) || !Array.isArray(times) || list.length !== times.length)) throw new Error('malformed')
  const daylights = units.is_day === '' ? h.is_day : undefined
  if (daylights !== undefined && (!Array.isArray(daylights) || !Array.isArray(times) || daylights.length !== times.length)) throw new Error('malformed')
  const depths = units.snow_depth === 'm' ? h.snow_depth : undefined
  if (depths !== undefined && (!Array.isArray(depths) || !Array.isArray(times) || depths.length !== times.length)) throw new Error('malformed')
  const codes = units.weather_code === 'wmo code' ? h.weather_code : undefined
  const layer = (key: 'cloud_cover_low' | 'cloud_cover_mid' | 'cloud_cover_high' | 'relative_humidity_2m'): unknown[] | undefined => {
    const values = units[key] === '%' ? h[key] : undefined
    if (values !== undefined && (!Array.isArray(values) || !Array.isArray(times) || values.length !== times.length)) throw new Error('malformed')
    return values
  }
  const layers = { low: layer('cloud_cover_low'), mid: layer('cloud_cover_mid'), high: layer('cloud_cover_high') }
  const humidities = layer('relative_humidity_2m')
  if (!Array.isArray(times) || !Array.isArray(temperatures) || !Array.isArray(dewPoints) || !Array.isArray(speeds) || !Array.isArray(directions) || !Array.isArray(gusts) || !Array.isArray(precipitation) || !Array.isArray(probabilities) || !Array.isArray(clouds) || !Array.isArray(visibilities) || (freezingLevels !== undefined && !Array.isArray(freezingLevels)) || (capes !== undefined && !Array.isArray(capes)) || (layerHeights !== undefined && !Array.isArray(layerHeights)) || (snowfalls !== undefined && !Array.isArray(snowfalls)) || (pressures !== undefined && !Array.isArray(pressures)) || (codes !== undefined && !Array.isArray(codes)) || [temperatures, dewPoints, speeds, directions, gusts, precipitation, probabilities, clouds, visibilities, ...(freezingLevels === undefined ? [] : [freezingLevels as unknown[]]), ...(capes === undefined ? [] : [capes as unknown[]]), ...(layerHeights === undefined ? [] : [layerHeights as unknown[]]), ...(snowfalls === undefined ? [] : [snowfalls as unknown[]]), ...(pressures === undefined ? [] : [pressures as unknown[]]), ...(codes === undefined ? [] : [codes as unknown[]])].some(a => a.length !== times.length)) throw new Error('malformed')
  if (times.some(t => typeof t !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:00$/.test(t) || !Number.isFinite(Date.parse(`${t}Z`)) || new Date(`${t}Z`).toISOString().slice(0, 16) !== t) || new Set(times).size !== times.length) throw new Error('malformed')
  const index = times.findIndex(t => Date.parse(`${t}Z`) === selected)
  if (index < 0) return null
  const values: MetarValues = {}
  const temp: unknown = temperatures[index], speed: unknown = speeds[index], direction: unknown = directions[index]
  if (typeof temp === 'number' && Number.isFinite(temp) && temp >= -100 && temp <= 100) values.temperature = String(temp)
  if (typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 && speed <= 200 && (speed === 0 || (typeof direction === 'number' && Number.isFinite(direction) && direction >= 0 && direction <= 360))) {
    values.wind = { speed: String(speed), direction: speed === 0 ? '' : String(direction === 0 ? 360 : direction), unit: 'kt' }
  }
  const dewPoint: unknown = dewPoints[index]
  const gust: unknown = gusts[index]
  const amount: unknown = precipitation[index]
  const probability: unknown = probabilities[index]
  const cover: unknown = clouds[index]
  const visibility: unknown = visibilities[index]
  const freezing: unknown = (freezingLevels as unknown[] | undefined)?.[index]
  const cape: unknown = (capes as unknown[] | undefined)?.[index]
  const layerHeight: unknown = (layerHeights as unknown[] | undefined)?.[index]
  const snow: unknown = (snowfalls as unknown[] | undefined)?.[index]
  const pressure: unknown = (pressures as unknown[] | undefined)?.[index]
  const liftedIndex: unknown = (indices as unknown[] | undefined)?.[index]
  const inhibition: unknown = (inhibitions as unknown[] | undefined)?.[index]
  const speed80: unknown = (winds80?.speeds as unknown[] | undefined)?.[index], direction80: unknown = (winds80?.directions as unknown[] | undefined)?.[index]
  const wind80 = typeof speed80 === 'number' && Number.isFinite(speed80) && speed80 >= 0 && speed80 <= 300 ? { speed: speed80, direction: typeof direction80 === 'number' && Number.isFinite(direction80) && direction80 >= 0 && direction80 <= 360 ? (direction80 === 0 ? 360 : direction80) : null } : null
  const speed850: unknown = (winds850?.wind_speed_850hPa as unknown[] | undefined)?.[index], direction850: unknown = (winds850?.wind_direction_850hPa as unknown[] | undefined)?.[index]
  const temp850: unknown = (temps850 as unknown[] | undefined)?.[index], height850: unknown = (heights850 as unknown[] | undefined)?.[index]
  const wind850 = typeof speed850 === 'number' && Number.isFinite(speed850) && speed850 >= 0 && speed850 <= 400
    ? { speed: speed850, direction: speed850 > 0 && typeof direction850 === 'number' && Number.isFinite(direction850) && direction850 >= 0 && direction850 <= 360 ? (direction850 === 0 ? 360 : direction850) : null, temperature: typeof temp850 === 'number' && Number.isFinite(temp850) && temp850 >= -100 && temp850 <= 60 ? temp850 : null, height: typeof height850 === 'number' && Number.isFinite(height850) && height850 >= -500 && height850 <= 5000 ? height850 : null }
    : null
  const speed700: unknown = (winds700?.wind_speed_700hPa as unknown[] | undefined)?.[index], direction700: unknown = (winds700?.wind_direction_700hPa as unknown[] | undefined)?.[index]
  const height700: unknown = (heights700 as unknown[] | undefined)?.[index]
  const wind700 = typeof speed700 === 'number' && Number.isFinite(speed700) && speed700 >= 0 && speed700 <= 400
    ? { speed: speed700, direction: speed700 > 0 && typeof direction700 === 'number' && Number.isFinite(direction700) && direction700 >= 0 && direction700 <= 360 ? (direction700 === 0 ? 360 : direction700) : null, height: typeof height700 === 'number' && Number.isFinite(height700) && height700 >= 1000 && height700 <= 5000 ? height700 : null }
    : null
  const speed500: unknown = (winds500?.wind_speed_500hPa as unknown[] | undefined)?.[index], direction500: unknown = (winds500?.wind_direction_500hPa as unknown[] | undefined)?.[index]
  const height500: unknown = (heights500 as unknown[] | undefined)?.[index]
  const wind500 = typeof speed500 === 'number' && Number.isFinite(speed500) && speed500 >= 0 && speed500 <= 400
    ? { speed: speed500, direction: speed500 > 0 && typeof direction500 === 'number' && Number.isFinite(direction500) && direction500 >= 0 && direction500 <= 360 ? (direction500 === 0 ? 360 : direction500) : null, height: typeof height500 === 'number' && Number.isFinite(height500) && height500 >= 4000 && height500 <= 7000 ? height500 : null }
    : null
  const speed600: unknown = (winds600?.wind_speed_600hPa as unknown[] | undefined)?.[index], direction600: unknown = (winds600?.wind_direction_600hPa as unknown[] | undefined)?.[index]
  const height600: unknown = (heights600 as unknown[] | undefined)?.[index]
  const wind600 = typeof speed600 === 'number' && Number.isFinite(speed600) && speed600 >= 0 && speed600 <= 400
    ? { speed: speed600, direction: speed600 > 0 && typeof direction600 === 'number' && Number.isFinite(direction600) && direction600 >= 0 && direction600 <= 360 ? (direction600 === 0 ? 360 : direction600) : null, height: typeof height600 === 'number' && Number.isFinite(height600) && height600 >= 3000 && height600 <= 5500 ? height600 : null }
    : null
  const speed925: unknown = (winds925?.wind_speed_925hPa as unknown[] | undefined)?.[index], direction925: unknown = (winds925?.wind_direction_925hPa as unknown[] | undefined)?.[index]
  const height925: unknown = (heights925 as unknown[] | undefined)?.[index]
  const wind925 = typeof speed925 === 'number' && Number.isFinite(speed925) && speed925 >= 0 && speed925 <= 400
    ? { speed: speed925, direction: speed925 > 0 && typeof direction925 === 'number' && Number.isFinite(direction925) && direction925 >= 0 && direction925 <= 360 ? (direction925 === 0 ? 360 : direction925) : null, height: typeof height925 === 'number' && Number.isFinite(height925) && height925 >= -500 && height925 <= 2000 ? height925 : null }
    : null
  const speed800: unknown = (winds800?.wind_speed_800hPa as unknown[] | undefined)?.[index], direction800: unknown = (winds800?.wind_direction_800hPa as unknown[] | undefined)?.[index]
  const height800: unknown = (heights800 as unknown[] | undefined)?.[index]
  const wind800 = typeof speed800 === 'number' && Number.isFinite(speed800) && speed800 >= 0 && speed800 <= 400
    ? { speed: speed800, direction: speed800 > 0 && typeof direction800 === 'number' && Number.isFinite(direction800) && direction800 >= 0 && direction800 <= 360 ? (direction800 === 0 ? 360 : direction800) : null, height: typeof height800 === 'number' && Number.isFinite(height800) && height800 >= 500 && height800 <= 4000 ? height800 : null }
    : null
  const daylight: unknown = (daylights as unknown[] | undefined)?.[index]
  const depth: unknown = (depths as unknown[] | undefined)?.[index]
  const code: unknown = (codes as unknown[] | undefined)?.[index]
  const percent = (list: unknown[] | undefined): number | null => {
    const value: unknown = list?.[index]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
  }
  const validDew = typeof dewPoint === 'number' && Number.isFinite(dewPoint) && dewPoint >= -100 && dewPoint <= 100
  const spread = validDew && typeof temp === 'number' && values.temperature !== undefined ? Math.round((temp - dewPoint) * 10) / 10 : null
  return { values, dewPointSpread: spread !== null && spread >= 0 ? spread : null, precipitation: typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : null, dewPoint: typeof dewPoint === 'number' && Number.isFinite(dewPoint) && dewPoint >= -100 && dewPoint <= 100 ? dewPoint : null, cloudCover: typeof cover === 'number' && Number.isFinite(cover) && cover >= 0 && cover <= 100 ? cover : null, visibility: typeof visibility === 'number' && Number.isFinite(visibility) && visibility >= 0 && visibility <= 100000 ? visibility : null, precipitationProbability: typeof probability === 'number' && Number.isFinite(probability) && probability >= 0 && probability <= 100 ? probability : null, freezingLevel: typeof freezing === 'number' && Number.isFinite(freezing) && freezing >= -1000 && freezing <= 20000 ? freezing : null, cape: typeof cape === 'number' && Number.isFinite(cape) && cape >= 0 && cape <= 10000 ? cape : null, boundaryLayer: typeof layerHeight === 'number' && Number.isFinite(layerHeight) && layerHeight >= 0 && layerHeight <= 10000 ? layerHeight : null, snowfall: typeof snow === 'number' && Number.isFinite(snow) && snow >= 0 && snow <= 500 ? snow : null, seaLevelPressure: typeof pressure === 'number' && Number.isFinite(pressure) && pressure >= 850 && pressure <= 1090 ? pressure : null, daylight: daylight === 1 ? true : daylight === 0 ? false : null, weather: typeof code === 'number' ? weatherCodes[code] ?? null : null, gust: typeof gust === 'number' && Number.isFinite(gust) && gust >= 0 && gust <= 200 ? gust : null, cloudLayers: { low: percent(layers.low), mid: percent(layers.mid), high: percent(layers.high) }, humidity: percent(humidities), liftedIndex: typeof liftedIndex === 'number' && Number.isFinite(liftedIndex) && liftedIndex >= -20 && liftedIndex <= 40 ? liftedIndex : null, inhibition: typeof inhibition === 'number' && Number.isFinite(inhibition) && inhibition >= 0 && inhibition <= 10000 ? inhibition : null, snowDepth: typeof depth === 'number' && Number.isFinite(depth) && depth >= 0 && depth <= 20 ? depth : null, wind80: wind80 && (wind80.speed === 0 ? { speed: 0, direction: null } : wind80), wind850, wind700, wind500, wind600, wind925, wind800, latitude: d.latitude, longitude: d.longitude }
}
