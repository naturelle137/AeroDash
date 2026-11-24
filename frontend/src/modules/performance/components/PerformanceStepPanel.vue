<script setup lang="ts">
import PressureAltitudeFieldset from './PressureAltitudeFieldset.vue'
import InputHelp from './InputHelp.vue'
import { describeGradient, OBSTACLE_SCOPE, OBSTACLE_UNITS } from '../services/obstacle-constraint'
import { SAFETY_FACTOR_PRESETS } from '../services/corrected-distances'
import type { PerformanceStep } from '../composables/performance-step'

const props = defineProps<{ step: PerformanceStep; canCompute: boolean }>()
const { temperature, temperatureWarnings, corrections, safetyFactors, showPaErrors, presentation, extrapolationAcknowledged, obstacle, obstacleAssessment } = props.step
</script>

<template>
  <form class="performance-step" novalidate aria-label="Performance lookup conditions" @submit.prevent>
    <slot name="masses" />
    <div class="fields">
      <label>Temperature (°C)<input id="performance-temperature" v-model="temperature" type="text" inputmode="text" /></label>
    </div>
    <p v-for="warning in temperatureWarnings" :key="warning" role="alert" data-warning="WARN-UI-001">{{ warning }}</p>
    <PressureAltitudeFieldset :pa="step.pa" :show-errors="showPaErrors" />
    <fieldset v-for="operation in (['takeoff', 'landing'] as const)" :key="operation" class="fields correction-inputs">
      <legend>{{ operation === 'takeoff' ? 'Takeoff' : 'Landing' }} wind and slope</legend>
      <div><label>Headwind component (kt, negative = tailwind)<input v-model="corrections[operation].headwind" :id="`performance-${operation}-headwind`" type="text" inputmode="text" /></label>
        <InputHelp :label="`${operation === 'takeoff' ? 'Takeoff' : 'Landing'} headwind`">Enter the wind component along the runway in knots: positive for headwind, negative for tailwind, and zero for calm.</InputHelp></div>
      <div><label>Runway slope (%, positive = uphill)<input v-model="corrections[operation].slope" :id="`performance-${operation}-slope`" type="text" inputmode="text" /></label>
        <InputHelp :label="`${operation === 'takeoff' ? 'Takeoff' : 'Landing'} runway slope`">Enter runway slope in percent in the direction of use: positive uphill, negative downhill, and zero for level.</InputHelp></div>
      <label>Manual POH wind multiplier (optional)<input v-model="corrections[operation].windFactor" :id="`performance-${operation}-wind-factor`" type="text" inputmode="decimal" /></label>
      <label>Manual additive wind correction to both distances (m, optional)<input v-model="corrections[operation].windAddend" :id="`performance-${operation}-wind-addend`" type="text" inputmode="text" /></label>
      <label>Wind factor source and section<input v-model="corrections[operation].windSource" :id="`performance-${operation}-wind-source`" type="text" /></label>
      <p>Enter either a multiplier or a signed additive correction in metres, only when the aircraft manual applies it to both distances after ground corrections and before the safety factor for these conditions. Source and applicability are not verified.</p>
      <label>Manual ground-roll surface multiplier (optional)<input v-model="corrections[operation].surfaceFactor" :id="`performance-${operation}-surface-factor`" type="text" inputmode="decimal" /></label>
      <label>Surface factor source and section<input v-model="corrections[operation].surfaceSource" :id="`performance-${operation}-surface-source`" type="text" /></label>
      <p>Use only when the aircraft manual supports applying this multiplier after the built-in slope and wind corrections and before a pilot-entered wind multiplier and safety factor. Additive or differently ordered surface rules are unsupported. Source and applicability are unverified.</p>
      <template>
        <label>Manual POH {{ operation }} slope ground-roll multiplier (optional)<input v-model="corrections[operation].slopeFactor" :id="`performance-${operation}-slope-factor`" type="text" inputmode="decimal" /></label>
        <label>Manual additive {{ operation }} slope correction to ground roll (m, optional)<input v-model="corrections[operation].slopeAddend" :id="`performance-${operation}-slope-addend`" type="text" inputmode="text" /></label>
        <label>Slope factor source and section<input v-model="corrections[operation].slopeSource" :id="`performance-${operation}-slope-source`" type="text" /></label>
        <p>Enter either a multiplier or a signed additive correction only when the aircraft manual applies it to {{ operation }} ground roll after built-in and pilot-entered surface corrections and before pilot-entered wind and safety factors for these conditions. Source and applicability are not verified.</p>
      </template>
      <label>Safety factor
        <select v-model="safetyFactors[operation].preset" :id="`performance-${operation}-safety-factor`">
          <option v-for="preset in SAFETY_FACTOR_PRESETS" :key="preset.value" :value="preset.value">{{ preset.label }}</option>
        </select></label>
      <label v-if="safetyFactors[operation].preset === 'custom'">Custom safety factor (1.00–3.00)<input v-model="safetyFactors[operation].custom" :id="`performance-${operation}-safety-factor-custom`" type="text" inputmode="decimal" /></label>
    </fieldset>
    <fieldset class="fields obstacle-inputs">
      <legend>Obstacle constraint (optional, unverified)</legend>
      <div><label>Obstacle height above runway<input v-model="obstacle.height" id="performance-obstacle-height" type="text" inputmode="decimal"
        :aria-invalid="obstacleAssessment.status === 'invalid' && !!obstacleAssessment.errors.height" aria-describedby="performance-obstacle-height-error" /></label>
        <label>Height unit<select v-model="obstacle.heightUnit" id="performance-obstacle-height-unit"><option v-for="unit in OBSTACLE_UNITS" :key="unit" :value="unit">{{ unit }}</option></select></label>
        <p id="performance-obstacle-height-error" v-if="obstacleAssessment.status === 'invalid' && obstacleAssessment.errors.height" role="alert">{{ obstacleAssessment.errors.height }}</p></div>
      <div><label>Obstacle distance from runway<input v-model="obstacle.distance" id="performance-obstacle-distance" type="text" inputmode="decimal"
        :aria-invalid="obstacleAssessment.status === 'invalid' && !!obstacleAssessment.errors.distance" aria-describedby="performance-obstacle-distance-error" /></label>
        <label>Distance unit<select v-model="obstacle.distanceUnit" id="performance-obstacle-distance-unit"><option v-for="unit in OBSTACLE_UNITS" :key="unit" :value="unit">{{ unit }}</option></select></label>
        <p id="performance-obstacle-distance-error" v-if="obstacleAssessment.status === 'invalid' && obstacleAssessment.errors.distance" role="alert">{{ obstacleAssessment.errors.distance }}</p></div>
      <button type="button" :disabled="!obstacle.height && !obstacle.distance" @click="obstacle.height = ''; obstacle.distance = ''">Clear obstacle</button>
      <p v-if="obstacleAssessment.status === 'active'" class="obstacle-active" data-obstacle-active>Active obstacle: {{ obstacleAssessment.height }} {{ obstacleAssessment.heightUnit }} at {{ obstacleAssessment.distance }} {{ obstacleAssessment.distanceUnit }}. Unverified, not checked for clearance. Required geometric gradient: {{ describeGradient(obstacleAssessment) }}. {{ OBSTACLE_SCOPE }}</p>
    </fieldset>

    <section class="results" :aria-label="presentation.status === 'assessed' ? 'Base performance distances' : 'Performance results'" :data-status="presentation.status" aria-live="polite">
      <section v-if="presentation.notifications.length" aria-label="Performance notifications">
        <p v-for="note in presentation.notifications" :key="note.id" role="alert" :data-notification="note.id"><strong>{{ note.severity }} · {{ note.id }}</strong>: {{ note.message }}</p>
      </section>
      <p v-if="presentation.status !== 'assessed'" :role="presentation.status === 'blocked' ? 'alert' : 'status'">
        {{ presentation.reason }}</p>
      <section v-if="presentation.extrapolation" class="extrapolation" aria-label="Extrapolated data" data-extrapolation>
        <p role="alert"><strong>EXTRAPOLATED DATA</strong>: {{ presentation.extrapolation.warning }}</p>
        <ul class="scope"><li v-for="line in presentation.extrapolation.details" :key="line">{{ line }}</li></ul>
        <label class="acknowledge"><input id="performance-extrapolation-ack" v-model="extrapolationAcknowledged" type="checkbox" />
          Pilot-in-Command acknowledges extrapolated data</label>
      </section>
      <p v-if="presentation.conditions">Pressure altitude used: {{ presentation.conditions.pressureAltitude }} ·
        Temperature: {{ presentation.conditions.temperature }}</p>
      <section v-for="item in presentation.corrected" :key="item.operation" class="group corrected" :data-corrected="item.operation"
        :aria-label="`${item.title} corrected distances`">
        <h3>{{ item.title }} {{ item.status === 'applied' && item.partial ? 'partially corrected' : 'corrected' }} distances</h3>
        <p v-if="item.status === 'unavailable'" role="status">Not corrected: {{ item.reason }}</p>
        <template v-else>
          <p>Source: {{ item.source }}</p>
          <dl class="distances">
            <div v-for="row in item.rows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.factored }}<small class="note">Raw {{ row.raw }} · corrected {{ row.corrected }} · final incl. safety factor</small></dd>
            </div>
          </dl>
          <p>Safety factor: {{ item.safetyFactor }}</p>
          <p v-if="item.safetyFactorWarning" data-warning="WARN-PF-002" role="alert">{{ item.safetyFactorWarning }}</p>
          <p class="comparison" :data-comparison="item.comparison.status" :role="item.comparison.status === 'insufficient' ? 'alert' : 'status'">
            <strong>{{ item.comparison.status === 'insufficient' ? 'CRIT-PF-002: Insufficient runway' : item.comparison.status === 'sufficient' ? 'Fits declared runway' : 'Runway comparison unavailable' }}</strong>:
            {{ item.comparison.summary }} Required {{ item.comparison.required }} · {{ item.comparison.availableLabel }}
            {{ item.comparison.available }} · margin {{ item.comparison.margin }}.</p>
          <ul class="scope"><li v-for="note in item.notes" :key="note">{{ note }}</li></ul>
        </template>
      </section>
      <p v-if="presentation.groups.some(group => group.status === 'success')">Base distances are uncorrected table values without operational factors or runway assessment.</p>
      <div v-for="group in presentation.groups" :key="group.id" class="group" :data-group="group.id"
        :aria-label="`${group.title} raw distances`" role="group">
        <h3>{{ group.title }} base distances (uncorrected)</h3>
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
fieldset { border: 1px solid var(--color-border); border-radius: 8px; margin: 0; min-width: 0; }
label { display: grid; gap: .5rem; }
input, select, button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; min-width: 0; }
button { cursor: pointer; font-weight: 600; justify-self: start; }
button:disabled { opacity: .5; cursor: default; }
p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
.results { display: grid; gap: .75rem; }
.group { border: 1px solid var(--color-border); border-radius: 8px; padding: .75rem 1rem; display: grid; gap: .5rem; }
h3 { margin: 0; }
.distances { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: .75rem; margin: 0; }
dt { font-weight: 600; }
dd { margin: .25rem 0; font-size: 1.4rem; font-weight: 700; }
.extrapolation { border: 2px solid #ef6c00; border-radius: 8px; padding: .75rem 1rem; display: grid; gap: .5rem; }
.acknowledge { display: flex; align-items: center; gap: .75rem; }
.acknowledge input { min-width: 24px; min-height: 24px; }
.obstacle-active { border-left: 4px solid #ef6c00; padding-left: .5rem; font-weight: 600; }
.comparison { border-left: 4px solid var(--color-border); padding-left: .5rem; }
.comparison[data-comparison="insufficient"] { border-left-color: #c62828; font-weight: 600; }
.warned { border-left: 4px solid #ef6c00; padding-left: .5rem; color: #a34500; }
.note { display: block; font-size: .9rem; font-weight: 400; }
.scope { margin: 0; padding-left: 1.25rem; font-size: .95rem; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
</style>
