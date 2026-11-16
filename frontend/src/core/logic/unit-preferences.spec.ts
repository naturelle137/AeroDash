import { describe, expect, it } from 'vitest'
import { convertLengthText, DEFAULT_UNIT_PREFERENCES, isLengthUnit, recoverUnitPreferences } from './unit-preferences'

describe('unit preferences and physical lengths', () => {
  it('uses the fixed fallback and accepts explicit saved overrides', () => {
    expect(DEFAULT_UNIT_PREFERENCES).toEqual({ schemaVersion: 1, qnh: 'hPa', pressureAltitude: 'ft', fieldElevation: 'ft', runwayDistance: 'm' })
    expect(recoverUnitPreferences(null)).toEqual({ status: 'empty' })
    const saved = { ...DEFAULT_UNIT_PREFERENCES, fieldElevation: 'm', runwayDistance: 'ft' }
    expect(recoverUnitPreferences(JSON.stringify(saved))).toEqual({ status: 'loaded', preferences: saved })
  })
  it.each(['{', '{}', 'null', JSON.stringify({ ...DEFAULT_UNIT_PREFERENCES, qnh: 'inHg' }), JSON.stringify({ ...DEFAULT_UNIT_PREFERENCES, schemaVersion: 2 }), JSON.stringify({ ...DEFAULT_UNIT_PREFERENCES, numericPa: 1000 })])('rejects unsupported storage %s', (raw) => {
    expect(recoverUnitPreferences(raw)).toEqual({ status: 'invalid' })
  })
  it('converts positive and negative quantities without relabelling', () => {
    expect(convertLengthText('1000', 'ft', 'm')).toBe('304.8')
    expect(convertLengthText('304.8', 'm', 'ft')).toBe('1000')
    expect(convertLengthText('-100', 'ft', 'm')).toBe('-30.48')
    expect(convertLengthText(' 0 ', 'm', 'ft')).toBe('0')
    expect(convertLengthText(' 12.50 ', 'm', 'm')).toBe('12.50')
    expect(isLengthUnit('m')).toBe(true)
    expect(isLengthUnit('ft')).toBe(true)
    expect(isLengthUnit('nm')).toBe(false)
  })
  it.each(['', 'Infinity', 'NaN', '1x', '0x10', '1e999'])('leaves invalid text %s for field validation', (text) => {
    expect(convertLengthText(text, 'ft', 'm')).toBeNull()
  })
})
