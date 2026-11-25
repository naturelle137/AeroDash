<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { tafLiquid, tafWind, type TafWind } from './taf-surface'

defineProps<{ embedded?: boolean }>()
const emit = defineEmits<{ forecast: [value: { station: string; time: string; source: 'TAF'; validFrom: string; validTo: string; liquid: boolean; heavy?: boolean } | null]; wind: [value: { station: string; issued: string; validFrom: string; validTo: string; wind: TafWind } | null] }>()
let request = 0
function clearReport(): void { request++; report.value = null }
function offline(): void { clearReport(); message.value = 'Offline: TAF retrieval is unavailable.' }
onMounted(() => window.addEventListener('offline', offline))

const icao = ref('')
const message = ref('Enter a station to retrieve a TAF.')
const report = ref<{ raw: string; station: string; issued: string; from: string; to: string; start: number; end: number; body: string } | null>(null)
const loading = ref(false)
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onUnmounted(() => { clearInterval(timer); window.removeEventListener('offline', offline); emit('forecast', null); emit('wind', null) })
const applicable = computed(() => {
  const r = report.value
  if (!r) return null
  const liquid = tafLiquid(r.body, r.start, r.end, now.value)
  return liquid === null ? null : { station: r.station, time: r.issued, source: 'TAF' as const, validFrom: r.from, validTo: r.to, liquid, heavy: tafLiquid(r.body, r.start, r.end, now.value, 'soft') === true }
})
watch(applicable, value => emit('forecast', value), { flush: 'sync' })
const wind = computed(() => {
  const r = report.value
  const value = r ? tafWind(r.body, r.start, r.end, now.value) : null
  return r && value ? { station: r.station, issued: r.issued, validFrom: r.from, validTo: r.to, wind: value } : null
})
watch(wind, value => emit('wind', value), { flush: 'sync' })

function timestamp(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) return NaN
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === value.slice(0, 19) ? time : NaN
}

function matchesPeriod(time: number, day: string, hour: string): boolean {
  const date = new Date(time)
  if (hour === '24') date.setUTCDate(date.getUTCDate() - 1)
  return date.getUTCDate() === Number(day) && date.getUTCHours() === (Number(hour) % 24) && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
}

async function check(): Promise<void> {
  clearReport()
  const currentRequest = request
  const station = icao.value.trim().toUpperCase()
  if (!/^[A-Z]{4}$/.test(station)) { message.value = 'Enter a four-letter ICAO station code.'; return }
  if (!navigator.onLine) { message.value = 'Offline: TAF retrieval is unavailable.'; return }
  loading.value = true
  message.value = 'Loading TAF…'
  try {
    const response = await fetch(`https://wxdecoder.com/api/wx/${station}`, { credentials: 'omit' })
    if (!response.ok) throw new Error('unavailable')
    const data: unknown = await response.json()
    if (currentRequest !== request || !navigator.onLine) return
    if (!data || typeof data !== 'object' || !('taf' in data)) throw new Error('malformed')
    const taf = data.taf
    if (taf === null) { message.value = 'No TAF available for this station.'; return }
    if (!taf || typeof taf !== 'object' || !('raw' in taf) || typeof taf.raw !== 'string' || !('station' in taf) || taf.station !== station || !('issueTime' in taf) || !('validFrom' in taf) || !('validTo' in taf)) throw new Error('malformed')
    const issued = timestamp(taf.issueTime), from = timestamp(taf.validFrom), to = timestamp(taf.validTo)
    const raw = taf.raw.match(/^TAF\s+(?:(?:AMD|COR)\s+)?([A-Z]{4})\s+(\d{2})(\d{2})(\d{2})Z\s+(\d{2})(\d{2})\/(\d{2})(\d{2})\b/)
    const issueDate = new Date(issued)
    if (!raw || raw[1] !== station || !Number.isFinite(issued) || !Number.isFinite(from) || !Number.isFinite(to) || issued > Date.now() || issued < from - 24 * 60 * 60 * 1000 || issued >= to || from >= to || Number(raw[2]) !== issueDate.getUTCDate() || Number(raw[3]) !== issueDate.getUTCHours() || Number(raw[4]) !== issueDate.getUTCMinutes() || issueDate.getUTCSeconds() !== 0 || Number(raw[6]) > 24 || Number(raw[8]) > 24 || !matchesPeriod(from, raw[5]!, raw[6]!) || !matchesPeriod(to, raw[7]!, raw[8]!)) throw new Error('malformed')
    now.value = Date.now()
    report.value = { raw: taf.raw, station, issued: new Date(issued).toISOString(), from: new Date(from).toISOString(), to: new Date(to).toISOString(), start: from, end: to, body: taf.raw.slice(raw[0].length).trim() }
    message.value = 'Forecast retrieved; verify with an authorised source.'
  } catch (error) {
    if (currentRequest !== request) return
    message.value = error instanceof SyntaxError || (error instanceof Error && error.message === 'malformed') ? 'Malformed TAF response; no forecast displayed.' : 'TAF retrieval failed or is unavailable.'
  } finally { loading.value = false }
}
</script>

<template>
  <component :is="embedded ? 'div' : 'main'" :class="{ 'weather-view': !embedded }">
    <h1 v-if="!embedded">Weather</h1>
    <section aria-labelledby="taf-heading">
      <h2 id="taf-heading">TAF forecast</h2>
      <p>For education and situational awareness only, not an official briefing or a go/no-go authority. Obtain required weather from an authorised briefing source.</p>
      <form @submit.prevent="check">
        <label for="taf-icao">ICAO station code</label>
        <div class="entry">
          <input id="taf-icao" v-model="icao" type="text" maxlength="4" autocomplete="off" :disabled="loading" @input="clearReport" />
          <button type="submit" :disabled="loading">Check TAF</button>
        </div>
      </form>
      <p role="status">{{ message }}</p>
      <div v-if="report">
        <p>Unverified · Station: {{ report.station }} · Issued: {{ report.issued }} · Valid: {{ report.from }} to {{ report.to }}</p>
        <p v-if="now < report.start">Forecast validity has not started.</p>
        <p v-if="now >= report.end" role="alert">EXPIRED forecast — obtain current weather.</p>
        <p>{{ report.raw }}</p>
        <p>Weather data via <a href="https://wxdecoder.com">wxdecoder.com</a>. Sources: NOAA/NWS Aviation Weather Center, National Weather Service and FAA.</p>
      </div>
      <p v-if="report && !applicable">No applicable surface suggestion: the forecast is outside its validity or contains unsupported or ambiguous groups.</p>
      <p>Applicable liquid precipitation may suggest Wet for the matching runway in Flight Prep. Verify the actual condition; manual and saved choices take precedence. Wind and other performance inputs are not replaced.</p>
    </section>
  </component>
</template>

<style scoped>
.weather-view { max-width: 70rem; margin: auto; padding: 2rem 1rem; }
section, form { display: grid; gap: .75rem; }
section { padding: 1.25rem; border: 1px solid var(--color-border, #999); border-radius: .5rem; }
p, h2 { margin: 0; line-height: 1.5; overflow-wrap: anywhere; }
.entry { display: flex; flex-wrap: wrap; gap: .5rem; }
input { max-width: 8rem; text-transform: uppercase; }
input, button { min-height: 44px; padding: .5rem; }
</style>
