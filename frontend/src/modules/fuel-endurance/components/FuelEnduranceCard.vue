<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { usableFuelForPlanning } from '../services/usable-fuel'
import { calculateFuelEndurance } from '@/core/logic/fuel-endurance'

const store = useMassBalanceStore()
const consumption = ref('')
const trip = ref('')
const reserve = ref('')
watch(
  () => store.aircraft?.id,
  () => {
    consumption.value = ''
    trip.value = ''
    reserve.value = ''
  },
  { flush: 'sync' },
)
const fuel = computed(() =>
  usableFuelForPlanning(store.aircraft, store.activeCategory, store.stations),
)
function decimal(raw: string): number {
  return /^\d+(?:[.,]\d+)?$/.test(raw.trim()) ? Number(raw.trim().replace(',', '.')) : NaN
}
const result = computed(() =>
  fuel.value.ok
    ? calculateFuelEndurance({
        usableFuelKg: fuel.value.usableFuelKg,
        consumptionKgPerHour: decimal(consumption.value),
        tripMinutes: decimal(trip.value),
        reserveMinutes: decimal(reserve.value),
      })
    : null,
)
const plan = computed(() => (result.value?.ok ? result.value.plan : null))
const format = (value: number) =>
  value > 0 && value < 0.001
    ? '<0.001'
    : value.toLocaleString('en-GB', { maximumFractionDigits: 3 })
</script>

<template>
  <div class="fuel-planner">
    <p>
      Use the tank loads entered in Mass &amp; Balance. Unusable fuel is excluded; unavailable tanks
      are not counted.
    </p>
    <p v-if="fuel.ok" data-testid="usable-fuel">
      Usable fuel: {{ format(fuel.usableFuelKg) }} kg. Excluded unusable fuel:
      {{ format(fuel.excludedUnusableKg) }} kg.
    </p>
    <p v-else role="status">{{ fuel.reason }}</p>
    <fieldset :disabled="!fuel.ok">
      <legend>Manual fuel plan</legend>
      <div class="plan-field">
        <label for="fe-consumption">Planned average consumption (kg/h)</label>
        <input id="fe-consumption" v-model="consumption" type="text" inputmode="decimal" />
      </div>
      <div class="plan-field">
        <label for="fe-trip">Planned flight duration (min)</label>
        <input id="fe-trip" v-model="trip" type="text" inputmode="decimal" />
      </div>
      <div class="plan-field">
        <label for="fe-reserve">Reserve duration (min)</label>
        <input id="fe-reserve" v-model="reserve" type="text" inputmode="decimal" />
      </div>
    </fieldset>
    <p>
      User-supplied consumption is assumed constant. Choose your own reserve; no regulatory minimum
      is supplied. Inputs last only while this preparation view is open; changing aircraft or
      reloading clears them.
    </p>
    <div v-if="plan" role="region" aria-label="Fuel planning results" aria-live="polite">
      <dl>
        <dt>Total endurance</dt>
        <dd>{{ format(plan.enduranceMinutes) }} min</dd>
        <dt>Trip fuel</dt>
        <dd>{{ format(plan.tripFuelKg) }} kg</dd>
        <dt>Required reserve fuel</dt>
        <dd>{{ format(plan.reserveFuelKg) }} kg</dd>
        <dt>Trip + reserve fuel</dt>
        <dd>{{ format(plan.requiredFuelKg) }} kg</dd>
        <dt>{{ plan.marginKg < 0 ? 'Fuel shortfall' : 'Remaining after trip + reserve' }}</dt>
        <dd>{{ format(Math.abs(plan.marginKg)) }} kg</dd>
      </dl>
      <p>
        Endurance = usable kg ÷ kg/h × 60. Required fuel = (trip min + reserve min) ÷ 60 × kg/h.
        Margin = usable − required kg.
      </p>
      <p v-if="plan.warning" role="alert">
        WARN-FE-001 — Insufficient fuel for the entered trip plus reserve.
      </p>
      <p v-if="plan.reserveShortfall" role="alert">
        Usable fuel is insufficient even for the reserve alone.
      </p>
      <p v-if="plan.marginKg === 0">Zero margin: exactly the entered arithmetic budget.</p>
      <p>
        Arithmetic planning aid only. Verify against your aircraft POH/AFM. This does not assess
        operational suitability or calculate trip-specific landing mass or CG.
      </p>
    </div>
    <p v-else-if="fuel.ok" role="status">
      Enter finite positive consumption and explicit nonnegative trip and reserve durations. Blank
      fields are unconfigured.
    </p>
  </div>
</template>

<style scoped>
.fuel-planner {
  padding: var(--space-4);
}
fieldset {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.plan-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
input {
  min-height: 44px;
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}
input:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
}
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
p {
  line-height: 1.5;
}
[role='alert'] {
  padding: var(--space-3);
  background: var(--color-warning-bg);
  color: var(--color-text);
  border-left: 3px solid var(--color-warning);
}
@media (min-width: 768px) {
  fieldset {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
