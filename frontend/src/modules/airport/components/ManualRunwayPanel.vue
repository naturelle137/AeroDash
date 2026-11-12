<script setup lang="ts">
import { computed } from 'vue'
import {
  MAX_AERODROME_LENGTH,
  MAX_DESIGNATOR_LENGTH,
  SURFACE_CONDITIONS,
  SURFACE_TYPES,
  type ManualRunwayField,
} from '@/core/logic/manual-runway'
import { useManualRunwayStore } from '../stores/manual-runway.store'

const runway = useManualRunwayStore()
const surfaceTypeLabels = { paved: 'Paved', unpaved: 'Grass / unpaved' } as const
const conditionOptions = computed(() => {
  const type = runway.draft.surfaceType
  return type === 'paved' || type === 'unpaved' ? SURFACE_CONDITIONS[type] : []
})
const conditionLabel = computed(() => {
  const record = runway.current?.record
  if (!record) return ''
  return SURFACE_CONDITIONS[record.runway.surface.type].find((option) => option.value === record.runway.surface.condition)?.label ?? ''
})
const savedAt = computed(() => runway.saved ? new Date(runway.saved.savedAt).toLocaleString() : '')
const errorCount = computed(() => Object.keys(runway.errors).length)

function error(field: ManualRunwayField): string | undefined {
  return runway.showErrors ? runway.errors[field] : undefined
}
function describedBy(field: ManualRunwayField): string | undefined {
  return error(field) ? `manual-runway-${field}-error` : undefined
}

// Synchronous local storage: restore before first render so no empty form flashes.
if (!runway.loaded) runway.load()
</script>

