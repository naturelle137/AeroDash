<script setup lang="ts">
import { LEGACY_PERFORMANCE_UNITS, normalizePerformanceTable } from '@/core/adapters/performance-source-units'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
defineProps<{ profile: AircraftProfile }>()
function normalizedPoints(table: NonNullable<AircraftProfile['performanceProfiles']>[number]) {
  const result = normalizePerformanceTable(table)
  return result.status === 'success' ? result.table.dataPoints : []
}
</script>

<template>
  <details class="table-review">
    <summary>Review imported performance tables</summary>
    <p>Compare every point and table condition against the applicable POH/AFM before verifying.
      Original source values are preserved. Compare them with normalized lookup values in kg, ft pressure altitude, °C and m distance.
      Verification records your review; it does not certify the data. Scroll tables horizontally on small screens.</p>
    <p v-if="!profile.performanceProfiles?.length">No performance tables supplied. Export this profile,
      add sourced performanceProfiles to the JSON and import it as a new Draft.</p>
    <details v-for="(table, index) in profile.performanceProfiles" :key="index">
      <summary>{{ table.flightPhase }} — {{ table.dataPoints.length }} points</summary>
      <p v-if="!table.sourceUnits">Legacy undeclared table: explicit kg / ft / °C / m contract, independent of M&amp;B sourceUnit.</p>
      <p v-else>Declared source units: {{ table.sourceUnits.mass }} / {{ table.sourceUnits.pressureAltitude }} / {{ table.sourceUnits.temperature }} / {{ table.sourceUnits.distance }}.</p>
      <p>Source reference: {{ table.sourceReference ?? 'Not supplied — check the applicable POH/AFM and record its revision at verification.' }}</p>
      <p v-if="normalizePerformanceTable(table).status === 'failure'" role="alert">Invalid source units or values; lookup unavailable.</p>
      <div class="table-scroll" tabindex="0" :aria-label="`${table.flightPhase} source points`">
        <table>
          <caption>Original source values</caption>
          <thead><tr>
            <th>Mass ({{ (table.sourceUnits ?? LEGACY_PERFORMANCE_UNITS).mass }})</th>
            <th>Pressure altitude ({{ (table.sourceUnits ?? LEGACY_PERFORMANCE_UNITS).pressureAltitude }})</th>
            <th>Temperature ({{ (table.sourceUnits ?? LEGACY_PERFORMANCE_UNITS).temperature }})</th>
            <th>Distance ({{ (table.sourceUnits ?? LEGACY_PERFORMANCE_UNITS).distance }})</th>
          </tr></thead>
          <tbody><tr v-for="(point, row) in table.dataPoints" :key="row">
            <td>{{ point.mass }}</td><td>{{ point.pressureAltitude }}</td>
            <td>{{ point.temperature }}</td><td>{{ point.distance }}</td>
          </tr></tbody>
        </table>
      </div>
      <div class="table-scroll" tabindex="0" :aria-label="`${table.flightPhase} normalized points`">
        <table>
          <caption>Normalized lookup values</caption>
          <thead><tr><th>Mass (kg)</th><th>Pressure altitude (ft)</th><th>Temperature (°C)</th><th>Distance (m)</th></tr></thead>
          <tbody><tr v-for="(point, row) in normalizedPoints(table)" :key="row">
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
summary { cursor: pointer; padding: .5rem 0; min-height: 44px; }
p { line-height: 1.5; overflow-wrap: anywhere; }
.table-scroll { overflow-x: auto; max-width: 100%; }
table { border-collapse: collapse; width: 100%; font-size: .875rem; }
th, td { text-align: left; padding: .5rem; border-bottom: 1px solid var(--color-border); }
</style>
