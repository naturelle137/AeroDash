<script setup lang="ts">
import { ref } from 'vue'

const icao = ref('')
const message = ref('METAR retrieval is unavailable. Obtain weather from an authorised briefing source.')

function check(): void {
  message.value = /^[A-Za-z]{4}$/.test(icao.value.trim())
    ? 'METAR retrieval is unavailable. Obtain weather from an authorised briefing source.'
    : 'Enter a four-letter ICAO station code.'
}
</script>

<template>
  <div class="weather-panel">
    <p>METAR retrieval is unavailable. Obtain all required weather information from an authorised briefing source.</p>
    <form @submit.prevent="check">
      <label for="weather-icao">ICAO station code</label>
      <div class="entry">
        <input id="weather-icao" v-model="icao" type="text" maxlength="4" autocomplete="off" />
        <button type="submit">Check METAR</button>
      </div>
    </form>
    <p role="status">{{ message }}</p>
    <p>Weather is not applied to performance, wind or runway inputs.</p>
  </div>
</template>

<style scoped>
.weather-panel { display: grid; gap: .75rem; }
p { margin: 0; line-height: 1.5; }
form { display: grid; gap: .4rem; }
.entry { display: flex; flex-wrap: wrap; gap: .5rem; }
input { max-width: 8rem; text-transform: uppercase; }
input, button { min-height: 44px; padding: .5rem; }
</style>
