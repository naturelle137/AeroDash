<script setup lang="ts">
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
defineProps<{ profile: AircraftProfile }>()
</script>

<template>
  <details class="table-review">
    <summary>Review imported performance tables</summary>
    <p>Compare every point and table condition against the applicable POH/AFM before verifying.
      Values below are stored lookup units: kg, ft pressure altitude, °C and m distance.
      Verification records your review; it does not certify the data.</p>
    <p v-if="!profile.performanceProfiles?.length">No performance tables supplied. Export this profile,
      add sourced performanceProfiles to the JSON and import it as a new Draft.</p>
    <details v-for="(table, index) in profile.performanceProfiles" :key="index">
      <summary>{{ table.flightPhase }} — {{ table.dataPoints.length }} points</summary>
      <div class="table-scroll" tabindex="0" :aria-label="`${table.flightPhase} source points`">
        <table>
          <thead><tr><th>Mass (kg)</th><th>Pressure altitude (ft)</th><th>Temperature (°C)</th><th>Distance (m)</th></tr></thead>
          <tbody><tr v-for="(point, row) in table.dataPoints" :key="row">
            <td>{{ point.mass }}</td><td>{{ point.pressureAltitude }}</td>
            <td>{{ point.temperature }}</td><td>{{ point.distance }}</td>
          </tr></tbody>
        </table>
      </div>
    </details>
  </details>
</template>

<style scoped>
.table-review { margin-top: .75rem; max-width: 100%; }
summary { cursor: pointer; padding: .5rem 0; }
p { line-height: 1.5; }
.table-scroll { overflow-x: auto; max-width: 100%; }
table { border-collapse: collapse; width: 100%; font-size: .875rem; }
th, td { text-align: left; padding: .5rem; border-bottom: 1px solid var(--color-border); }
</style>
