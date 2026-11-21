<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const phase = ref('departure')
const location = ref('')
const time = ref('')
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
</script>

<template>
  <section class="forecast" aria-labelledby="forecast-heading">
    <h3 id="forecast-heading">Time-specific forecast</h3>
    <p>Select a flight phase, location and local time for your planning. These entries are not saved or sent anywhere.</p>
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
      {{ online ? 'No forecast source is configured.' : 'Forecast retrieval is unavailable.' }}
      No forecast temperature, QNH or wind has been retrieved. Continue using your manual inputs and obtain the required weather briefing from official sources.</p>
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
