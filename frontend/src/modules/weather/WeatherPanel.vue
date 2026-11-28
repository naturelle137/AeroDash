<script setup lang="ts">
import { useConnectivityStore } from '@/modules/connectivity/connectivity.store'

const { online } = useConnectivityStore()
import TafView from './TafView.vue'
import type { TafWind } from './taf-surface'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { metarLiquid, metarHeavyRain } from './metar-surface'
import { useWeatherInputsStore } from './stores/weather-inputs.store'
import { WIND_SPEED_UNITS } from '@/core/logic/wind-components'
import { QNH_UNITS } from '@/core/logic/pressure-altitude'
import { metarValues, type MetarValues } from './metar-values'

const inputs = useWeatherInputsStore()
const props = defineProps<{ selection?: { location: string; time: number; forecast: MetarValues } | null }>()
const emit = defineEmits<{ forecast: [value: { station: string; time: string; source: 'TAF'; validFrom: string; validTo: string; liquid: boolean; heavy?: boolean } | null]; observation: [value: { station: string; time: string; source?: 'manual METAR'; liquid: boolean; heavy?: boolean } | null]; apply: [field: keyof MetarValues, values: MetarValues, source: string] }>()
type TafSource = { station: string; issued: string; validFrom: string; validTo: string; wind: TafWind }
const taf = ref<TafSource | null>(null)
const applicableTaf = computed(() => taf.value && props.selection && taf.value.station === props.selection.location ? taf.value : null)
const age = (time: string): string => `${Math.max(0, Math.round((Date.now() - Date.parse(time)) / 60000))} min ago`
function applyTaf(): void {
  const current = applicableTaf.value
  const selected = props.selection?.time
  if (!current || !selected || selected <= Date.now() || selected < Date.parse(current.validFrom) || selected >= Date.parse(current.validTo)) return
  emit('apply', 'wind', { wind: current.wind }, `TAF ${current.station} via wxdecoder.com, issued ${current.issued}, valid ${current.validFrom} to ${current.validTo}, forecast for ${new Date(selected).toISOString()}`)
}
const values = computed(() => report.value && !report.value.stale ? metarValues(report.value.raw) : {})
function apply(field: keyof MetarValues): void {
  const current = report.value
  if (!current || current.stale || Date.now() - Date.parse(current.time) > 60 * 60 * 1000 || !values.value[field]) return
  emit('apply', field, values.value, `METAR ${current.station} via wxdecoder.com, observed ${current.time}`)
}
const manualMetar = ref('')
const manualMessage = ref('')
function useManualMetar(): void {
  clearReport()
  const raw = manualMetar.value.trim().toUpperCase()
  const match = /^(?:METAR |SPECI )?([A-Z]{4}) (\d{2})(\d{2})(\d{2})Z\s+(.+)$/.exec(raw)
  const now = Date.now()
  const observed = new Date(now)
  observed.setUTCSeconds(0, 0)
  observed.setUTCHours(Number(match?.[3]), Number(match?.[4]))
  if (observed.getTime() > now) observed.setUTCDate(observed.getUTCDate() - 1)
  const liquid = match ? metarLiquid(match[5]!) : null
  if (!match || Number(match[2]) !== observed.getUTCDate() || Number(match[3]) > 23 || Number(match[4]) > 59 || now - observed.getTime() > 3600000 || liquid === null) {
    manualMessage.value = 'Invalid or outdated METAR; no surface suggestion. Verify the report and observation time.'
    return
  }
  const time = observed.toISOString()
  emit('observation', { station: match[1]!, time, source: 'manual METAR', liquid, heavy: metarHeavyRain(match[5]!) === true })
  manualMessage.value = `Manual METAR ${match[1]}, observed ${time} UTC (unverified). Verify the actual runway condition.`
  expiry = setTimeout(() => { emit('observation', null); manualMessage.value = 'Manual METAR is outdated; verify current conditions.' }, 3600000 - (now - observed.getTime()) + 1)
}
const icao = ref('')
const message = ref('Enter a station to retrieve a METAR.')
const report = ref<{ raw: string; station: string; time: string; stale: boolean } | null>(null)
const loading = ref(false)
let expiry: ReturnType<typeof setTimeout> | undefined
let request = 0
function offline(): void {
  clearReport()
  loading.value = false
  message.value = 'Offline: METAR retrieval is unavailable.'
}
onMounted(() => window.addEventListener('offline', offline))
onUnmounted(() => { clearTimeout(expiry); window.removeEventListener('offline', offline); emit('observation', null) })

function clearReport(): void {
  clearTimeout(expiry)
  request++
  report.value = null
  emit('observation', null)
}

