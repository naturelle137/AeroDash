<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { usableFuelForPlanning } from '../services/usable-fuel'
import { calculateTripArrival } from '@/core/logic/trip-arrival'
import { calculateFuelEndurance } from '@/core/logic/fuel-endurance'

const store = useMassBalanceStore()
const method = ref('')
const directTripFuel = ref('')
const consumption = ref('')
const trip = ref('')
const reserve = ref('')
watch(
  () => store.aircraft?.id,
  () => {
    method.value = ''
    directTripFuel.value = ''
    consumption.value = ''
    trip.value = ''
    reserve.value = ''
  },
  { flush: 'sync' },
)
watch(
  method,
  () => {
    directTripFuel.value = ''
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
  method.value === 'duration' && fuel.value.ok
    ? calculateFuelEndurance({
        usableFuelKg: fuel.value.usableFuelKg,
        consumptionKgPerHour: decimal(consumption.value),
        tripMinutes: decimal(trip.value),
        reserveMinutes: decimal(reserve.value),
      })
    : null,
)
const plan = computed(() => (result.value?.ok ? result.value.plan : null))
const arrival = computed(() => {
  if (!fuel.value.ok || !method.value) return null
  const tripFuelKg =
    method.value === 'direct' ? decimal(directTripFuel.value) : plan.value?.tripFuelKg
  if (tripFuelKg === undefined) return null
  if (!Number.isFinite(tripFuelKg) || tripFuelKg < 0) {
    return {
      ok: false as const,
      reason: 'Enter explicit finite nonnegative Trip Fuel in kg. Blank fields are unconfigured.',
    }
  }
  const mb = store.lastResult
  if (
    !mb?.success ||
    store.hasErrorNotification ||
    mb.violations.some((v) => v.type === 'STATION_LIMIT_EXCEEDED')
  ) {
    return { ok: false as const, reason: 'Valid current Mass & Balance loading is required.' }
  }
  const result = calculateTripArrival({
    takeoffMassKg: mb.takeoffCenterOfGravityPoint.mass,
    usableFuelKg: fuel.value.usableFuelKg,
    tripFuelKg,
  })
  if (result.ok) return result
  return {
    ok: false as const,
    reason:
      result.reason === 'TRIP_EXCEEDS_USABLE_FUEL'
        ? 'Trip fuel exceeds available usable fuel; reduce the trip or correct the tank loads.'
        : 'Mass & Balance and fuel inventory must contain finite, consistent masses.',
  }
})
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
        <label for="fe-method">Planning method</label>
        <select id="fe-method" v-model="method">
          <option value="" disabled>Choose a planning method</option>
          <option value="duration">Duration and consumption</option>
          <option value="direct">Direct Trip Fuel (kg)</option>
        </select>
      </div>
      <div v-if="method === 'direct'" class="plan-field">
        <label for="fe-direct-trip">Trip Fuel (kg)</label>
        <input id="fe-direct-trip" v-model="directTripFuel" type="text" inputmode="decimal" />
      </div>
      <template v-if="method === 'duration'">
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
      </template>
    </fieldset>
    <p v-if="method === 'duration'">
      User-supplied consumption is assumed constant. Choose your own reserve; no regulatory minimum
      is supplied. Inputs last only while this preparation view is open; changing aircraft or
      reloading clears them.
    </p>
    <p v-else>
      Enter the fuel mass expected to be burned during the trip. No duration, consumption or reserve
      budget is calculated. Inputs last only while this preparation view is open; changing aircraft
      or reloading clears them.
    </p>
    <div
      v-if="fuel.ok && (plan || (method === 'direct' && arrival?.ok))"
      role="region"
      aria-label="Fuel planning results"
      aria-live="polite"
    >
      <dl v-if="plan">
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
      <section v-if="arrival?.ok" aria-label="Estimated trip arrival" aria-live="polite">
        <h3>Estimated trip arrival</h3>
        <dl>
          <dt>Takeoff mass</dt>
          <dd>{{ format(arrival.takeoffMassKg) }} kg</dd>
          <dt>Trip fuel burned</dt>
          <dd>{{ format(arrival.tripFuelKg) }} kg</dd>
          <dt>Estimated arrival mass</dt>
          <dd>{{ format(arrival.arrivalMassKg) }} kg</dd>
          <dt>Usable fuel remaining on arrival</dt>
          <dd>{{ format(arrival.remainingFuelKg) }} kg</dd>
        </dl>
      </section>
      <p v-else-if="arrival" role="status">Arrival estimate unavailable: {{ arrival.reason }}</p>
      <p v-if="plan">
        Endurance = usable kg ÷ kg/h × 60. Required fuel = (trip min + reserve min) ÷ 60 × kg/h.
        Margin = usable − required kg.
      </p>
      <p v-if="plan?.warning" role="alert">
        WARN-FE-001 — Insufficient fuel for the entered trip plus reserve.
      </p>
      <p v-if="plan?.reserveShortfall" role="alert">
        Usable fuel is insufficient even for the reserve alone.
      </p>
      <p v-if="plan?.marginKg === 0">Zero margin: exactly the entered arithmetic budget.</p>
      <p>
        Arithmetic planning aid only. Verify against your aircraft POH/AFM. This does not assess
        operational suitability, landing CG or the envelope. Estimated arrival mass = validated
        M&amp;B takeoff mass − trip fuel burned. Reserve remains on board; fuel remaining on arrival
        differs from the budget margin after trip + reserve. The separate M&amp;B landing point
        assumes all usable fuel is burned.
      </p>
    </div>
    <p v-else-if="fuel.ok && arrival && !arrival.ok" role="status">
      Arrival estimate unavailable: {{ arrival.reason }}
    </p>
    <p v-else-if="fuel.ok && !method" role="status">
      Choose a planning method to configure the plan.
    </p>
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
input,
select {
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
input:focus-visible,
select:focus-visible {
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
