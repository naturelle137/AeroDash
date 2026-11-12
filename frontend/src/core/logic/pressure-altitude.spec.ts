import { describe, expect, it } from 'vitest'
import {
  ELEVATION_SUPPORTED_FT,
  PRESSURE_ALTITUDE_COEFFICIENT_FT,
  PRESSURE_ALTITUDE_EXPONENT,
  QNH_SUPPORTED_HPA,
  STANDARD_PRESSURE_HPA,
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
  it('uses the published NWS constants', () => {
    expect(PRESSURE_ALTITUDE_COEFFICIENT_FT).toBe(145366.45)
    expect(PRESSURE_ALTITUDE_EXPONENT).toBe(0.190284)
    expect(STANDARD_PRESSURE_HPA).toBe(1013.25)
  })

  // Expected values computed independently with Python decimal (40 digits), not with this module.
  it.each([
    ['1013.25', '0', 0],
    ['1013', '0', 6.825481],
    ['1000', '0', 363.644579],
    ['950', '0', 1772.030170],
    ['1050', '0', -988.828124],
    ['850', '0', 4779.193602],
    ['1100', '0', -2290.118213],
    ['983', '1500', 2335.965561],
    ['1030', '-1240', -1694.231377],
    ['850', '15000', 19779.193602],
    ['1100', '-1500', -3790.118213],
  ])('QNH %s hPa at %s ft gives %f ft', (qnh, elevation, expected) => {
    expect(derived({ qnh, elevation }).pressureAltitudeFt).toBeCloseTo(expected, 5)
  })

  it('converts metre elevation exactly through FT_TO_M', () => {
    const result = derived({ qnh: '1000', elevation: '457.2', elevationUnit: 'm' })
    expect(result.elevationFt).toBeCloseTo(1500, 9)
    expect(result.pressureAltitudeFt).toBeCloseTo(1863.644579, 5)
    expect(result.elevation).toEqual({ value: 457.2, unit: 'm' })
    expect(result.displayPressureAltitudeFt).toBe(1864)
  })

  // Round trip through the NWS altimeter-setting formula: station pressure P (incl. the
  // 0.3 hPa sensor offset) and elevation give QNH; the model must recover the NWS
  // pressure altitude of P − 0.3. Values from the independent Python computation.
  it.each([
    [1014.274988, 1800, 1772.030170],
    [1014.582449, 400, 363.644579],
    [1014.497606, 4500, 4465.958496],
  ])('inverts the NWS altimeter setting %f hPa at %i ft', (qnh, elevationFt, stationPa) => {
    expect(Math.abs(pressureAltitudeFromQnh(qnh, elevationFt) - stationPa)).toBeLessThan(0.01)
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
