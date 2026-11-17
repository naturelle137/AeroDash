<script setup lang="ts">
import PressureAltitudeFieldset from './PressureAltitudeFieldset.vue'
import type { PerformanceStep } from '../composables/performance-step'

const props = defineProps<{ step: PerformanceStep; canCompute: boolean }>()
const { temperature, showPaErrors, presentation } = props.step
</script>

<template>
  <form class="performance-step" novalidate aria-label="Performance lookup conditions" @submit.prevent>
    <slot name="masses" />
    <div class="fields">
      <label>Temperature (°C)<input id="performance-temperature" v-model="temperature" type="text" inputmode="decimal" /></label>
    </div>
    <PressureAltitudeFieldset :pa="step.pa" :show-errors="showPaErrors" />

    <section class="results" :aria-label="presentation.status === 'assessed' ? 'Raw POH table distances' : 'Performance results'" :data-status="presentation.status" aria-live="polite">
      <p v-if="presentation.status !== 'assessed'" :role="presentation.status === 'blocked' ? 'alert' : 'status'">
        {{ presentation.reason }}</p>
      <p v-if="presentation.conditions">Pressure altitude used: {{ presentation.conditions.pressureAltitude }} ·
        Temperature: {{ presentation.conditions.temperature }}</p>
      <div v-for="group in presentation.groups" :key="group.id" class="group" :data-group="group.id"
        :aria-label="`${group.title} raw distances`" role="group">
        <h3>{{ group.title }}</h3>
        <p v-if="group.mass">Mass: {{ group.mass }}</p>
        <p v-if="group.status === 'blocked'" :role="presentation.status === 'blocked' ? undefined : 'alert'">{{ group.title }} unavailable: {{ group.reason }}</p>
        <p v-else-if="group.status === 'not-computed'">Not computed.</p>
        <dl v-else class="distances">
          <div v-for="row in group.rows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd :class="{ warned: row.warnings?.length }">{{ row.value }}<small v-for="warning in row.warnings" :key="warning" class="note">{{ warning }}</small><small v-if="row.note" class="note">{{ row.note }}</small></dd>
          </div>
        </dl>
      </div>
      <ul class="scope">
        <li v-for="line in presentation.scope" :key="line">{{ line }}</li>
      </ul>
    </section>
  </form>
</template>

<style scoped>
.performance-step { display: grid; gap: .75rem; min-width: 0; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
label { display: grid; gap: .5rem; }
input, button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; min-width: 0; }
button { cursor: pointer; font-weight: 600; justify-self: start; }
button:disabled { opacity: .5; cursor: default; }
p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
.results { display: grid; gap: .75rem; }
.group { border: 1px solid var(--color-border); border-radius: 8px; padding: .75rem 1rem; display: grid; gap: .5rem; }
h3 { margin: 0; }
.distances { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: .75rem; margin: 0; }
dt { font-weight: 600; }
dd { margin: .25rem 0; font-size: 1.4rem; font-weight: 700; }
.warned { border-left: 4px solid #ef6c00; padding-left: .5rem; color: #a34500; }
.note { display: block; font-size: .9rem; font-weight: 400; }
.scope { margin: 0; padding-left: 1.25rem; font-size: .95rem; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
</style>