async function check(): Promise<void> {
  clearReport()
  const currentRequest = request
  const station = icao.value.trim().toUpperCase()
  if (!/^[A-Z]{4}$/.test(station)) {
    message.value = 'Enter a four-letter ICAO station code.'
    return
  }
  if (!navigator.onLine) {
    message.value = 'Offline: METAR retrieval is unavailable.'
    return
  }
  loading.value = true
  message.value = 'Loading METAR…'
  try {
    const response = await fetch(`https://wxdecoder.com/api/wx/${station}`, { credentials: 'omit' })
    if (!response.ok) throw new Error('unavailable')
    const data: unknown = await response.json()
    if (currentRequest !== request || !navigator.onLine) return
    if (!data || typeof data !== 'object' || !('metar' in data)) throw new Error('malformed')
    const metar: unknown = data.metar
    if (metar === null) {
      message.value = 'No METAR available for this station.'
      return
    }
    if (!metar || typeof metar !== 'object' || !('raw' in metar) || typeof metar.raw !== 'string' || !('station' in metar) || metar.station !== station || !('reportTime' in metar) || typeof metar.reportTime !== 'string' || !('reportTimeKnown' in metar) || metar.reportTimeKnown !== true) throw new Error('malformed')
    const time = Date.parse(metar.reportTime)
    const rawMatch = metar.raw.match(/^(?:METAR |SPECI )?([A-Z]{4}) (\d{2})(\d{2})(\d{2})Z\b/)
    const observed = new Date(time)
    if (!Number.isFinite(time) || time > Date.now() || !rawMatch || rawMatch[1] !== station || Number(rawMatch[2]) !== observed.getUTCDate() || Number(rawMatch[3]) !== observed.getUTCHours() || Number(rawMatch[4]) !== observed.getUTCMinutes()) throw new Error('malformed')
    report.value = { raw: metar.raw, station, time: observed.toISOString(), stale: Date.now() - time > 60 * 60 * 1000 }
    if (!report.value.stale) {
      const liquid = metarLiquid(metar.raw.slice(rawMatch[0].length).trim())
      emit('observation', liquid === null ? null : { station, time: observed.toISOString(), liquid, heavy: metarHeavyRain(metar.raw.slice(rawMatch[0].length).trim()) === true })
    }
    message.value = report.value.stale ? 'Outdated observation: verify current weather with an authorised source.' : 'Observation retrieved; verify with an authorised source.'
    if (!report.value.stale) {
      expiry = setTimeout(() => {
        if (report.value) report.value.stale = true
        emit('observation', null)
        message.value = 'Outdated observation: verify current weather with an authorised source.'
      }, 60 * 60 * 1000 - (Date.now() - time) + 1)
    }
  } catch (error) {
    if (currentRequest !== request) return
    message.value = error instanceof Error && error.message === 'malformed' ? 'Malformed METAR response; no report displayed.' : 'METAR retrieval failed or is unavailable.'
  } finally {
    if (currentRequest === request) loading.value = false
  }
}
</script>

