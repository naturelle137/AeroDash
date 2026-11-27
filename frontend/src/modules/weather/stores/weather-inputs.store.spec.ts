import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWeatherInputsStore } from './weather-inputs.store'

beforeEach(() => setActivePinia(createPinia()))

describe('weather inputs store', () => {
  it('starts empty with default units and persists nothing', () => {
    const store = useWeatherInputsStore()
    expect(store.temperature).toBe('')
    expect(store.wind).toEqual({ windDirection: '', windSpeed: '', unit: 'kt', gustSpeed: '' })
    expect(store.qnh).toEqual({ qnh: '', qnhUnit: 'hPa' })
    expect(localStorage.length).toBe(0)
  })
  it('copies retrieved values with their unit and marks the source', () => {
    const store = useWeatherInputsStore()
    store.copyRetrieved('wind', { wind: { direction: '180', speed: '5', unit: 'm/s' } }, 'METAR TEST')
    store.copyRetrieved('temperature', { temperature: '-3' }, 'METAR TEST')
    store.copyRetrieved('qnh', { qnh: '995' }, 'METAR TEST')
    expect(store.wind).toMatchObject({ windDirection: '180', windSpeed: '5', unit: 'm/s' })
    expect(store.temperature).toBe('-3')
    expect(store.qnh).toEqual({ qnh: '995', qnhUnit: 'hPa' })
    expect(store.sourceOf('wind')).toBe('METAR TEST')
  })
  it('ignores a copy that has no value for the field', () => {
    const store = useWeatherInputsStore()
    store.copyRetrieved('temperature', {}, 'METAR TEST')
    expect(store.temperature).toBe('')
    expect(store.sourceOf('temperature')).toBeNull()
  })
  it('drops the source note as soon as the copied value is edited', () => {
    const store = useWeatherInputsStore()
    store.copyRetrieved('qnh', { qnh: '995' }, 'METAR TEST')
    store.qnh.qnh = '996'
    expect(store.sourceOf('qnh')).toBeNull()
    store.copyRetrieved('wind', { wind: { direction: '180', speed: '5', unit: 'kt' } }, 'TAF TEST')
    store.wind.unit = 'km/h'
    expect(store.sourceOf('wind')).toBeNull()
  })
  it('clears a gust when direction or speed changes', () => {
    const store = useWeatherInputsStore()
    Object.assign(store.wind, { windDirection: '180', windSpeed: '5' })
    store.wind.gustSpeed = '12'
    store.wind.windSpeed = '6'
    expect(store.wind.gustSpeed).toBe('')
  })
  it('clear() empties values and notes', () => {
    const store = useWeatherInputsStore()
    store.copyRetrieved('temperature', { temperature: '10' }, 'METAR TEST')
    store.clear()
    expect(store.temperature).toBe('')
    expect(store.sources).toEqual({})
  })
})
