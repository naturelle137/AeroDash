<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import { inspectPohDistances, inspectTables, type InspectionResult } from '../services/poh-inspection'

const fleet = useFleetStore()
const selectedId = ref('')
const inputs = reactive({ mass: '', pressureAltitude: '', temperature: '' })
const result = ref<InspectionResult | null>(null)
const profile = computed(() => fleet.profiles.find((item) => item.id === selectedId.value))
const tables = computed(() => profile.value ? inspectTables(profile.value) : null)
const distances = [
  { key: 'takeoffRoll', label: 'TOR — Takeoff roll' },
  { key: 'takeoffDistance50ft', label: 'TOD — Takeoff distance to 50 ft' },
  { key: 'landingRoll', label: 'LR — Landing roll' },
  { key: 'landingDistance50ft', label: 'LD — Landing distance from 50 ft' },
] as const

// Results belong to one exact set of inputs and one persisted snapshot.
watch([profile, inputs, () => fleet.fleetLoadState], () => { result.value = null }, { deep: true, flush: 'sync' })
onMounted(() => fleet.loadAll())
function compute(): void {
  result.value = fleet.fleetLoadState === 'READY'
    ? inspectPohDistances(profile.value, inputs, new Date())
    : { status: 'blocked', reason: 'profile', message: 'Load the fleet successfully before computing.' }
}
</script>

<template>
  <main class="performance-view">
    <header>
      <h1>Performance</h1>
      <p class="eyebrow">RAW POH TABLE DISTANCES</p>
      <p>Inspect base distances from your aircraft tables. No wind, surface, slope or operational
        factors are applied. No runway assessment or flight approval is provided.</p>
    </header>
    <section class="panel" aria-labelledby="aircraft-heading">
      <h2 id="aircraft-heading">Aircraft and source</h2>
      <p><RouterLink to="/fleet">Open Fleet to import, review or verify a profile</RouterLink>.</p>
      <p>Import an aircraft exchange JSON with all four <code>performanceProfiles</code> tables.
        Fleet provides import help and a read-only table review. Imported profiles remain Draft.</p>
      <p v-if="fleet.fleetLoadState === 'LOADING'" role="status">Loading fleet…</p>
      <div v-else-if="fleet.fleetLoadState === 'ERROR'" role="alert">
        Could not load fleet. {{ fleet.fleetLoadError }}
        <button type="button" @click="fleet.loadAll()">Retry</button>
      </div>
      <template v-else>
        <p v-if="!fleet.profiles.length">No aircraft profiles. Import your own sourced data in Fleet.</p>
        <label for="performance-aircraft">Aircraft profile</label>
        <select id="performance-aircraft" v-model="selectedId">
          <option value="">Select a profile</option>
          <option v-for="item in fleet.profiles" :key="item.id" :value="item.id">
            {{ item.registration }} — {{ item.model }} ({{ item.status }})
          </option>
        </select>
      </template>
      <div v-if="profile" class="source-info">
        <p>{{ profile.manufacturer }} {{ profile.model }} · {{ profile.registration }} · {{ profile.status }}</p>
        <p>Snapshot ID: <code>{{ profile.id }}</code> · Schema version {{ profile.schemaVersion }}</p>
        <p v-if="profile.verification">User review: {{ profile.verification.verifiedBy }} on
          {{ profile.verification.verifiedOn }} · POH/AFM {{ profile.verification.pohRevision }}</p>
        <p v-else>No POH/AFM revision sign-off recorded.</p>
        <p>Verified records user review, not aviation certification. Check applicability, table
          conditions and results against the aircraft's official POH/AFM and independent reference cases.
          No aircraft-specific operational validation is supplied by AeroDash.</p>
      </div>
      <p v-if="tables?.status === 'blocked'" role="alert">{{ tables.message }}</p>
      <div v-if="tables?.status === 'ready'" class="bounds">
        <h3>Common supported table envelope</h3>
        <p>Mass: {{ tables.bounds.mass.min }} to {{ tables.bounds.mass.max }} kg · Pressure altitude:
          {{ tables.bounds.pressureAltitude.min }} to {{ tables.bounds.pressureAltitude.max }} ft · Temperature:
          {{ tables.bounds.temperature.min }} to {{ tables.bounds.temperature.max }} °C</p>
        <p>All four tables must support the point. Outside values are blocked.</p>
      </div>
      <p v-if="profile?.status === 'draft'" role="status">Draft: explicitly review and verify in Fleet before computation.</p>
    </section>
    <form class="panel" novalidate @submit.prevent="compute">
      <h2>Table lookup conditions</h2>
      <div class="fields">
        <label>Mass (kg)<input v-model="inputs.mass" type="text" inputmode="decimal" /></label>
        <label>Pressure altitude (ft)<input v-model="inputs.pressureAltitude" type="text" inputmode="decimal" /></label>
        <label>Temperature (°C)<input v-model="inputs.temperature" type="text" inputmode="decimal" /></label>
      </div>
      <p>Use pressure altitude directly, not QNH or field elevation. Mass is in kg; altitude in ft;
        outside air temperature in °C. No unit conversion or atmospheric correction is applied.</p>
      <button type="submit" :disabled="!profile || fleet.fleetLoadState !== 'READY'">Compute raw distances</button>
      <p v-if="result?.status === 'blocked'" role="alert">{{ result.message }}</p>
      <section v-if="result?.status === 'success'" aria-label="Raw POH table distances" aria-live="polite">
        <h2>RAW POH TABLE DISTANCES</h2>
        <dl class="results">
          <div v-for="distance in distances" :key="distance.key">
            <dt>{{ distance.label }}</dt><dd>{{ result.distances[distance.key].toFixed(1) }} m</dd>
          </div>
        </dl>
        <p>Interpolated base table values only. No corrections, margins or runway comparison.</p>
      </section>
      <p v-else role="status">No distances displayed. Select a reviewed profile and compute with valid conditions.</p>
    </form>
  </main>
</template>

<style scoped>
.performance-view { max-width: 960px; margin: auto; padding: 1.25rem; display: grid; gap: 1.25rem; color: var(--color-text-primary); }
h1, h2, h3 { margin: 0 0 .75rem; }
p { line-height: 1.6; }
.eyebrow { font-weight: 700; letter-spacing: .06em; }
.panel { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-card); min-width: 0; }
.source-info { overflow-wrap: anywhere; }
.fields, .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
label { display: grid; gap: .5rem; }
input, select, button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; }
select { width: 100%; margin-top: .5rem; }
button { cursor: pointer; font-weight: 600; }
button:disabled { opacity: .5; cursor: default; }
dd { margin: .5rem 0; font-size: 1.5rem; font-weight: 700; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
a { color: var(--color-primary); text-decoration: underline; }
</style>
