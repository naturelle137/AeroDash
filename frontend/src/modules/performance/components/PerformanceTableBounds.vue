<script setup lang="ts">
import { formatMassConservative, formatMassLimitConservative, formatArm, getDecimalPrecision } from '@/core/logic/display-rounding'
import { PHASES, PHASE_INFO, type InspectionFailure, type TableInspection } from '../services/poh-inspection'

defineProps<{ tables: TableInspection | InspectionFailure | null }>()
</script>

<template>
  <p v-if="tables?.status === 'blocked'" role="alert">{{ tables.message }}</p>
  <div v-else-if="tables?.status === 'ready'" class="bounds">
    <h3>Supported table ranges</h3>
    <div class="table-scroll">
      <table>
        <thead><tr><th scope="col">Table</th><th scope="col">Mass (kg)</th><th scope="col">Pressure altitude (ft)</th><th scope="col">Temperature (°C)</th></tr></thead>
        <tbody>
          <tr v-for="phase in PHASES" :key="phase">
            <th scope="row">{{ PHASE_INFO[phase].label }}</th>
            <td>{{ formatMassConservative(tables.bounds[phase].mass.min) }} to {{ formatMassLimitConservative(tables.bounds[phase].mass.max) }} kg</td>
            <td>{{ formatArm(tables.bounds[phase].pressureAltitude.min, getDecimalPrecision('ft')) }} to {{ formatArm(tables.bounds[phase].pressureAltitude.max, getDecimalPrecision('ft')) }} ft</td>
            <td>{{ formatArm(tables.bounds[phase].temperature.min, getDecimalPrecision('°C')) }} to {{ formatArm(tables.bounds[phase].temperature.max, getDecimalPrecision('°C')) }} °C</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<style scoped>
.bounds { display: grid; gap: .5rem; min-width: 0; }
h3 { margin: 0; }
.table-scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--color-border); padding: .4rem .6rem; text-align: left; }
p { margin: 0; line-height: 1.6; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
</style>