<template>
  <div class="weather-panel">
    <p>For education and situational awareness only, not an official briefing or a go/no-go authority. Obtain required weather from an authorised briefing source.</p>
    <fieldset class="inputs">
      <legend>Weather inputs for Flight Prep (this session only)</legend>
      <p>Enter temperature, wind and QNH once; Performance reuses them unless you enter a value there. Works offline. Values you type are yours; values copied from a METAR, TAF or forecast are retrieved and unverified.</p>
      <div class="grid">
        <label>Temperature (°C)<input id="weather-temperature" v-model="inputs.temperature" type="text" inputmode="text" autocomplete="off" /></label>
        <label>Wind from (°, 1–360)<input id="weather-wind-direction" v-model="inputs.wind.windDirection" type="text" inputmode="decimal" autocomplete="off" /></label>
        <label>Wind speed<input id="weather-wind-speed" v-model="inputs.wind.windSpeed" type="text" inputmode="decimal" autocomplete="off" /></label>
        <label>Wind speed unit<select id="weather-wind-unit" v-model="inputs.wind.unit"><option v-for="unit in WIND_SPEED_UNITS" :key="unit" :value="unit">{{ unit }}</option></select></label>
        <label>Gust speed (optional)<input id="weather-wind-gust" v-model="inputs.wind.gustSpeed" type="text" inputmode="decimal" autocomplete="off" /></label>
        <label>QNH<input id="weather-qnh" v-model="inputs.qnh.qnh" type="text" inputmode="decimal" autocomplete="off" /></label>
        <label>QNH unit<select id="weather-qnh-unit" v-model="inputs.qnh.qnhUnit"><option v-for="unit in QNH_UNITS" :key="unit" :value="unit">{{ unit }}</option></select></label>
      </div>
      <p v-for="field in (['wind', 'temperature', 'qnh'] as const)" :key="field">
        <template v-if="inputs.sourceOf(field)">{{ field }} source: {{ inputs.sourceOf(field) }} (retrieved, unverified)</template>
      </p>
      <button type="button" @click="inputs.clear()">Clear weather inputs</button>
    </fieldset>
    <form @submit.prevent="check">
      <label for="weather-icao">ICAO station code</label>
      <div class="entry">
        <input id="weather-icao" v-model="icao" type="text" maxlength="4" autocomplete="off" :disabled="loading" @input="clearReport" />
        <button type="submit" :disabled="loading || !online">Check METAR</button>
      </div>
    </form>
    <p role="status">{{ online ? message : 'Offline: METAR retrieval is unavailable.' }}</p>
    <div v-if="report">
      <p>Station: {{ report.station }} · Observed: {{ report.time }} UTC{{ report.stale ? ' · OUTDATED' : '' }}</p>
      <p>{{ report.raw }}</p>
      <div v-if="!report.stale" class="entry" aria-label="Apply observation to Flight Prep">
        <button v-if="values.wind && !(applicableTaf && report.station === applicableTaf.station)" type="button" @click="apply('wind')">Replace wind with METAR ({{ values.wind.direction || 'calm' }} / {{ values.wind.speed }} {{ values.wind.unit }})</button>
        <button v-if="values.temperature" type="button" @click="apply('temperature')">Replace temperature with METAR ({{ values.temperature }} °C)</button>
        <button v-if="values.qnh" type="button" @click="apply('qnh')">Replace QNH with METAR ({{ values.qnh }} hPa)</button>
      </div>
      <template v-for="field in (['wind', 'temperature', 'qnh'] as const)" :key="field">
        <p v-if="!report.stale && values[field] && !((field === 'wind' && applicableTaf && report.station === applicableTaf.station) || (props.selection?.location === report.station && props.selection.forecast[field]))">{{ field }}: no forecast available — this is a METAR observation from {{ report.station }}, observed {{ report.time }} UTC ({{ age(report.time) }}).</p>
      </template>
      <p>Weather data via <a href="https://wxdecoder.com">wxdecoder.com</a>. Sources: NOAA/NWS Aviation Weather Center, National Weather Service and FAA.</p>
    </div>
    <div v-if="applicableTaf" class="entry" aria-label="Apply forecast wind to Flight Prep">
      <button type="button" @click="applyTaf">Replace wind with TAF forecast ({{ applicableTaf.wind.direction || 'calm' }} / {{ applicableTaf.wind.speed }} {{ applicableTaf.wind.unit }})</button>
      <p>Forecast wind from TAF {{ applicableTaf.station }}, issued {{ applicableTaf.issued }} UTC ({{ age(applicableTaf.issued) }}), valid {{ applicableTaf.validFrom }} to {{ applicableTaf.validTo }} UTC, for selected flight time {{ new Date(props.selection!.time).toISOString() }}. Forecast, not an observation. Temperature and QNH are not taken from the TAF.</p>
    </div>
    <p v-if="report && taf && report.station !== taf.station" role="alert">The METAR station {{ report.station }} differs from the TAF station {{ taf.station }}.</p>
    <TafView embedded :flight-time="props.selection?.time" @forecast="emit('forecast', $event)" @wind="taf = $event" />
    <form @submit.prevent="useManualMetar">
      <label for="manual-metar">Paste METAR for runway surface</label>
      <textarea id="manual-metar" v-model="manualMetar" rows="3" @input="clearReport(); manualMessage = ''" />
      <button type="submit">Use pasted METAR</button>
      <p v-if="manualMessage" role="status">{{ manualMessage }}</p>
    </form>
    <p>Liquid precipitation may suggest a runway surface condition; verify the actual runway condition.</p>
    <p>Values are only replaced when you choose an action. METAR wind direction is true; use a runway heading in the same reference. Gusts are not applied. Verify all values with an authorised source.</p>
  </div>
</template>

<style scoped>
.weather-panel { display: grid; gap: .75rem; }
p { margin: 0; line-height: 1.5; overflow-wrap: anywhere; }
form { display: grid; gap: .4rem; }
.entry { display: flex; flex-wrap: wrap; gap: .5rem; }
fieldset.inputs { display: grid; gap: .5rem; border: 1px solid var(--color-border); border-radius: 8px; margin: 0; min-width: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: .75rem; }
label { display: grid; gap: .25rem; }
.grid input, .grid select { max-width: none; text-transform: none; }
input { max-width: 8rem; text-transform: uppercase; }
textarea { width: 100%; padding: .5rem; }
select, input, button { min-height: 44px; padding: .5rem; }
</style>
