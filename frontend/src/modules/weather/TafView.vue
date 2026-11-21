<script setup lang="ts">
import { ref } from 'vue'

const icao = ref('')
const message = ref('TAF retrieval is unavailable. Obtain an official weather briefing before flight.')

function check(): void {
  message.value = /^[A-Za-z]{4}$/.test(icao.value.trim())
    ? 'TAF retrieval is unavailable, including offline. Obtain an official weather briefing before flight.'
    : 'Enter a four-letter ICAO station code.'
}
</script>

<template>
  <main class="weather-view">
    <h1>Weather</h1>
    <section aria-labelledby="taf-heading">
      <h2 id="taf-heading">TAF forecast</h2>
      <p>No forecast is available in AeroDash. Obtain all required weather information from an authorised briefing source before flight.</p>
      <form @submit.prevent="check">
        <label for="taf-icao">ICAO station code</label>
        <div class="entry">
          <input id="taf-icao" v-model="icao" type="text" maxlength="4" autocomplete="off" />
          <button type="submit">Check TAF</button>
        </div>
      </form>
      <p role="status">{{ message }}</p>
      <p>Weather is not applied to performance, wind or runway inputs.</p>
    </section>
  </main>
</template>

<style scoped>
.weather-view { max-width: 70rem; margin: auto; padding: 2rem 1rem; }
section, form { display: grid; gap: .75rem; }
section { padding: 1.25rem; border: 1px solid var(--color-border, #999); border-radius: .5rem; }
p, h2 { margin: 0; line-height: 1.5; }
.entry { display: flex; flex-wrap: wrap; gap: .5rem; }
input { max-width: 8rem; text-transform: uppercase; }
input, button { min-height: 44px; padding: .5rem; }
</style>
