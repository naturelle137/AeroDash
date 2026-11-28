import { describe, expect, it } from 'vitest'
import {
  ELEVATION_SUPPORTED_FT,
  QNH_PRESSURE_EXPONENT,
  QNH_SUPPORTED_HPA,
  STANDARD_LAPSE_RATE_K_PER_M,
  STANDARD_PRESSURE_HPA,
  STANDARD_TEMPERATURE_K,
  derivePressureAltitude,
  pressureAltitudeFromQnh,
  type PressureAltitudeDraft,
} from './pressure-altitude'

const draft = (patch: Partial<PressureAltitudeDraft> = {}): PressureAltitudeDraft => ({
  qnh: '1013.25', qnhUnit: 'hPa', elevation: '0', elevationUnit: 'ft', ...patch,
})
const derived = (patch: Partial<PressureAltitudeDraft>) => {
  const result = derivePressureAltitude(draft(patch))
  if (result.status !== 'valid') throw new Error(JSON.stringify(result.errors))
  return result
}
const errorsOf = (patch: Partial<PressureAltitudeDraft>) => {
  const result = derivePressureAltitude(draft(patch))
  if (result.status !== 'invalid') throw new Error('expected invalid')
  return result.errors
}

describe('pressure altitude from QNH and field elevation', () => {
  it('uses consistent ICAO QNH constants (REQ-PF-013)', () => {
    expect(STANDARD_PRESSURE_HPA).toBe(1013.25)
    expect(STANDARD_TEMPERATURE_K).toBe(288.15)
    expect(STANDARD_LAPSE_RATE_K_PER_M).toBe(0.0065)
    expect(QNH_PRESSURE_EXPONENT).toBe(5.25588)
  })

  // Independent Python Decimal(50) oracle of the inverse ICAO QNH equation;
  // expected values are frozen, never computed with product functions/constants.
  it.each([
    ['850', '-1500', '-457.2000', 3281.166011941, 3282],
    ['950', '-1500', '-457.2000', 272.759455078, 273],
    ['1000', '-1500', '-457.2000', -1136.205956780, -1136],
    ['1013', '-1500', '-457.2000', -1493.171714877, -1493],
    ['1013.25', '-1500', '-457.2000', -1500.000000000, -1500],
    ['1050', '-1500', '-457.2000', -2489.234046137, -2489],
    ['1100', '-1500', '-457.2000', -3791.057207050, -3791],
    ['850', '0', '0.0000', 4781.166011941, 4782],
    ['950', '0', '0.0000', 1772.759455078, 1773],
    ['1000', '0', '0.0000', 363.794043220, 364],
    ['1013', '0', '0.0000', 6.828285123, 7],
    ['1013.25', '0', '0.0000', 0.000000000, 0],
    ['1050', '0', '0.0000', -989.234046137, -989],
    ['1100', '0', '0.0000', -2291.057207050, -2291],
    ['850', '1000', '304.8000', 5781.166011941, 5782],
    ['950', '1000', '304.8000', 2772.759455078, 2773],
    ['1000', '1000', '304.8000', 1363.794043220, 1364],
    ['1013', '1000', '304.8000', 1006.828285123, 1007],
    ['1013.25', '1000', '304.8000', 1000.000000000, 1000],
    ['1050', '1000', '304.8000', 10.765953863, 11],
    ['1100', '1000', '304.8000', -1291.057207050, -1291],
    ['850', '15000', '4572.0000', 19781.166011941, 19782],
    ['950', '15000', '4572.0000', 16772.759455078, 16773],
    ['1000', '15000', '4572.0000', 15363.794043220, 15364],
    ['1013', '15000', '4572.0000', 15006.828285123, 15007],
    ['1013.25', '15000', '4572.0000', 15000.000000000, 15000],
    ['1050', '15000', '4572.0000', 14010.765953863, 14011],
    ['1100', '15000', '4572.0000', 12708.942792950, 12709],
  ])('QNH %s hPa at %s ft (%s m) gives %f ft, displayed %i', (qnh, elevation, elevationM, expected, display) => {
    for (const input of [{ elevation, elevationUnit: 'ft' }, { elevation: elevationM, elevationUnit: 'm' }]) {
      const result = derived({ qnh, ...input })
      expect(Math.abs(result.pressureAltitudeFt - expected)).toBeLessThan(0.001)
      expect(result.displayPressureAltitudeFt).toBe(display)
    }
  })

  it.each([-1500, 0, 1000, 15000])('equals elevation %i only at exact standard QNH', (elevation) => {
    expect(pressureAltitudeFromQnh(1013.25, elevation)).toBe(elevation)
    expect(pressureAltitudeFromQnh(1013, elevation)).toBeGreaterThan(elevation)
  })

  it('increases with elevation and decreases with QNH throughout the input domain', () => {
    for (const elevation of [-1500, 0, 1000, 14999]) {
      for (let qnh = 850; qnh < 1100; qnh += 1) {
        const pa = pressureAltitudeFromQnh(qnh, elevation)
        expect(pressureAltitudeFromQnh(qnh + 1, elevation)).toBeLessThan(pa)
        expect(pressureAltitudeFromQnh(qnh, elevation + 1)).toBeCloseTo(pa + 1, 9)
      }
    }
  })

  it('rounds toward positive infinity on both sides of zero without rounding lookup PA', () => {
    for (const [elevation, display] of [['1.01', 2], ['-1.99', -1], ['-0.1', 0], ['0', 0], ['1', 1]] as const) {
      const result = derived({ elevation })
      expect(result.pressureAltitudeFt).toBe(Number(elevation))
      expect(Object.is(result.displayPressureAltitudeFt, display)).toBe(true)
    }
  })

  it('differs from the linear 30 ft/hPa rule, which understates PA above standard pressure', () => {
    const exact = derived({ qnh: '1050' }).pressureAltitudeFt
    const linear = (STANDARD_PRESSURE_HPA - 1050) * 30
    expect(linear).toBeCloseTo(-1102.5, 6)
    expect(exact - linear).toBeGreaterThan(100)
  })

  it('accepts the supported boundaries and warns only outside the advisory band', () => {
    expect(derived({ qnh: String(QNH_SUPPORTED_HPA.min) }).warnings.qnhOutsideAdvisoryRange).toBe(true)
    expect(derived({ qnh: '949.9' }).warnings.qnhOutsideAdvisoryRange).toBe(true)
    expect(derived({ qnh: '950' }).warnings.qnhOutsideAdvisoryRange).toBe(false)
    expect(derived({ qnh: String(QNH_SUPPORTED_HPA.max) }).warnings.qnhOutsideAdvisoryRange).toBe(false)
    expect(derived({ elevation: String(ELEVATION_SUPPORTED_FT.min) }).elevationFt).toBe(-1500)
    expect(derived({ elevation: String(ELEVATION_SUPPORTED_FT.max) }).elevationFt).toBe(15000)
  })

  it('never displays negative zero', () => {
    expect(Object.is(derived({ qnh: '1013.26' }).displayPressureAltitudeFt, 0)).toBe(true)
  })

  it.each(['', '  ', 'abc', 'NaN', 'Infinity', '0x3F5', '1e400', '1,013'])('rejects QNH text %j', (qnh) => {
    expect(errorsOf({ qnh }).qnh).toMatch(/finite decimal/)
  })

  it.each(['849.99', '1100.01', '0', '-1013'])('rejects out-of-domain QNH %s', (qnh) => {
    expect(errorsOf({ qnh }).qnh).toMatch(/outside the supported 850–1100 hPa/)
  })

  it.each(['', 'inHg', 'mb', 'HPA'])('rejects QNH unit %j', (qnhUnit) => {
    expect(errorsOf({ qnhUnit }).qnhUnit).toMatch(/hPa/)
  })

  it.each([['', 'ft'], ['NaN', 'ft'], ['-Infinity', 'm']])('rejects elevation %j %s', (elevation, elevationUnit) => {
    expect(errorsOf({ elevation, elevationUnit }).elevation).toMatch(/finite decimal/)
  })

  it.each([['-1500.1', 'ft'], ['15000.1', 'ft'], ['-457.3', 'm'], ['4572.1', 'm']])('rejects elevation %s %s outside the model range', (elevation, elevationUnit) => {
    expect(errorsOf({ elevation, elevationUnit }).elevation).toMatch(/outside the supported/)
  })

  it('accepts the metre boundaries', () => {
    expect(derived({ elevation: '-457.2', elevationUnit: 'm' }).elevationFt).toBeCloseTo(-1500, 9)
    expect(derived({ elevation: '4572', elevationUnit: 'm' }).elevationFt).toBeCloseTo(15000, 9)
  })

  it.each(['', 'FT', 'km'])('rejects elevation unit %j', (elevationUnit) => {
    expect(errorsOf({ elevationUnit }).elevationUnit).toMatch(/ft or m/)
  })

  it('reports every invalid field at once', () => {
    expect(Object.keys(errorsOf({ qnh: '', qnhUnit: '', elevation: '', elevationUnit: '' })).sort())
      .toEqual(['elevation', 'elevationUnit', 'qnh', 'qnhUnit'])
  })
})