<template>
  <form class="panel manual-runway" novalidate aria-labelledby="manual-runway-heading" @submit.prevent="runway.save()">
    <h2 id="manual-runway-heading">Manual runway</h2>
    <p class="provenance"><strong>User-entered — not validated against airport data.</strong>
      Copy declared distances, elevation and the current surface condition from official sources
      (AIP/aerodrome chart, NOTAM). No airport database or online lookup is used.</p>
    <p v-if="runway.storageError" role="alert" class="storage-error">{{ runway.storageError }}</p>

    <div class="fields">
      <div class="field">
        <label for="manual-runway-aerodrome">Aerodrome</label>
        <input id="manual-runway-aerodrome" v-model="runway.draft.aerodrome" type="text" autocomplete="off"
          :maxlength="MAX_AERODROME_LENGTH" :aria-invalid="!!error('aerodrome')" :aria-describedby="describedBy('aerodrome')" />
      </div>
      <div class="field">
        <label for="manual-runway-designator">Runway designator</label>
        <input id="manual-runway-designator" v-model="runway.draft.designator" type="text" autocomplete="off"
          :maxlength="MAX_DESIGNATOR_LENGTH" :aria-invalid="!!error('designator')" :aria-describedby="describedBy('designator')" />
      </div>
    </div>
    <p v-if="error('aerodrome')" :id="describedBy('aerodrome')" class="field-error">{{ error('aerodrome') }}</p>
    <p v-if="error('designator')" :id="describedBy('designator')" class="field-error">{{ error('designator') }}</p>

    <fieldset>
      <legend>Declared available distances</legend>
      <div class="value-unit">
        <div class="field">
          <label for="manual-runway-tora">TORA — takeoff run available</label>
          <input id="manual-runway-tora" v-model="runway.draft.tora" type="text" inputmode="decimal"
            :aria-invalid="!!error('tora')" :aria-describedby="describedBy('tora')" />
        </div>
        <div class="field">
          <label for="manual-runway-tora-unit">TORA unit</label>
          <select id="manual-runway-tora-unit" v-model="runway.draft.toraUnit" :aria-invalid="!!error('toraUnit')" :aria-describedby="describedBy('toraUnit')">
            <option value="">Select unit</option><option value="m">m</option><option value="ft">ft</option>
          </select>
        </div>
      </div>
      <p v-if="error('tora')" :id="describedBy('tora')" class="field-error">{{ error('tora') }}</p>
      <p v-if="error('toraUnit')" :id="describedBy('toraUnit')" class="field-error">{{ error('toraUnit') }}</p>
      <div class="value-unit">
        <div class="field">
          <label for="manual-runway-lda">LDA — landing distance available</label>
          <input id="manual-runway-lda" v-model="runway.draft.lda" type="text" inputmode="decimal"
            :aria-invalid="!!error('lda')" :aria-describedby="describedBy('lda')" />
        </div>
        <div class="field">
          <label for="manual-runway-lda-unit">LDA unit</label>
          <select id="manual-runway-lda-unit" v-model="runway.draft.ldaUnit" :aria-invalid="!!error('ldaUnit')" :aria-describedby="describedBy('ldaUnit')">
            <option value="">Select unit</option><option value="m">m</option><option value="ft">ft</option>
          </select>
        </div>
      </div>
      <p v-if="error('lda')" :id="describedBy('lda')" class="field-error">{{ error('lda') }}</p>
      <p v-if="error('ldaUnit')" :id="describedBy('ldaUnit')" class="field-error">{{ error('ldaUnit') }}</p>
    </fieldset>

    <fieldset>
      <legend>Field elevation</legend>
      <div class="value-unit">
        <div class="field">
          <label for="manual-runway-elevation">Field elevation</label>
          <input id="manual-runway-elevation" v-model="runway.draft.fieldElevation" type="text" inputmode="decimal"
            :aria-invalid="!!error('fieldElevation')" :aria-describedby="describedBy('fieldElevation')" />
        </div>
        <div class="field">
          <label for="manual-runway-elevation-unit">Field elevation unit</label>
          <select id="manual-runway-elevation-unit" v-model="runway.draft.fieldElevationUnit" :aria-invalid="!!error('fieldElevationUnit')" :aria-describedby="describedBy('fieldElevationUnit')">
            <option value="">Select unit</option><option value="m">m</option><option value="ft">ft</option>
          </select>
        </div>
      </div>
      <p v-if="error('fieldElevation')" :id="describedBy('fieldElevation')" class="field-error">{{ error('fieldElevation') }}</p>
      <p v-if="error('fieldElevationUnit')" :id="describedBy('fieldElevationUnit')" class="field-error">{{ error('fieldElevationUnit') }}</p>
      <p class="hint">Elevation above mean sea level; values below sea level are allowed. It is not pressure
        altitude and is not used for the table lookup.</p>
    </fieldset>

    <fieldset>
      <legend>Runway surface</legend>
      <div class="value-unit">
        <div class="field">
          <label for="manual-runway-surface-type">Surface type</label>
          <select id="manual-runway-surface-type" v-model="runway.draft.surfaceType" :aria-invalid="!!error('surfaceType')" :aria-describedby="describedBy('surfaceType')">
            <option value="">Select surface type</option>
            <option v-for="type in SURFACE_TYPES" :key="type" :value="type">{{ surfaceTypeLabels[type] }}</option>
          </select>
        </div>
        <div class="field">
          <label for="manual-runway-surface-condition">Surface condition</label>
          <select id="manual-runway-surface-condition" v-model="runway.draft.surfaceCondition" :disabled="!conditionOptions.length"
            :aria-invalid="!!error('surfaceCondition')" :aria-describedby="describedBy('surfaceCondition')">
            <option value="">Select surface condition</option>
            <option v-for="option in conditionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
      </div>
      <p v-if="error('surfaceType')" :id="describedBy('surfaceType')" class="field-error">{{ error('surfaceType') }}</p>
      <p v-if="error('surfaceCondition')" :id="describedBy('surfaceCondition')" class="field-error">{{ error('surfaceCondition') }}</p>
    </fieldset>

    <p v-if="runway.showErrors && errorCount" role="alert">Runway inputs not saved: correct {{ errorCount }}
      {{ errorCount === 1 ? 'field' : 'fields' }}.</p>
    <div class="actions">
      <button type="submit">Save runway inputs</button>
      <button v-if="runway.hasUnsavedChanges" type="button" @click="runway.revert()">Discard changes</button>
      <button type="button" class="secondary" @click="runway.clear()">Clear runway inputs</button>
    </div>
    <p v-if="runway.notice" role="status">{{ runway.notice }}</p>
    <p v-if="runway.hasUnsavedChanges" role="status" class="unsaved">Unsaved changes: the saved runway
      ({{ runway.saved?.runway.aerodrome }} {{ runway.saved?.runway.designator }}) is not shown as current until you save or discard.</p>

    <section v-if="runway.current" aria-label="Saved manual runway" class="summary">
      <h3>{{ runway.current.record.runway.aerodrome }} — runway {{ runway.current.record.runway.designator }}</h3>
      <p class="provenance">User-entered, not airport-validated · saved {{ savedAt }}</p>
      <dl>
        <div><dt>TORA</dt><dd>{{ runway.current.record.runway.tora.value }} {{ runway.current.record.runway.tora.unit }}
          <span class="normalized">({{ runway.current.display.toraM }} m)</span></dd></div>
        <div><dt>LDA</dt><dd>{{ runway.current.record.runway.lda.value }} {{ runway.current.record.runway.lda.unit }}
          <span class="normalized">({{ runway.current.display.ldaM }} m)</span></dd></div>
        <div><dt>Field elevation</dt><dd>{{ runway.current.record.runway.fieldElevation.value }} {{ runway.current.record.runway.fieldElevation.unit }}
          <span class="normalized">({{ runway.current.record.runway.fieldElevation.unit === 'ft' ? `${runway.current.display.fieldElevationM} m` : `${runway.current.display.fieldElevationFt} ft` }})</span></dd></div>
        <div><dt>Surface</dt><dd>{{ surfaceTypeLabels[runway.current.record.runway.surface.type] }} · {{ conditionLabel }}</dd></div>
      </dl>
      <p class="hint">Converted values use 1 ft = 0.3048 m; available distances are rounded down.</p>
    </section>
    <p role="status" class="assessment"><strong>Runway assessment unavailable.</strong>
      Surface, slope, wind and operational safety factors are not yet applied, so AeroDash does not compare
      distances or give a Go result. Compare the corrected POH/AFM distances with the declared runway yourself.</p>
  </form>
