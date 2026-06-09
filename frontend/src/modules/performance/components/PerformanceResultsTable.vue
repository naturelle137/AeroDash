<script setup lang="ts">
// @IMP-PF-VIEW-003@ (FROM: @REQ-PF-001@, @REQ-PF-007@, @REQ-PF-017@)
import { computed } from 'vue'
import { formatMassConservative, formatFuelConservative } from '@/core/logic/display-rounding'
import EstimatedMarker from './EstimatedMarker.vue'
import type { PerformanceResultView } from '@/modules/performance/stores/performance.types'

const props = defineProps<{ result: PerformanceResultView }>()

interface DistanceRow {
  key: string
  label: string
  abbr: string
  base: number
  required: number
  estimated: boolean
  /** Full-distance rows (TOD / LD) carry the runway available + margin. */
  available: number | null
  marginAbsolute: number | null
  marginPercent: number | null
  insufficient: boolean
}

const rows = computed<DistanceRow[]>(() => {
  const r = props.result
  return [
    {
      key: 'tor',
      label: 'Take-off run',
      abbr: 'TOR',
      base: r.base.takeoffRoll,
      required: r.takeoff.groundRollRequired,
      estimated: r.estimated.takeoffRoll,
      available: null,
      marginAbsolute: null,
      marginPercent: null,
      insufficient: false,
    },
    {
      key: 'tod',
      label: 'Take-off distance (50 ft)',
      abbr: 'TOD',
      base: r.base.takeoffDistance50ft,
      required: r.takeoff.fullRequired,
      estimated: r.estimated.takeoffDistance50ft,
      available: r.takeoff.available,
      marginAbsolute: r.takeoff.marginAbsolute,
      marginPercent: r.takeoff.marginPercent,
      insufficient: r.takeoff.insufficient,
    },
    {
      key: 'lr',
      label: 'Landing run',
      abbr: 'LR',
      base: r.base.landingRoll,
      required: r.landing.groundRollRequired,
      estimated: r.estimated.landingRoll,
      available: null,
      marginAbsolute: null,
      marginPercent: null,
      insufficient: false,
    },
    {
      key: 'ld',
      label: 'Landing distance (50 ft)',
      abbr: 'LD',
      base: r.base.landingDistance50ft,
      required: r.landing.fullRequired,
      estimated: r.estimated.landingDistance50ft,
      available: r.landing.available,
      marginAbsolute: r.landing.marginAbsolute,
      marginPercent: r.landing.marginPercent,
      insufficient: r.landing.insufficient,
    },
  ]
})

/** Distances round UP (pessimistic); margins round DOWN (pessimistic) — REQ-UQ-004. */
function metres(v: number): string {
  return `${formatMassConservative(v, 0)} m`
}
function marginMetres(v: number): string {
  return `${formatFuelConservative(v, 0)} m`
}
function marginPct(v: number | null): string {
  return v === null ? '—' : `${formatFuelConservative(v, 1)}%`
}
</script>

<template>
  <table class="perf-results">
    <caption class="perf-results__caption">
      Required distances and safety margin
    </caption>
    <thead>
      <tr>
        <th scope="col">Phase</th>
        <th scope="col">POH base</th>
        <th scope="col">Operational required</th>
        <th scope="col">Available</th>
        <th scope="col">Margin</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.key"
        :class="{ 'perf-results__row--insufficient': row.insufficient }"
        :data-phase="row.key"
      >
        <th scope="row">
          <span class="perf-results__abbr">{{ row.abbr }}</span>
          <span class="perf-results__label">{{ row.label }}</span>
          <EstimatedMarker v-if="row.estimated" class="perf-results__estimated" />
        </th>
        <td>{{ metres(row.base) }}</td>
        <td class="perf-results__required">{{ metres(row.required) }}</td>
        <td>{{ row.available === null ? '—' : metres(row.available) }}</td>
        <td class="perf-results__margin">
          <template v-if="row.marginAbsolute === null">—</template>
          <template v-else>
            <span :class="{ 'perf-results__margin--negative': row.insufficient }">
              {{ marginMetres(row.marginAbsolute) }}
            </span>
            <span class="perf-results__margin-pct">({{ marginPct(row.marginPercent) }})</span>
            <span v-if="row.insufficient" class="perf-results__flag" role="img" aria-label="insufficient">
              ✕ insufficient
            </span>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.perf-results {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.perf-results__caption {
  text-align: left;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.perf-results th,
.perf-results td {
  text-align: right;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid #e5e7eb;
}

.perf-results thead th {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: #6b7280;
}

.perf-results tbody th {
  text-align: left;
  font-weight: 500;
}

.perf-results__abbr {
  font-weight: 700;
  margin-right: 0.4rem;
}

.perf-results__label {
  color: #6b7280;
  font-size: 0.85rem;
}

.perf-results__estimated {
  margin-left: 0.4rem;
}

.perf-results__required {
  font-weight: 600;
}

.perf-results__row--insufficient {
  background: #fef2f2;
}

.perf-results__margin--negative {
  color: #b91c1c;
  font-weight: 700;
}

.perf-results__margin-pct {
  color: #6b7280;
  font-size: 0.85rem;
  margin-left: 0.25rem;
}

.perf-results__flag {
  display: block;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.8rem;
}
</style>
