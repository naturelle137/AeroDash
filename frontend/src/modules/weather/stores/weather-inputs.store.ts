import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'
import type { MetarValues } from '../metar-values'

export type WeatherField = keyof MetarValues
export type WeatherSource = { source: string; value: string }

/**
 * One session-only set of temperature, wind and QNH, entered by the pilot in Weather and
 * read by Performance. Nothing is persisted. A retrieved value is copied only by an explicit
 * action and keeps its source note until the pilot edits it; it is never verified here.
 */
export const useWeatherInputsStore = defineStore('weatherInputs', () => {
  const temperature = ref('')
  const wind = reactive({ windDirection: '', windSpeed: '', unit: 'kt', gustSpeed: '' })
  const qnh = reactive({ qnh: '', qnhUnit: 'hPa' })
  const sources = ref<Partial<Record<WeatherField, WeatherSource>>>({})

  function fieldValue(field: WeatherField): string {
    if (field === 'wind') return JSON.stringify([wind.windDirection, wind.windSpeed, wind.unit, wind.gustSpeed])
    return field === 'temperature' ? temperature.value : JSON.stringify([qnh.qnh, qnh.qnhUnit])
  }
  // A source note describes exactly the copied text; any later edit removes it.
  watch(() => (['wind', 'temperature', 'qnh'] as const).map(fieldValue), (current) => {
    (['wind', 'temperature', 'qnh'] as const).forEach((field, index) => {
      if (sources.value[field] && sources.value[field].value !== current[index]) delete sources.value[field]
    })
  }, { flush: 'sync' })

  // Like the Performance wind panel: a gust belongs to one direction, speed and unit.
  watch(() => [wind.windDirection, wind.windSpeed, wind.unit], () => { wind.gustSpeed = '' }, { flush: 'sync' })

  function copyRetrieved(field: WeatherField, values: MetarValues, source: string): void {
    if (field === 'wind' && values.wind) Object.assign(wind, { windDirection: values.wind.direction, windSpeed: values.wind.speed, unit: values.wind.unit, gustSpeed: '' })
    else if (field === 'temperature' && values.temperature !== undefined) temperature.value = values.temperature
    else if (field === 'qnh' && values.qnh !== undefined) Object.assign(qnh, { qnh: values.qnh, qnhUnit: 'hPa' })
    else return
    sources.value[field] = { source, value: fieldValue(field) }
  }
  function clear(): void {
    temperature.value = ''
    Object.assign(wind, { windDirection: '', windSpeed: '', unit: 'kt', gustSpeed: '' })
    Object.assign(qnh, { qnh: '', qnhUnit: 'hPa' })
    sources.value = {}
  }
  function sourceOf(field: WeatherField): string | null {
    const note = sources.value[field]
    return note && note.value === fieldValue(field) ? note.source : null
  }

  return { temperature, wind, qnh, sources, copyRetrieved, clear, sourceOf }
})
