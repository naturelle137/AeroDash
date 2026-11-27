import { describe, expect, it } from 'vitest'
import { resolveQnh, resolveScalar, resolveWind } from './weather-inputs'

describe('resolveScalar', () => {
  it('prefers a manual override over the shared value', () => {
    expect(resolveScalar('15', '20')).toEqual({ value: '15', source: 'manual' })
  })
  it('falls back to the shared value when the override is blank or whitespace', () => {
    expect(resolveScalar('', '20')).toEqual({ value: '20', source: 'weather' })
    expect(resolveScalar('  ', '-5')).toEqual({ value: '-5', source: 'weather' })
  })
  it('substitutes nothing when both are blank', () => {
    expect(resolveScalar('', ' ')).toEqual({ value: '', source: 'none' })
  })
  it('keeps invalid override text so existing validation still reports it', () => {
    expect(resolveScalar('abc', '20')).toEqual({ value: 'abc', source: 'manual' })
  })
})

describe('resolveQnh', () => {
  it('takes value and unit together from the winning side', () => {
    expect(resolveQnh({ qnh: '29.92', qnhUnit: 'inHg' }, { qnh: '1013', qnhUnit: 'hPa' }))
      .toEqual({ value: { qnh: '29.92', qnhUnit: 'inHg' }, source: 'manual' })
    expect(resolveQnh({ qnh: '', qnhUnit: 'inHg' }, { qnh: '1013', qnhUnit: 'hPa' }))
      .toEqual({ value: { qnh: '1013', qnhUnit: 'hPa' }, source: 'weather' })
  })
  it('keeps the override unit when nothing is entered', () => {
    expect(resolveQnh({ qnh: '', qnhUnit: 'inHg' }, { qnh: '', qnhUnit: 'hPa' }))
      .toEqual({ value: { qnh: '', qnhUnit: 'inHg' }, source: 'none' })
  })
})

describe('resolveWind', () => {
  const shared = { windDirection: '270', windSpeed: '12', unit: 'kt', gustSpeed: '20' }
  it('uses the shared wind, gust included, when the override is empty', () => {
    expect(resolveWind({ windDirection: '', windSpeed: '', unit: 'm/s', gustSpeed: '' }, shared)).toEqual({ value: shared, source: 'weather' })
  })
  it('replaces the whole shared wind when either override part is entered', () => {
    const override = { windDirection: '', windSpeed: '5', unit: 'm/s', gustSpeed: '' }
    expect(resolveWind(override, shared)).toEqual({ value: override, source: 'manual' })
  })
  it('reports none when nothing is entered anywhere', () => {
    const empty = { windDirection: '', windSpeed: '', unit: 'kt', gustSpeed: '' }
    expect(resolveWind(empty, empty).source).toBe('none')
  })
  it('treats a calm shared wind (speed 0, no direction) as entered', () => {
    const calm = { windDirection: '', windSpeed: '0', unit: 'kt', gustSpeed: '' }
    expect(resolveWind({ ...calm, windSpeed: '' }, calm).source).toBe('weather')
  })
})
