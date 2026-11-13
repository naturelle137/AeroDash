import { describe, expect, it } from 'vitest'
import {
  ALTIMETER_SETTING_LAPSE_RATE_K_PER_M,
  ALTIMETER_SETTING_OFFSET_HPA,
  ALTIMETER_SETTING_TEMPERATURE_K,
  ELEVATION_SUPPORTED_FT,
  PRESSURE_ALTITUDE_COEFFICIENT_FT,
  PRESSURE_ALTITUDE_EXPONENT,
  QNH_SUPPORTED_HPA,
  STANDARD_PRESSURE_HPA,
  derivePressureAltitude,
  pressureAltitudeFromQnh,
  pressureAltitudeFromStationPressure,
  stationPressureFromQnh,
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
  it('uses the published NWS constants', () => {
    expect(PRESSURE_ALTITUDE_COEFFICIENT_FT).toBe(145366.45)
    expect(PRESSURE_ALTITUDE_EXPONENT).toBe(0.190284)
    expect(STANDARD_PRESSURE_HPA).toBe(1013.25)
    expect(ALTIMETER_SETTING_OFFSET_HPA).toBe(0.3)
    expect(ALTIMETER_SETTING_LAPSE_RATE_K_PER_M).toBe(0.0065)
    expect(ALTIMETER_SETTING_TEMPERATURE_K).toBe(288)
  })

  // Expected values computed independently with Python decimal (40 digits), not with this module:
  // P = (QNH^n − 1013.25^n · 0.0065/288 · h_m)^(1/n) + 0.3, PA = 145366.45 · (1 − (P/1013.25)^n).
  it.each([
    ['1013.25', '0', -8.188777],
    ['1013', '0', -1.364932],
    ['1000', '0', 355.368070],
    ['950', '0', 1763.402729],
    ['1050', '0', -996.784081],
    ['850', '0', 4769.753243],
    ['1100', '0', -2297.780099],
    ['983', '1500', 2327.192520],
    ['1013.25', '1000', 991.567192],
    ['1030', '-1240', -1702.026273],
    ['940', '-100', 1952.205967],
    ['850', '15000', 19763.937842],
    ['1100', '-1500', -3797.457643],
  ])('QNH %s hPa at %s ft gives %f ft', (qnh, elevation, expected) => {
    expect(derived({ qnh, elevation }).pressureAltitudeFt).toBeCloseTo(expected, 5)
  })

  it('converts metre elevation exactly through FT_TO_M', () => {
    const result = derived({ qnh: '1000', elevation: '457.2', elevationUnit: 'm' })
    expect(result.elevationFt).toBeCloseTo(1500, 9)
    expect(result.pressureAltitudeFt).toBeCloseTo(1854.993736, 5)
    expect(result.elevation).toEqual({ value: 457.2, unit: 'm' })
    expect(result.displayPressureAltitudeFt).toBe(1855)
  })

  // Same-P round trip through both cited NWS sheets: station pressure P and elevation give the
  // altimeter setting A (with P − 0.3 as published); the model must recover P itself and the NWS
  // pressure altitude of that same P. Settings and PA from the independent Python computation.
  it.each([
    // Review PA-01 reproduction.
    [950.3, 1800, 1014.274988094126, 1763.402729357421],
    [1000, 0, 999.7, 363.644578556939],
    [1013.25, 400, 1027.684959077727, 0],
    [980, 4500, 1151.105203218686, 920.001823507912],
    [1030, -1240, 984.506223674033, -454.231376885259],
    [1050, -1500, 994.377629805917, -988.828124275084],
  ])('recovers station pressure %f hPa at %i ft from its NWS altimeter setting', (stationHpa, elevationFt, qnh, stationPa) => {
    expect(stationPressureFromQnh(qnh, elevationFt)).toBeCloseTo(stationHpa, 9)
    expect(pressureAltitudeFromStationPressure(stationHpa)).toBeCloseTo(stationPa, 6)
    expect(pressureAltitudeFromQnh(qnh, elevationFt)).toBeCloseTo(stationPa, 6)
  })

  it('stays within the documented bound of the idealized elevation + PA(QNH) relation', () => {
    const idealized = (qnh: number, elevationFt: number) => elevationFt
      + PRESSURE_ALTITUDE_COEFFICIENT_FT * (1 - Math.pow(qnh / STANDARD_PRESSURE_HPA, PRESSURE_ALTITUDE_EXPONENT))
    for (const qnh of [850, 950, 1013.25, 1100]) {
      for (const elevationFt of [-1500, 0, 1800, 15000]) {
        const difference = pressureAltitudeFromQnh(qnh, elevationFt) - idealized(qnh, elevationFt)
        expect(difference).toBeLessThan(-7.3)
        expect(difference).toBeGreaterThan(-15.3)
      }
    }
    // PA-01 case: the idealized relation gives 1772.030103 ft instead of 1763.402729 ft.
    expect(idealized(1014.274988094126, 1800)).toBeCloseTo(1772.030103, 5)
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
    expect(Object.is(derived({ qnh: '1012.96' }).displayPressureAltitudeFt, 0)).toBe(true)
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
