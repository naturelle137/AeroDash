<template>
  <!-- @IMP-AC-VIEW-037@ (FROM: @REQ-AD-017@) -->
  <section class="wind-limits-summary" aria-label="Aircraft wind limits">
    <h3 class="wind-limits-summary__title">
      Wind limits
      <span class="wind-limits-summary__tag">manual check</span>
    </h3>

    <ul v-if="sortedLimits.length > 0" class="wind-limits-summary__list">
      <li
        v-for="(wl, idx) in sortedLimits"
        :key="idx"
        class="wind-limits-summary__item"
        :class="`wind-limits-summary__item--${wl.classification.toLowerCase()}`"
      >
        <span class="wind-limits-summary__component">{{ componentLabel(wl.component) }}</span>
        <span class="wind-limits-summary__value">{{ wl.value }} kt</span>
        <span class="wind-limits-summary__classification">{{ classificationLabel(wl.classification) }}</span>
      </li>
    </ul>

    <p v-else class="wind-limits-summary__empty">
      No wind limits stored for this aircraft. Add the demonstrated crosswind in the aircraft editor
      to check it against the reported wind here.
    </p>

    <p class="wind-limits-summary__note">
      Compare these against the reported wind by hand — automated wind classification is not yet
      available.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AircraftProfileWindLimit } from '@/core/adapters/aircraft.schema'

// @IMP-AC-VIEW-038@ (FROM: @REQ-AD-017@)

type Component = AircraftProfileWindLimit['component']
type Classification = AircraftProfileWindLimit['classification']

const props = defineProps<{
  windLimits?: AircraftProfileWindLimit[]
}>()

const COMPONENT_LABELS: Record<Component, string> = {
  MaxCrosswind: 'Crosswind',
  MaxTailwind: 'Tailwind',
  MaxTotalWind: 'Total wind',
  MaxGust: 'Gust',
}

// Crosswind is the value pilots check most often, so pin it first; the rest
// follow the POH-conventional order.
const COMPONENT_ORDER: readonly Component[] = [
  'MaxCrosswind',
  'MaxTailwind',
  'MaxTotalWind',
  'MaxGust',
]

const sortedLimits = computed<AircraftProfileWindLimit[]>(() =>
  [...(props.windLimits ?? [])].sort(
    (a, b) => COMPONENT_ORDER.indexOf(a.component) - COMPONENT_ORDER.indexOf(b.component),
  ),
)

function componentLabel(component: Component): string {
  return COMPONENT_LABELS[component]
}

function classificationLabel(classification: Classification): string {
  return classification === 'Limit' ? 'Limit (hard)' : 'Demonstrated (advisory)'
}
</script>

<style scoped>
.wind-limits-summary {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-surface-alt, #f9fafb);
}

.wind-limits-summary__title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text, #111827);
}

.wind-limits-summary__tag {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-text-secondary, #6b7280);
}

.wind-limits-summary__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.wind-limits-summary__item {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) auto minmax(140px, 1fr);
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.875rem;
  color: var(--color-text, #111827);
}

.wind-limits-summary__component {
  font-weight: 500;
}

.wind-limits-summary__value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.wind-limits-summary__classification {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #6b7280);
}

.wind-limits-summary__item--limit .wind-limits-summary__classification {
  color: var(--color-critical, #b91c1c);
  font-weight: 500;
}

.wind-limits-summary__empty {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #6b7280);
}

.wind-limits-summary__note {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
  font-style: italic;
}
</style>
