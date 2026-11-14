<script setup lang="ts">
import { useFuelPlanning, type FuelPlanning } from '../services/use-fuel-planning'
const props = defineProps<{ planning?: FuelPlanning }>()
const { method, directTripFuel, consumption, trip, reserve, sequence, sequences, fuel, plan, arrival, arrivalCg, format } = props.planning ?? useFuelPlanning()
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
      <div v-if="sequences.length" class="plan-field">
        <label for="fe-sequence">Arrival CG burn sequence</label>
        <select id="fe-sequence" v-model="sequence">
          <option value="" disabled>Choose a named burn sequence</option>
          <option v-for="name in sequences" :key="name" :value="name">{{ name }}</option>
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
          <template v-if="arrivalCg?.ok">
            <dt>Estimated arrival CG</dt>
            <dd data-testid="arrival-cg">{{ format(arrivalCg.arrivalCgM) }} m</dd>
          </template>
        </dl>
        <p v-if="arrivalCg && !arrivalCg.ok" role="status">
          Estimated arrival CG unavailable: {{ arrivalCg.reason }}
        </p>
        <p>
          Arrival CG requires fixed-arm tanks without lookup tables. Multiple tanks require an
          explicit complete named burn sequence; empty available tanks count too.
        </p>
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
        operational suitability, landing suitability or the full burn path/envelope. Estimated
        arrival mass = validated M&amp;B takeoff mass − trip fuel burned. Reserve remains on board;
        fuel remaining on arrival differs from the budget margin after trip + reserve. The separate
        M&amp;B landing point assumes all usable fuel is burned. Estimated trip arrival CG subtracts
        the burned fuel moment from the current M&amp;B takeoff moment; it is separate from that
        all-usable-burned point.
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
