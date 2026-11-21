<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { metarValues, type MetarValues } from './metar-values'

const emit = defineEmits<{ apply: [field: keyof MetarValues, values: MetarValues, source: string] }>()
const values = computed(() => report.value && !report.value.stale ? metarValues(report.value.raw) : {})
function apply(field: keyof MetarValues): void {
  const current = report.value
  if (!current || current.stale || Date.now() - Date.parse(current.time) > 60 * 60 * 1000 || !values.value[field]) return
  emit('apply', field, values.value, `METAR ${current.station} via wxdecoder.com, observed ${current.time}`)
}

const icao = ref('')
const message = ref('Enter a station to retrieve a METAR.')
const report = ref<{ raw: string; station: string; time: string; stale: boolean } | null>(null)
const loading = ref(false)
let expiry: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(expiry))

function clearReport(): void {
  clearTimeout(expiry)
  report.value = null
}

async function check(): Promise<void> {
  clearReport()
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
    message.value = report.value.stale ? 'Outdated observation: verify current weather with an authorised source.' : 'Observation retrieved; verify with an authorised source.'
    if (!report.value.stale) {
      expiry = setTimeout(() => {
        if (report.value) report.value.stale = true
        message.value = 'Outdated observation: verify current weather with an authorised source.'
      }, 60 * 60 * 1000 - (Date.now() - time) + 1)
    }
  } catch (error) {
    message.value = error instanceof Error && error.message === 'malformed' ? 'Malformed METAR response; no report displayed.' : 'METAR retrieval failed or is unavailable.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="weather-panel">
    <p>For education and situational awareness only, not an official briefing or a go/no-go authority. Obtain required weather from an authorised briefing source.</p>
    <form @submit.prevent="check">
      <label for="weather-icao">ICAO station code</label>
      <div class="entry">
        <input id="weather-icao" v-model="icao" type="text" maxlength="4" autocomplete="off" :disabled="loading" @input="clearReport" />
        <button type="submit" :disabled="loading">Check METAR</button>
      </div>
    </form>
    <p role="status">{{ message }}</p>
    <div v-if="report">
      <p>Station: {{ report.station }} · Observed: {{ report.time }} UTC{{ report.stale ? ' · OUTDATED' : '' }}</p>
      <p>{{ report.raw }}</p>
      <div v-if="!report.stale" class="entry" aria-label="Apply observation to Flight Prep">
        <button v-if="values.wind" type="button" @click="apply('wind')">Replace wind with METAR ({{ values.wind.direction || 'calm' }} / {{ values.wind.speed }} {{ values.wind.unit }})</button>
        <button v-if="values.temperature" type="button" @click="apply('temperature')">Replace temperature with METAR ({{ values.temperature }} °C)</button>
        <button v-if="values.qnh" type="button" @click="apply('qnh')">Replace QNH with METAR ({{ values.qnh }} hPa)</button>
      </div>
      <p>Weather data via <a href="https://wxdecoder.com">wxdecoder.com</a>. Sources: NOAA/NWS Aviation Weather Center, National Weather Service and FAA.</p>
    </div>
    <p>Values are only replaced when you choose an action. METAR wind direction is true; use a runway heading in the same reference. Gusts are not applied. Verify all values with an authorised source.</p>
  </div>
</template>

<style scoped>
.weather-panel { display: grid; gap: .75rem; }
p { margin: 0; line-height: 1.5; overflow-wrap: anywhere; }
form { display: grid; gap: .4rem; }
.entry { display: flex; flex-wrap: wrap; gap: .5rem; }
input { max-width: 8rem; text-transform: uppercase; }
input, button { min-height: 44px; padding: .5rem; }
</style>
