<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { compareWindLimits } from '@/core/logic/wind-limits'
import type { AircraftProfileWindLimit } from '@/core/adapters/aircraft.schema'
import { useWeatherInputsStore } from '@/modules/weather/stores/weather-inputs.store'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import { resolveWind } from '@/core/logic/weather-inputs'
import { computeWindComponents, WIND_SPEED_UNITS, type WindComponentField, type WindComponentInput } from '@/core/logic/wind-components'

const props = defineProps<{ windLimits?: AircraftProfileWindLimit[] }>()
const weather = useWeatherInputsStore()
const runwayStore = useManualRunwayStore()
if (!runwayStore.loaded) runwayStore.load()
// Heading of the saved, current runway as the pilot entered it; never derived from the designator.
const runwayHeading = computed(() => {
  const runway = runwayStore.current?.record.runway
  return runway?.heading === undefined ? null : { text: String(runway.heading), label: `${runway.aerodrome} ${runway.designator}` }
})
// The wind fields here are an override; while both are blank the shared Weather wind is used.
const wind = computed(() => resolveWind({ ...input.value, gustSpeed: input.value.gustSpeed ?? '' }, weather.wind))
const effective = computed<WindComponentInput>(() => ({ ...wind.value.value, runwayHeading: input.value.runwayHeading.trim() ? input.value.runwayHeading : runwayHeading.value?.text ?? '' }))
const provenance = computed(() => {
  if (wind.value.source === 'manual') return 'Manual entry here overrides the Weather wind.'
  if (wind.value.source === 'none') return 'No wind entered. Enter it here or in Weather.'
  const note = weather.sourceOf('wind')
  return `Wind from Weather (${note ?? 'manual entry'}${note ? '; retrieved, unverified' : ''}).`
})
// While the Weather wind is shown, its unit is shown too; the unit is edited in Weather.
const unitModel = computed({ get: () => effective.value.unit, set: (unit: string) => { input.value.unit = unit } })
const notifications = computed(() => compareWindLimits(effective.value, props.windLimits))
const input = defineModel<WindComponentInput>({ default: () => reactive({ runwayHeading: '', windDirection: '', windSpeed: '', unit: 'kt' }) })
// A heading typed for one runway must not silently apply to another selected runway.
watch(() => runwayStore.current?.record.runway && [runwayStore.current.record.runway.aerodrome, runwayStore.current.record.runway.designator, runwayStore.current.record.runway.heading], () => { input.value.runwayHeading = '' }, { flush: 'sync' })
watch(() => [input.value.windDirection, input.value.windSpeed, input.value.unit], () => { input.value.gustSpeed = '' }, { flush: 'sync' })
const gustResult = computed(() => effective.value.gustSpeed?.trim() ? computeWindComponents({ ...effective.value, windSpeed: effective.value.gustSpeed ?? '' }) : null)
// Computed, so results recompute or clear synchronously with every edit.
const result = computed(() => computeWindComponents(effective.value))
const errors = computed<Partial<Record<WindComponentField, string>>>(() => result.value.status === 'invalid' ? result.value.errors : {})
const describedBy = (field: WindComponentField) => errors.value[field] ? `wind-${field}-error` : undefined
const abs = (value: number) => Math.abs(value).toFixed(1)
</script>

