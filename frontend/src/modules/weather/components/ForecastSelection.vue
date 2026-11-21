<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { QNH_SUPPORTED_HPA } from '@/core/logic/pressure-altitude'
import type { MetarValues } from '../metar-values'

const emit = defineEmits<{ apply: [field: keyof MetarValues, values: MetarValues, source: string] }>()
const phase = ref('departure')
const location = ref('')
const time = ref('')
const temperature = ref('')
const qnh = ref('')
const direction = ref('')
const speed = ref('')
const unit = ref<'kt' | 'm/s'>('kt')
const online = ref(navigator.onLine)
const refresh = () => { online.value = navigator.onLine }
onMounted(() => {
  window.addEventListener('online', refresh)
  window.addEventListener('offline', refresh)
  window.addEventListener('pageshow', refresh)
  refresh()
})
onBeforeUnmount(() => {
  window.removeEventListener('online', refresh)
  window.removeEventListener('offline', refresh)
  window.removeEventListener('pageshow', refresh)
})
watch([phase, location, time], () => {
  temperature.value = ''; qnh.value = ''; direction.value = ''; speed.value = ''
}, { flush: 'sync' })
const numberIn = (value: string, min: number, max: number) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max
const selectionValid = computed(() => location.value.trim() !== '' && time.value !== '' && Number.isFinite(Date.parse(time.value)) && Date.parse(time.value) > Date.now())
const values = computed<MetarValues>(() => {
  const result: MetarValues = {}
  if (numberIn(temperature.value, -100, 100)) result.temperature = temperature.value
  if (numberIn(qnh.value, QNH_SUPPORTED_HPA.min, QNH_SUPPORTED_HPA.max)) result.qnh = qnh.value
  if (numberIn(speed.value, 0, 200) && (Number(speed.value) === 0 || numberIn(direction.value, 1, 360))) {
    result.wind = { direction: Number(speed.value) === 0 ? '' : direction.value, speed: speed.value, unit: unit.value }
  }
  return result
})
function apply(field: keyof MetarValues): void {
  if (!selectionValid.value || Date.parse(time.value) <= Date.now() || !values.value[field]) return
  emit('apply', field, values.value, `Pilot-entered forecast for ${phase.value}, ${location.value.trim()}, ${time.value.replace('T', ' ')} local time`)
}
</script>

<template>
  <section class="forecast" aria-labelledby="forecast-heading">
    <h3 id="forecast-heading">Time-specific forecast</h3>
    <p>Enter forecast values for the selected location and local time. They are pilot-entered, not retrieved, saved or sent. Changing the selection clears these entries.</p>
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
    <p role="status" aria-live="polite"><strong>{{ online ? 'Forecast unavailable:' : 'Browser offline:' }}</strong>
      {{ online ? 'No forecast source is configured.' : 'Forecast retrieval is unavailable.' }} Obtain the required weather briefing from official sources.</p>
    <p>Enter QNH only, not sea-level pressure. Wind direction is true; gusts are not applied. Values require a future time and are applied only when selected.</p>
    <div class="fields">
      <label>Forecast temperature (°C)<input v-model="temperature" type="text" inputmode="decimal" min="-100" max="100" step="any" /></label>
      <label>Forecast QNH (hPa)<input v-model="qnh" type="text" inputmode="decimal" min="850" max="1100" step="any" /></label>
      <label>Forecast wind direction (° true)<input v-model="direction" type="text" inputmode="decimal" min="1" max="360" step="any" /></label>
      <label>Forecast wind speed<input v-model="speed" type="text" inputmode="decimal" min="0" max="200" step="any" /></label>
      <label>Forecast wind unit<select v-model="unit"><option value="kt">kt</option><option value="m/s">m/s</option></select></label>
    </div>
    <p v-if="!selectionValid">Choose a location and future local time to apply values.</p>
    <div class="fields">
      <button type="button" :disabled="!selectionValid || !values.temperature" @click="apply('temperature')">Apply forecast temperature</button>
      <button type="button" :disabled="!selectionValid || !values.qnh" @click="apply('qnh')">Apply forecast QNH</button>
      <button type="button" :disabled="!selectionValid || !values.wind" @click="apply('wind')">Apply forecast wind</button>
    </div>
  </section>
</template>

<style scoped>
.forecast { display: grid; gap: .75rem; min-width: 0; }
h3, p { margin: 0; }
p { line-height: 1.6; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
label { display: grid; gap: .5rem; min-width: 0; }
input, select { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; min-width: 0; box-sizing: border-box; width: 100%; scroll-margin-bottom: calc(8rem + env(safe-area-inset-bottom, 0px)); }
</style>
