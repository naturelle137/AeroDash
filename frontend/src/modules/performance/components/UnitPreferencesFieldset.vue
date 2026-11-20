<script setup lang="ts">
import { LENGTH_UNITS, isLengthUnit } from '@/core/logic/unit-preferences'
import { useLoadedUnitPreferences } from '@/modules/performance/stores/unit-preferences.store'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'

const units = useLoadedUnitPreferences()
const massBalance = useMassBalanceStore()

function choose(field: 'fieldElevation' | 'runwayDistance', event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isLengthUnit(value)) units.set(field, value)
}
</script>

<template>
  <fieldset class="unit-preferences" aria-describedby="unit-preferences-origin">
    <legend>Unit preferences</legend>
    <dl>
      <div><dt>QNH</dt><dd>hPa</dd></div>
      <div><dt>Pressure altitude</dt><dd>ft</dd></div>
    </dl>
    <div class="fields">
      <div class="field">
        <label for="unit-pref-elevation">Field elevation</label>
        <select id="unit-pref-elevation" :value="units.preferences.fieldElevation" @change="choose('fieldElevation', $event)">
          <option v-for="unit in LENGTH_UNITS" :key="unit" :value="unit">{{ unit }}</option>
        </select>
      </div>
      <div class="field">
        <label for="unit-pref-runway">Declared runway distances</label>
        <select id="unit-pref-runway" :value="units.preferences.runwayDistance" @change="choose('runwayDistance', $event)">
          <option v-for="unit in LENGTH_UNITS" :key="unit" :value="unit">{{ unit }}</option>
        </select>
      </div>
    </div>
    <p id="unit-preferences-origin">{{ massBalance.isDemoActive
      ? 'Demo unit choices are temporary and will be discarded.'
      : units.origin === 'saved'
      ? 'Saved on this device. They set the units of empty fields; entered values and saved runways keep their own units.'
      : 'Defaults: AeroDash reads no locale or region, so it uses hPa, ft and m until you choose.' }}
      Numeric QNH and pressure altitude are never saved.</p>
    <p v-if="units.notice" role="alert">{{ units.notice }}</p>
  </fieldset>
</template>

<style scoped>
.unit-preferences { border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem; margin: 0; display: grid; gap: .5rem; min-width: 0; }
legend { font-weight: 700; padding: 0 .25rem; }
dl { display: flex; flex-wrap: wrap; gap: 1.5rem; margin: 0; }
dl div { display: flex; gap: .5rem; }
dt { font-weight: 600; }
dd { margin: 0; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
.field { display: grid; gap: .5rem; }
select { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; }
p { margin: 0; line-height: 1.6; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
</style>