<template>
  <section class="panel" aria-labelledby="manual-wind-heading">
    <h3 id="manual-wind-heading">Manual wind components</h3>
    <p><strong>User-entered — advisory only.</strong> Enter the runway heading and the wind you obtained from an
      official source. Use the same reference (magnetic or true) for both. The runway
      heading is not derived from the designator, and nothing here changes performance results.</p>
    <div class="fields">
      <div class="field">
        <label for="wind-runway-heading">Runway heading (°, 1–360)</label>
        <input id="wind-runway-heading" v-model="input.runwayHeading" type="text" inputmode="decimal" autocomplete="off"
          :placeholder="runwayHeading?.text ?? ''" :aria-invalid="!!errors.runwayHeading" :aria-describedby="describedBy('runwayHeading')" />
        <p v-if="runwayHeading && !input.runwayHeading.trim()" class="hint">Heading {{ runwayHeading.text }}° from saved runway {{ runwayHeading.label }} (pilot-entered). Type here to override.</p>
        <p v-if="errors.runwayHeading" id="wind-runwayHeading-error" class="field-error">{{ errors.runwayHeading }}</p>
      </div>
      <div class="field">
        <label for="wind-direction">Wind from (°, 1–360)</label>
        <input id="wind-direction" v-model="input.windDirection" type="text" inputmode="decimal" autocomplete="off" :placeholder="wind.source === 'weather' ? wind.value.windDirection : ''"
          :aria-invalid="!!errors.windDirection" :aria-describedby="describedBy('windDirection')" />
        <p v-if="errors.windDirection" id="wind-windDirection-error" class="field-error">{{ errors.windDirection }}</p>
      </div>
      <div class="field value-unit">
        <div class="field">
          <label for="wind-speed">Wind speed</label>
          <input id="wind-speed" v-model="input.windSpeed" type="text" inputmode="decimal" autocomplete="off" :placeholder="wind.source === 'weather' ? wind.value.windSpeed : ''"
            :aria-invalid="!!errors.windSpeed" :aria-describedby="describedBy('windSpeed')" />
        </div>
        <div class="field">
          <label class="sr-only" for="wind-speed-unit">Wind speed unit</label>
          <select id="wind-speed-unit" v-model="unitModel" :disabled="wind.source === 'weather'" :aria-invalid="!!errors.unit" :aria-describedby="describedBy('unit')">
            <option v-for="unit in WIND_SPEED_UNITS" :key="unit" :value="unit">{{ unit }}</option>
          </select>
        </div>
        <p v-if="errors.windSpeed" id="wind-windSpeed-error" class="field-error">{{ errors.windSpeed }}</p>
        <p v-if="errors.unit" id="wind-unit-error" class="field-error">{{ errors.unit }}</p>
      </div>
      <div class="field">
        <label for="wind-gust">Gust speed (optional, same unit)</label>
        <input id="wind-gust" v-model="input.gustSpeed" type="text" inputmode="decimal" autocomplete="off" :placeholder="wind.source === 'weather' ? wind.value.gustSpeed : ''" :aria-invalid="gustResult?.status === 'invalid'" aria-describedby="wind-gust-help" />
        <p id="wind-gust-help">Pilot-entered gust; re-enter after changing wind direction, speed or unit.</p>
        <p v-if="gustResult?.status === 'invalid'" class="field-error">Gust comparison unavailable: check gust, direction and runway heading.</p>
      </div>
    </div>
    <p class="source-note">{{ provenance }}</p>
    <div role="status" aria-label="Wind components" class="result">
      <template v-if="result.status === 'valid'">
        <p v-if="Number(effective.windSpeed.replace(',', '.')) === 0">Calm wind (0 {{ result.unit }}).</p>
        <dl>
          <div>
            <dt>{{ result.headwind >= 0 ? 'Headwind' : 'Tailwind' }}</dt>
            <dd>{{ abs(result.headwind) }} {{ result.unit }}</dd>
          </div>
          <div>
            <dt>Crosswind</dt>
            <dd v-if="result.crosswind === 0">0.0 {{ result.unit }}</dd>
            <dd v-else>{{ abs(result.crosswind) }} {{ result.unit }} from the {{ result.crosswind > 0 ? 'right' : 'left' }}</dd>
          </div>
        </dl>
        <dl v-if="gustResult?.status === 'valid'" aria-label="Gust components">
          <div>
            <dt>Gust {{ gustResult.headwind >= 0 ? 'headwind' : 'tailwind' }}</dt>
            <dd>{{ abs(gustResult.headwind) }} {{ gustResult.unit }}</dd>
          </div>
          <div>
            <dt>Gust crosswind</dt>
            <dd v-if="gustResult.crosswind === 0">0.0 {{ gustResult.unit }}</dd>
            <dd v-else>{{ abs(gustResult.crosswind) }} {{ gustResult.unit }} from the {{ gustResult.crosswind > 0 ? 'right' : 'left' }}</dd>
          </div>
        </dl>
        <p class="hint">Computed from your entries; rounded to 0.1. Check all limits yourself; missing or invalid gusts are not assessed and no suitability verdict is given. Pilot in command remains responsible.</p>
        <p v-for="(note, index) in notifications" :key="index" :class="note.severity === 'CRITICAL' ? 'critical' : 'warning'">{{ note.severity }} {{ note.id }}: {{ note.message }}</p>
      </template>
      <p v-else-if="result.status === 'invalid'">No wind components: correct the highlighted entries.</p>
      <p v-else>Enter runway heading, wind direction and speed to see the components.</p>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 1rem; border: 1px solid var(--color-border); border-radius: 12px; min-width: 0; display: grid; gap: .75rem; }
h3, p { margin: 0; }
p { line-height: 1.6; overflow-wrap: anywhere; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
.field { display: grid; gap: .5rem; align-content: start; min-width: 0; }
.value-unit { grid-template-columns: minmax(0, 1fr) auto; align-items: end; }
.value-unit > p { grid-column: 1 / -1; }
.value-unit select { max-width: 6rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
input, select { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; min-width: 0; box-sizing: border-box; width: 100%; }
[aria-invalid="true"] { border-color: var(--color-danger, #c0392b); border-width: 2px; }
.field-error { color: var(--color-danger, #c0392b); font-weight: 600; }
.field-error::before { content: '⚠ '; }
.result { border-left: 4px solid var(--color-primary); padding-left: .75rem; display: grid; gap: .5rem; }
dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: .75rem; margin: 0; }
dt { font-weight: 600; }
dd { margin: .25rem 0 0; font-size: 1.25rem; font-weight: 700; }
.critical { color: var(--color-critical, #b91c1c); font-weight: 700; }
.warning { color: var(--color-warning, #805000); font-weight: 700; }
.hint { font-size: .95rem; }
</style>

<style scoped>
@media (max-width: 767.98px) {
  input, select { scroll-margin-bottom: calc(8rem + env(safe-area-inset-bottom, 0px)); }
}
</style>