</template>

<style scoped>
.panel { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface-card); min-width: 0; display: grid; gap: .75rem; }
h2, h3 { margin: 0; }
p { margin: 0; line-height: 1.6; }
fieldset { border: 1px solid var(--color-border); border-radius: 8px; padding: .75rem 1rem 1rem; margin: 0; display: grid; gap: .5rem; min-width: 0; }
legend { font-weight: 700; padding: 0 .25rem; }
.fields, .value-unit { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; }
.field { display: grid; gap: .5rem; align-content: start; }
input, select, button { font: inherit; padding: .75rem; min-height: 44px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; min-width: 0; }
select:disabled { opacity: .6; }
[aria-invalid="true"] { border-color: var(--color-danger, #c0392b); border-width: 2px; }
.field-error { color: var(--color-danger, #c0392b); font-weight: 600; }
.field-error::before { content: '⚠ '; }
.actions { display: flex; flex-wrap: wrap; gap: .75rem; }
button { cursor: pointer; font-weight: 600; }
.provenance, .unsaved { overflow-wrap: anywhere; }
.summary { border-left: 4px solid var(--color-primary); padding-left: .75rem; display: grid; gap: .5rem; overflow-wrap: anywhere; }
dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: .75rem; margin: 0; }
dt { font-weight: 600; }
dd { margin: .25rem 0 0; font-size: 1.25rem; font-weight: 700; }
.normalized { font-size: 1rem; font-weight: 400; }
.hint { font-size: .95rem; }
[role="alert"] { padding: .75rem; border-left: 4px solid var(--color-warning, #ba7b24); }
.assessment { padding: .75rem; border: 1px dashed var(--color-border); border-radius: 8px; }
</style>
