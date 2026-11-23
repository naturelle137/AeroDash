<script setup lang="ts">
import type { ElectricPlanning } from '../services/use-electric-planning'
const props = defineProps<{ planning: ElectricPlanning }>()
const { available, power, minutes, presentation } = props.planning
</script>

<template>
  <div>
    <p>Manual estimate assumes constant pilot-entered consumption. Verify against the aircraft POH/AFM; this does not determine flight suitability. Battery use does not change aircraft mass. Inputs clear when changing aircraft or reloading.</p>
    <fieldset>
      <legend>Manual energy budget</legend>
      <p><label for="energy-available">Current available energy (kWh)</label> <input id="energy-available" v-model="available" type="text" inputmode="decimal" /></p>
      <p><label for="energy-power">Average consumption (kW)</label> <input id="energy-power" v-model="power" type="text" inputmode="decimal" /></p>
      <p><label for="energy-trip">Planned trip duration (min)</label> <input id="energy-trip" v-model="minutes" type="text" inputmode="decimal" /></p>
    </fieldset>
    <p v-if="presentation.enduranceReason" role="status">Endurance estimate unavailable: {{ presentation.enduranceReason }}</p>
    <p v-if="presentation.reason" role="status">Energy budget unavailable: {{ presentation.reason }}</p>
    <div v-if="presentation.rows.length" aria-label="Estimated energy budget" aria-live="polite">
      <dl><template v-for="row in presentation.rows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></template></dl>
      <p v-if="presentation.warning" role="alert">{{ presentation.warning }}</p>
    </div>
  </div>
</template>
