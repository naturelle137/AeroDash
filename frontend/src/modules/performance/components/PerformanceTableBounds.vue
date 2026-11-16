<script setup lang="ts">
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
            <td>{{ tables.bounds[phase].mass.min }} to {{ tables.bounds[phase].mass.max }} kg</td>
            <td>{{ tables.bounds[phase].pressureAltitude.min }} to {{ tables.bounds[phase].pressureAltitude.max }} ft</td>
            <td>{{ tables.bounds[phase].temperature.min }} to {{ tables.bounds[phase].temperature.max }} °C</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>Inside a table: interpolated. Mass below its minimum: capped at the minimum-mass distance (never shorter),
      only if the table never decreases with mass. Mass above its maximum, and pressure altitude or temperature
      outside it: blocked, with no clamping or extrapolation.</p>
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
