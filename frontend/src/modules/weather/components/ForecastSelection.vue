<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { QNH_SUPPORTED_HPA } from '@/core/logic/pressure-altitude'
import type { MetarValues } from '../metar-values'
import { parseForecast, parseGlobalForecast } from '../forecast'

defineProps<{ currentQnh?: string; currentQnhUnit?: string }>()
const emit = defineEmits<{ apply: [field: keyof MetarValues, values: MetarValues, source: string]; selection: [value: { location: string; time: number; forecast: MetarValues } | null] }>()
const phase = ref('departure')
const location = ref('')
const time = ref('')
const temperature = ref('')
const qnhUnit = ref<'hPa' | 'inHg'>('hPa')
const qnhInput = ref<HTMLInputElement | null>(null)
const confirmQnhTimes = ref(false)
const confirmFlightTime = ref(false)
const qnhUtcTime = ref('')
const qnhUtcMessage = ref('')
const emptyQnhDraft = () => ({ value: '', source: '', sourceTime: '', timeKind: '', validFrom: '', validTo: '' })
const qnhDrafts = reactive({ hPa: emptyQnhDraft(), inHg: emptyQnhDraft() })
const draft = computed(() => qnhDrafts[qnhUnit.value])
const qnh = computed({ get: () => draft.value.value, set: value => { draft.value.value = value } })
const qnhSource = computed({ get: () => draft.value.source, set: value => { draft.value.source = value } })
const qnhTimeKind = computed({ get: () => draft.value.timeKind, set: value => { draft.value.timeKind = value } })
const qnhSourceTime = computed({ get: () => draft.value.sourceTime, set: value => { draft.value.sourceTime = value } })
const qnhValidFrom = computed({ get: () => draft.value.validFrom, set: value => { draft.value.validFrom = value } })
const qnhValidTo = computed({ get: () => draft.value.validTo, set: value => { draft.value.validTo = value } })
const direction = ref('')
const speed = ref('')
const unit = ref<'kt' | 'm/s'>('kt')
const online = ref(navigator.onLine)
const forecast = ref<ReturnType<typeof parseForecast>>(null)
const forecastMessage = ref('Select a US ICAO station and an exact hour to retrieve a forecast.')
const retrieved = ref('')
const latitude = ref('')
const longitude = ref('')
const globalForecast = ref<MetarValues | null>(null)
const globalRetrieved = ref('')
const globalSource = ref<'global' | 'dwd'>('global')
const globalMessage = ref('Enter coordinates and a future exact UTC forecast hour.')
const now = ref(Date.now())
let request = 0
const refresh = () => { now.value = Date.now(); online.value = navigator.onLine; if (!online.value) { request++; forecast.value = null; globalForecast.value = null } }
let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(refresh, 1000)
  window.addEventListener('online', refresh)
  window.addEventListener('offline', refresh)
  window.addEventListener('pageshow', refresh)
  refresh()
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('online', refresh)
  window.removeEventListener('offline', refresh)
  window.removeEventListener('pageshow', refresh)
})
watch([phase, location, time], () => {
  temperature.value = ''; clearQnh(); qnhUtcTime.value = ''; qnhUtcMessage.value = ''; direction.value = ''; speed.value = ''
  request++; forecast.value = null; forecastMessage.value = 'Selection changed; retrieve the forecast again.'
  globalForecast.value = null; globalMessage.value = 'Selection changed; retrieve the forecast again.'
}, { flush: 'sync' })
watch([latitude, longitude], () => { request++; globalForecast.value = null; globalMessage.value = 'Coordinates changed; retrieve the forecast again.' }, { flush: 'sync' })
const numberIn = (value: string, min: number, max: number) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max
const validLocalTime = (value: string) => {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) === value
}
const ambiguousLocalTime = (value: string) => {
  if (!validLocalTime(value)) return false
  const instant = Date.parse(value)
  const offset = new Date(instant).getTimezoneOffset()
  return [-48, 48].some(hours => {
    const otherOffset = new Date(instant + hours * 3600000).getTimezoneOffset()
    const alternative = new Date(instant + (otherOffset - offset) * 60000)
    return otherOffset !== offset && new Date(alternative.getTime() - alternative.getTimezoneOffset() * 60000).toISOString().slice(0, 16) === value
  })
}
const ambiguousFlightTime = computed(() => ambiguousLocalTime(time.value))
const ambiguousQnhTimes = computed(() => [qnhSourceTime.value, qnhValidFrom.value, qnhValidTo.value].some(ambiguousLocalTime))
watch(time, () => { confirmFlightTime.value = false }, { flush: 'sync' })
watch([time, qnhUnit, qnhSourceTime, qnhValidFrom, qnhValidTo], () => { confirmQnhTimes.value = false }, { flush: 'sync' })
const selectionValid = computed(() => location.value.trim() !== '' && validLocalTime(time.value) && (!ambiguousFlightTime.value || confirmFlightTime.value) && Date.parse(time.value) > now.value)
const stale = computed(() => !!forecast.value && (forecast.value.stale || Date.parse(forecast.value.valid) <= now.value || now.value - Date.parse(forecast.value.fetched) > 4 * 60 * 60 * 1000))
const qnhSourceAge = computed(() => {
  const minutes = Math.floor((now.value - Date.parse(qnhSourceTime.value)) / 60000)
  return minutes >= 1440 ? `${Math.floor(minutes / 1440)} days` : `${minutes} minutes`
})
const qnhSourceTimeValid = computed(() => !qnhSourceTime.value || (validLocalTime(qnhSourceTime.value) && Date.parse(qnhSourceTime.value) <= now.value))
const qnhValidityError = computed(() => {
  if (!qnhValidFrom.value && !qnhValidTo.value) return ''
  if (!qnhValidFrom.value || !qnhValidTo.value) return 'Enter both QNH validity times.'
  if (!validLocalTime(qnhValidFrom.value) || !validLocalTime(qnhValidTo.value)) return 'A QNH validity time does not exist in the device time zone; check the clock change.'
  const start = Date.parse(qnhValidFrom.value), end = Date.parse(qnhValidTo.value), selected = Date.parse(time.value)
  if (start >= end) return 'QNH validity must end after it starts.'
  if (!validLocalTime(time.value)) return 'Choose a valid flight time to check QNH validity.'
  if (selected < start) return 'The selected flight time is before QNH validity starts.'
  if (selected >= end) return 'The selected flight time is at or after the QNH validity end, which is excluded.'
  return ''
})
const qnhValidityValid = computed(() => !qnhValidityError.value)
const values = computed<MetarValues>(() => {
  const result: MetarValues = {}
  if (numberIn(temperature.value, -100, 100)) result.temperature = temperature.value
  const pressure = qnhUnit.value === 'inHg' ? Number(qnh.value) * 33.86389 : Number(qnh.value)
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(qnh.value.trim()) && Number.isFinite(pressure) && pressure >= QNH_SUPPORTED_HPA.min && pressure <= QNH_SUPPORTED_HPA.max) result.qnh = qnhUnit.value === 'inHg' ? String(Number(pressure.toFixed(2))) : qnh.value
  if (numberIn(speed.value, 0, 200) && (Number(speed.value) === 0 || numberIn(direction.value, 1, 360))) {
    result.wind = { direction: Number(speed.value) === 0 ? '' : direction.value, speed: speed.value, unit: unit.value }
  }
  return result
})
async function retrieve(): Promise<void> {
  const station = location.value.trim().toUpperCase()
  const selected = Date.parse(time.value)
  if (!online.value || !/^[A-Z]{4}$/.test(station) || !selectionValid.value || new Date(selected).getMinutes() !== 0) {
    forecastMessage.value = 'Enter a four-letter ICAO station and a future exact hour in device local time.'; return
  }
  const current = ++request
  forecast.value = null
  forecastMessage.value = 'Retrieving forecast…'
  try {
    const response = await fetch(`https://wxdecoder.com/api/airports/${station.toLowerCase()}/weather/forecast`, { credentials: 'omit' })
    if (!response.ok) throw new Error('unavailable')
    const data: unknown = await response.json()
    if (current !== request) return
    const now = Date.now()
    forecast.value = parseForecast(data, station, selected, now)
    retrieved.value = new Date(now).toISOString()
    forecastMessage.value = forecast.value ? (forecast.value.stale ? 'Outdated forecast; obtain current weather.' : 'Forecast retrieved; verify with an authorised source.') : 'No forecast available for this station and hour; coverage is limited to US airports.'
  } catch (error) {
    if (current !== request) return
    forecastMessage.value = error instanceof SyntaxError || (error instanceof Error && error.message === 'malformed') ? 'Malformed forecast response.' : 'Forecast retrieval failed or is unavailable.'
  }
}
async function retrieveGlobal(source: 'global' | 'dwd'): Promise<void> {
  const selected = Date.parse(time.value)
  if (!online.value || !selectionValid.value || selected % 3600000 !== 0 || !numberIn(latitude.value, -90, 90) || !numberIn(longitude.value, -180, 180)) {
    globalMessage.value = 'Enter valid coordinates, a location and a future time matching an exact UTC hour.'; return
  }
  const current = ++request
  globalForecast.value = null
  globalSource.value = source
  globalMessage.value = 'Retrieving forecast…'
  const params = new URLSearchParams({ latitude: latitude.value, longitude: longitude.value, hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m', wind_speed_unit: 'kn', timezone: 'GMT', forecast_days: source === 'dwd' ? '7' : '16' })
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/${source === 'dwd' ? 'dwd-icon' : 'forecast'}?${params}`, { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
    if (!response.ok) throw new Error('unavailable')
    const data: unknown = await response.json()
    if (current !== request) return
    globalForecast.value = parseGlobalForecast(data, selected)
    globalRetrieved.value = new Date().toISOString()
    globalMessage.value = globalForecast.value ? 'Forecast retrieved; model issue time is unavailable. Verify with an authorised source.' : 'No forecast available for the selected hour.'
  } catch (error) {
    if (current !== request) return
    globalMessage.value = error instanceof SyntaxError || (error instanceof Error && error.message === 'malformed') ? 'Malformed forecast response.' : 'Forecast retrieval failed or is unavailable.'
  }
}
const globalStale = computed(() => !!globalForecast.value && (Date.parse(time.value) <= now.value || now.value - Date.parse(globalRetrieved.value) > 4 * 60 * 60 * 1000))
watch([selectionValid, location, time, forecast, stale, globalForecast, globalStale, globalRetrieved, online], () => {
  emit('selection', selectionValid.value && online.value ? {
    location: location.value.trim().toUpperCase(), time: Date.parse(time.value),
    forecast: { ...(!stale.value ? forecast.value?.values : {}), ...(!globalStale.value ? globalForecast.value : {}) },
  } : null)
}, { immediate: true, flush: 'sync' })
function applyGlobal(field: 'temperature' | 'wind'): void {
  if (!online.value || !selectionValid.value || !globalForecast.value || !globalForecast.value[field] || globalStale.value || Date.parse(time.value) <= Date.now() || Date.now() - Date.parse(globalRetrieved.value) > 4 * 60 * 60 * 1000) return
  emit('apply', field, globalForecast.value, `Open-Meteo ${globalSource.value === 'dwd' ? 'DWD ICON forecast' : 'model forecast'} for ${location.value.trim()} (${latitude.value}, ${longitude.value}), valid ${new Date(time.value).toISOString()}, retrieved ${globalRetrieved.value}; model issue time unavailable`)

}

function applyRetrieved(field: 'temperature' | 'wind'): void {
  const current = forecast.value
  if (!online.value || !selectionValid.value || !current || current.stale || Date.parse(current.valid) <= Date.now() || Date.now() - Date.parse(current.fetched) > 4 * 60 * 60 * 1000 || !current.values[field]) return
  emit('apply', field, current.values, `NWS forecast via wxdecoder.com for ${location.value.trim().toUpperCase()}, valid ${current.valid}, retrieved ${retrieved.value}`)
}

function useQnhUtcTime(field: 'sourceTime' | 'validFrom' | 'validTo'): void {
  const instant = Date.parse(`${qnhUtcTime.value}Z`)
  if (!qnhUtcTime.value || !Number.isFinite(instant)) { qnhUtcMessage.value = 'Enter a valid UTC date and time.'; return }
  const local = new Date(instant)
  const value = new Date(instant - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  if (Date.parse(value) !== instant) { qnhUtcMessage.value = 'This UTC time is the second occurrence of a repeated local time and cannot be represented here.'; return }
  draft.value[field] = value
  const destination = { sourceTime: 'source time', validFrom: 'valid from', validTo: 'valid until' }[field]
  qnhUtcMessage.value = `Copied ${qnhUtcTime.value.replace('T', ' ')} UTC to QNH ${destination} as ${value.replace('T', ' ')} device local time.`
}

function clearQnh(): void {
  Object.assign(qnhDrafts.hPa, emptyQnhDraft())
  Object.assign(qnhDrafts.inHg, emptyQnhDraft())
}

function apply(field: keyof MetarValues): void {
  if (!selectionValid.value || Date.parse(time.value) <= Date.now() || !values.value[field] || (field === 'qnh' && ((ambiguousQnhTimes.value && !confirmQnhTimes.value) || !qnhValidityValid.value || (qnhSourceTime.value && (!qnhSourceTimeValid.value || Date.parse(qnhSourceTime.value) > Date.now()))))) return
  const source = field === 'qnh' && qnhSource.value.trim() ? `; pilot-declared QNH source: ${qnhSource.value.trim()}` : ''
  const sourceTime = field === 'qnh' && qnhSourceTime.value ? `; pilot-declared QNH source time: ${qnhSourceTime.value.replace('T', ' ')} local time (${new Date(qnhSourceTime.value).toISOString()})` : ''
  const timeKind = field === 'qnh' && qnhSourceTime.value && qnhTimeKind.value ? `; pilot-declared QNH time type: ${qnhTimeKind.value}` : ''
  const validity = field === 'qnh' && qnhValidFrom.value && qnhValidTo.value ? `; pilot-declared QNH validity: ${qnhValidFrom.value.replace('T', ' ')} to ${qnhValidTo.value.replace('T', ' ')} local time (${new Date(qnhValidFrom.value).toISOString()} to ${new Date(qnhValidTo.value).toISOString()} UTC; end exclusive)` : ''
  const original = field === 'qnh' ? `; pilot-entered QNH: ${qnh.value.trim()} ${qnhUnit.value}` : ''
  emit('apply', field, values.value, `Pilot-entered forecast for ${phase.value}, ${location.value.trim()}, ${time.value.replace('T', ' ')} local time (${new Date(time.value).toISOString()})${original}${source}${sourceTime}${timeKind}${validity}`)
}
</script>

<template>
  <section class="forecast" aria-labelledby="forecast-heading">
    <h3 id="forecast-heading">Time-specific forecast</h3>
    <p>Enter your own forecast values for the selected location and device local time. These pilot-entered values are not an official forecast. Entries are not saved or sent. Changing the selection clears these entries.</p>
    <div class="fields">
      <label>Flight phase
        <select v-model="phase"><option value="departure">Departure</option><option value="arrival">Arrival</option></select>
      </label>
      <label>Location
        <input v-model="location" type="text" autocomplete="off" placeholder="Airport or location" />
      </label>
      <label>Local date and time
        <input v-model="time" type="datetime-local" />
      </label>
    </div>
    <label v-if="ambiguousFlightTime"><input v-model="confirmFlightTime" type="checkbox" /> This flight time occurs twice during a clock change. The browser uses {{ new Date(time).toISOString() }}; I checked this UTC time.</label>
    <button type="button" :disabled="!online || (ambiguousFlightTime && !confirmFlightTime)" @click="retrieve">Retrieve US forecast</button>
    <p role="status" aria-live="polite">{{ online ? forecastMessage : 'Browser offline: forecast retrieval is unavailable.' }}</p>
    <div v-if="forecast">
      <p>US airport coverage · NWS via <a href="https://wxdecoder.com">wxdecoder.com</a> · Sources: NOAA/NWS Aviation Weather Center, National Weather Service and FAA.</p>
      <p>Forecast hour: {{ forecast.valid }} · Source fetched: {{ forecast.fetched }} · Retrieved: {{ retrieved }}{{ stale ? ' · OUTDATED' : '' }}</p>
      <p>Temperature: {{ forecast.values.temperature ?? 'unavailable' }} °C · Wind: {{ forecast.values.wind ? `${forecast.values.wind.direction || 'calm'}° true / ${forecast.values.wind.speed} kt` : 'unavailable' }} · Forecast QNH: unavailable.</p>
      <button type="button" :disabled="!selectionValid || stale || !forecast.values.temperature" @click="applyRetrieved('temperature')">Replace temperature with retrieved forecast</button>
      <button type="button" :disabled="!selectionValid || stale || !forecast.values.wind" @click="applyRetrieved('wind')">Replace wind with retrieved forecast</button>
    </div>
    <div class="fields">
      <label>Latitude (°)<input v-model="latitude" type="text" inputmode="decimal" min="-90" max="90" step="any" /></label>
      <label>Longitude (°)<input v-model="longitude" type="text" inputmode="decimal" min="-180" max="180" step="any" /></label>
    </div>
    <p>Coordinates are sent to Open-Meteo on request; its free API is for non-commercial use.</p>

    <button type="button" :disabled="!online || (ambiguousFlightTime && !confirmFlightTime)" @click="retrieveGlobal('dwd')">Retrieve DWD ICON forecast</button>
    <button type="button" :disabled="!online || (ambiguousFlightTime && !confirmFlightTime)" @click="retrieveGlobal('global')">Retrieve global model forecast</button>

    <p aria-live="polite">{{ online ? globalMessage : 'Browser offline: forecast retrieval is unavailable.' }}</p>
    <div v-if="globalForecast">
      <p>Weather data by <a href="https://open-meteo.com/">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · Model values presented without conversion.</p>
      <p>{{ globalSource === 'dwd' ? 'DWD ICON' : 'Global model' }} forecast hour: {{ new Date(time).toISOString() }} · Retrieved: {{ globalRetrieved }} · Model issue time: unavailable{{ globalStale ? ' · OUTDATED' : '' }}</p>
      <p>Temperature: {{ globalForecast.temperature ?? 'unavailable' }} °C · Wind: {{ globalForecast.wind ? `${globalForecast.wind.direction || 'calm'}° true / ${globalForecast.wind.speed} kt` : 'unavailable' }} · Forecast QNH: unavailable.</p>

      <button type="button" :disabled="!selectionValid || globalStale || !globalForecast.temperature" @click="applyGlobal('temperature')">Replace temperature with {{ globalSource === 'dwd' ? 'DWD ICON' : 'global' }} forecast</button>
      <button type="button" :disabled="!selectionValid || globalStale || !globalForecast.wind" @click="applyGlobal('wind')">Replace wind with {{ globalSource === 'dwd' ? 'DWD ICON' : 'global' }} forecast</button>

    </div>
    <p>For education and situational awareness only, not an official briefing or go/no-go authority. Obtain required weather from an authorised source.</p>
    <p>Forecast QNH is unavailable from these services. Obtain aviation QNH from an authorised source and enter it below; do not substitute model sea-level pressure. Wind direction is true; gusts are not applied. Values require a future time and are applied only when selected.</p>
    <button type="button" @click="qnhInput?.focus()">Enter aviation QNH manually</button>
    <div class="fields">
      <label>Forecast temperature (°C)<input v-model="temperature" type="text" inputmode="decimal" min="-100" max="100" step="any" /></label>
      <label>Forecast QNH ({{ qnhUnit }})<input ref="qnhInput" v-model="qnh" type="text" inputmode="decimal" /></label>
      <label>QNH unit<select v-model="qnhUnit"><option value="hPa">hPa</option><option value="inHg">inHg</option></select></label>
      <label>QNH source (optional)<input v-model="qnhSource" type="text" autocomplete="off" /></label>
      <label>QNH time type (optional)<select v-model="qnhTimeKind"><option value="">Not specified</option><option value="issue">Issue time</option><option value="retrieval">Retrieval time</option></select></label>
      <label>QNH source time (optional, local)<input v-model="qnhSourceTime" type="datetime-local" /></label>
      <label>QNH valid from (optional, local)<input v-model="qnhValidFrom" type="datetime-local" /></label>
      <label>QNH valid until (optional, local)<input v-model="qnhValidTo" type="datetime-local" /></label>
      <label>Forecast wind direction (° true)<input v-model="direction" type="text" inputmode="decimal" min="1" max="360" step="any" /></label>
      <label>Forecast wind speed<input v-model="speed" type="text" inputmode="decimal" min="0" max="200" step="any" /></label>
      <label>Forecast wind unit<select v-model="unit"><option value="kt">kt</option><option value="m/s">m/s</option></select></label>
    </div>
    <label>QNH source or validity time in UTC<input v-model="qnhUtcTime" type="datetime-local" /></label>
    <div class="fields">
      <button type="button" @click="useQnhUtcTime('sourceTime')">Copy UTC to QNH source time</button>
      <button type="button" @click="useQnhUtcTime('validFrom')">Copy UTC to QNH valid from</button>
      <button type="button" @click="useQnhUtcTime('validTo')">Copy UTC to QNH valid until</button>
    </div>
    <p aria-live="polite">{{ qnhUtcMessage }}</p>
    <p>QNH entries and their source details are kept separately for each unit; switching units does not convert the entry.</p>
    <p>QNH drafts: hPa {{ Object.values(qnhDrafts.hPa).some(Boolean) ? 'present' : 'empty' }} · inHg {{ Object.values(qnhDrafts.inHg).some(Boolean) ? 'present' : 'empty' }}.</p>
    <button type="button" :disabled="!Object.values(draft).some(Boolean)" @click="Object.assign(draft, emptyQnhDraft())">Clear current {{ qnhUnit }} QNH draft</button>
    <p v-if="qnh.trim() && values.qnh">QNH to apply: {{ values.qnh }} hPa. Applying replaces the current Flight Prep QNH.</p>
    <p v-else-if="qnh.trim()" role="alert">QNH is outside the supported range or is not a valid number; check the value and unit.</p>
    <p v-if="qnh.trim()">Current Flight Prep QNH: {{ currentQnh?.trim() ? `${currentQnh} ${currentQnhUnit}` : 'not entered' }}.</p>
    <p v-if="qnh.trim() && selectionValid">QNH selection: {{ phase }} · {{ location.trim() }} · {{ time.replace('T', ' ') }} device local time ({{ new Date(time).toISOString() }}). Verify that the source applies to this location and time; check the UTC time when clocks change.</p>
    <button type="button" :disabled="!Object.values(qnhDrafts).some(draft => Object.values(draft).some(Boolean))" @click="clearQnh">Clear QNH entry and source</button>
    <p>Optional QNH validity: enter both local times; the selected flight time must be within the interval (end excluded). The pilot declares and verifies this interval.</p>
    <p v-if="qnhSourceTime && qnhSourceTimeValid">QNH source time in UTC: {{ new Date(qnhSourceTime).toISOString() }}.</p>
    <p v-if="qnhValidFrom && qnhValidTo && qnhValidityValid">QNH validity in UTC: {{ new Date(qnhValidFrom).toISOString() }} to {{ new Date(qnhValidTo).toISOString() }} (end excluded).</p>
    <label v-if="ambiguousQnhTimes"><input v-model="confirmQnhTimes" type="checkbox" /> Some QNH times occur twice during a clock change. I checked the displayed UTC interpretations against the source.</label>
    <p v-if="qnhValidityError" role="alert">{{ qnhValidityError }}</p>
    <p v-if="qnh.trim() && !qnhSource.trim()">QNH source not recorded; verify its origin.</p>
    <p v-if="qnh.trim() && !qnhSourceTime">QNH source time not recorded; its age is unknown.</p>
    <p v-else-if="qnh.trim() && qnhSourceTimeValid">Pilot-declared QNH source time was {{ qnhSourceAge }} ago; this does not establish freshness.</p>
    <p v-if="qnh.trim() && qnhSourceTime && !qnhTimeKind">QNH source time type not recorded; issue and retrieval times are different.</p>
    <p v-if="qnh.trim() && !qnhValidFrom && !qnhValidTo">QNH validity not recorded; verify it covers the selected flight time.</p>
    <p v-if="!qnhSourceTimeValid" role="alert">QNH source time must exist in the device time zone and must not be in the future.</p>
    <p v-if="time && !validLocalTime(time)" role="alert">Selected local time does not exist in the device time zone; check the clock change.</p>
    <p v-if="time && Number.isFinite(Date.parse(time)) && Date.parse(time) <= now">Selected time has passed; pilot-entered forecast values are outdated.</p>
    <p v-else-if="!selectionValid">Choose a location and future local time to apply values.</p>
    <p>Available pilot entries: temperature {{ values.temperature ? 'entered' : 'missing or invalid' }}, QNH {{ values.qnh ? 'entered' : 'missing or invalid' }}, wind {{ values.wind ? 'entered' : 'missing or invalid' }}.</p>
    <div class="fields">
      <button type="button" :disabled="!selectionValid || !values.temperature" @click="apply('temperature')">Apply forecast temperature</button>
      <button type="button" :disabled="!selectionValid || !values.qnh || !qnhSourceTimeValid || !qnhValidityValid || (ambiguousQnhTimes && !confirmQnhTimes)" @click="apply('qnh')">Apply forecast QNH</button>
      <button type="button" :disabled="!selectionValid || !values.wind" @click="apply('wind')">Apply forecast wind</button>
    </div>
  </section>
</template>

<style scoped>
.forecast { display: grid; gap: .75rem; min-width: 0; }
h3, p { margin: 0; }
button { min-height: 44px; }
p { line-height: 1.6; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
label { display: grid; gap: .5rem; min-width: 0; }
input, select { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; min-width: 0; box-sizing: border-box; width: 100%; scroll-margin-bottom: calc(8rem + env(safe-area-inset-bottom, 0px)); }
</style>
