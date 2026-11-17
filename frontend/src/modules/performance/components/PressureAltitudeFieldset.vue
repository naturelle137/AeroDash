<script setup lang="ts">
import {
  PA_ELEVATION_UNITS,
  QNH_UNITS,
  type PressureAltitudeField,
} from '@/core/logic/pressure-altitude'
import type { usePressureAltitudeInput } from '../composables/pressure-altitude-input'

const props = defineProps<{ pa: ReturnType<typeof usePressureAltitudeInput>; showErrors: boolean }>()
// Destructured refs so the template unwraps them; the composable instance itself is not reactive.
const { warnings, method, direct, draft, derivation, savedRunway, notice, elevationProvenance, useRunwayElevation } = props.pa

function paError(field: PressureAltitudeField): string | undefined {
  const result = derivation.value
  if (result.status !== 'invalid') return undefined
  // Once the pilot starts typing a number, every missing or invalid part is named.
  const started = draft.qnh !== '' || draft.elevation !== ''
  return props.showErrors || started ? result.errors[field] : undefined
}
</script>

<template>
  <fieldset class="pa-method">
    <legend>Pressure altitude source</legend>
    <label class="choice"><input v-model="method" type="radio" name="pa-method" value="direct" />
      Enter pressure altitude directly</label>
    <label class="choice"><input v-model="method" type="radio" name="pa-method" value="qnh-elevation" />
      Derive from QNH and field elevation</label>
    <p v-if="!method">No method selected. Choose one; nothing is assumed.</p>
    <div v-if="method === 'direct'" class="fields">
      <label>Pressure altitude (ft)<input id="pa-direct" v-model="direct" type="text" inputmode="decimal" /></label>
    </div>
    <p v-if="method === 'direct'">Used exactly as entered. Field elevation is never treated as pressure altitude.</p>
    <section v-if="method === 'qnh-elevation'" aria-label="QNH and field elevation">
      <div class="fields">
        <div class="value-unit"><label for="pa-qnh">QNH<input id="pa-qnh" v-model="draft.qnh" type="text" inputmode="decimal" :aria-invalid="!!paError('qnh')" /></label>
        <div class="field unit-field">
          <label class="sr-only" for="pa-qnh-unit">QNH unit</label>
          <select id="pa-qnh-unit" v-model="draft.qnhUnit" :aria-invalid="!!paError('qnhUnit')">
            <option value="">Select unit</option>
            <option v-for="unit in QNH_UNITS" :key="unit" :value="unit">{{ unit }}</option>
          </select>
        </div>
        </div><div class="value-unit"><label for="pa-elevation">Pressure-altitude field elevation<input id="pa-elevation" v-model="draft.elevation" type="text" inputmode="decimal" :aria-invalid="!!paError('elevation')" /></label>
        <div class="field unit-field">
          <label class="sr-only" for="pa-elevation-unit">Pressure-altitude field elevation unit</label>
          <select id="pa-elevation-unit" v-model="draft.elevationUnit" :aria-invalid="!!paError('elevationUnit')">
            <option value="">Select unit</option>
            <option v-for="unit in PA_ELEVATION_UNITS" :key="unit" :value="unit">{{ unit }}</option>
          </select>
        </div>
      </div></div>
      <p v-for="field in (['qnh', 'qnhUnit', 'elevation', 'elevationUnit'] as const)" v-show="paError(field)" :key="field" class="field-error">{{ paError(field) }}</p>

      <button type="button" class="secondary" :disabled="!savedRunway" @click="useRunwayElevation()">
        Use saved manual runway elevation</button>
      <p v-if="!savedRunway">No saved, unchanged manual runway is available to copy from.</p>
      <p v-if="notice" role="status">{{ notice }}</p>
      <p v-if="draft.elevation">Field elevation source: {{ elevationProvenance }}</p>
      <p v-for="warning in warnings" :key="warning" role="alert">{{ warning }}</p>
      <div v-if="derivation.status === 'valid'" aria-label="Derived pressure altitude" class="derived">
        <p>Derived pressure altitude: <strong>{{ derivation.displayPressureAltitudeFt }} ft</strong></p>

      </div>
      <p v-else>No derived pressure altitude. Enter QNH and field elevation with units.</p>
      <details class="method-limits"><summary>Method: NOAA/NWS altimeter-setting and pressure-altitude formulas</summary><p>Solved for
        the station pressure P whose altimeter setting at this elevation equals the QNH (including the
        published 0.3 hPa term); PA = 145366.45 × (1 − (P / 1013.25)^0.190284) ft. With QNH 1013.25 hPa this
        gives about 8 ft below the elevation. It assumes the QNH is the current altimeter setting for this
        aerodrome and the elevation is where you need pressure altitude.
        It is not the 30 ft/hPa rule of thumb, not an aircraft model and not validated against your POH/AFM.
        These inputs are not stored.</p></details>
    </section>
  </fieldset>
</template>

<style scoped>
.pa-method { border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem; margin: 1rem 0; display: grid; gap: .5rem; min-width: 0; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
label { display: grid; gap: .5rem; }
.value-unit > * { min-width: 0; }
.value-unit input, .value-unit select { width: 100%; box-sizing: border-box; }
.value-unit label { overflow-wrap: anywhere; }
.value-unit { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .5rem; align-items: end; }
.unit-field { max-width: 6rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.field { display: grid; gap: .5rem; align-content: start; }
input, select, button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; min-width: 0; }
.choice { display: flex; align-items: center; gap: .5rem; min-height: 44px; padding: .5rem; cursor: pointer; }
.choice input { min-height: 24px; }
.secondary { justify-self: start; font-weight: 500; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
.field-error { color: var(--color-error, #b3261e); margin: 0; }
.derived strong { font-size: 1.25rem; }
summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
.method-limits { font-size: .9rem; overflow-wrap: anywhere; }
p { line-height: 1.6; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
</style>
