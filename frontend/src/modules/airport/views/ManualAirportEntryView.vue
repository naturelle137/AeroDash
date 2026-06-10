<template>
  <section class="manual-airport-view">
    <header class="manual-airport-header">
      <h1>Airport</h1>
      <p class="intro">
        Enter an ICAO code. Unlisted strips drop into manual entry, where you provide and override
        runway data yourself.
      </p>
    </header>

    <form class="icao-search" @submit.prevent="onSearch">
      <label for="icao-search-input">ICAO code</label>
      <div class="icao-search-row">
        <input
          id="icao-search-input"
          v-model="icaoQuery"
          type="text"
          maxlength="8"
          autocomplete="off"
          placeholder="e.g. ZZZZ"
        />
        <button type="submit" class="btn-primary" :disabled="icaoQuery.trim() === ''">Search</button>
      </div>
    </form>

    <div v-if="store.mode === 'manual-entry' && store.entry" class="manual-entry">
      <p class="manual-entry-banner" role="status">
        “{{ store.entry.icao }}” was not found in any database — entering manually. The resulting
        data is pilot-provided and unverified.
      </p>

      <fieldset class="field-block">
        <legend>Airport</legend>
        <div class="field-group">
          <label for="airport-name">Name</label>
          <input
            id="airport-name"
            type="text"
            :value="store.entry.name"
            @input="store.updateAirport({ name: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div class="field-group">
          <label for="airport-elevation">Field elevation (ft)</label>
          <DecimalInput
            id="airport-elevation"
            :model-value="store.entry.elevationFt"
            :allow-null="true"
            placeholder="e.g. 350"
            @update:model-value="store.updateAirport({ elevationFt: $event })"
          />
        </div>
      </fieldset>

      <fieldset class="field-block">
        <legend>Runway</legend>
        <div class="field-group">
          <label for="runway-designator">Designator</label>
          <input
            id="runway-designator"
            type="text"
            maxlength="3"
            :value="store.entry.runway.designator"
            @input="store.updateRunway({ designator: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div class="field-group">
          <label for="runway-heading">Magnetic heading (°M)</label>
          <DecimalInput
            id="runway-heading"
            :model-value="store.entry.runway.magneticHeadingDeg"
            :allow-null="true"
            :min="0"
            :max="360"
            placeholder="e.g. 270"
            @update:model-value="store.updateRunway({ magneticHeadingDeg: $event })"
          />
        </div>
        <div class="field-group">
          <label for="runway-surface-type">Base surface type</label>
          <select
            id="runway-surface-type"
            :value="store.entry.runway.baseSurfaceType"
            @change="
              store.updateRunway({
                baseSurfaceType: ($event.target as HTMLSelectElement).value as BaseSurfaceType,
              })
            "
          >
            <option value="paved">Paved (asphalt / concrete)</option>
            <option value="grass">Grass / unpaved</option>
          </select>
        </div>
        <div class="field-group">
          <label for="runway-tora">TORA (m)</label>
          <DecimalInput
            id="runway-tora"
            :model-value="store.entry.runway.toraM"
            :allow-null="true"
            :min="0"
            placeholder="e.g. 600"
            @update:model-value="store.updateRunway({ toraM: $event })"
          />
        </div>
        <div class="field-group">
          <label for="runway-toda">TODA (m)</label>
          <DecimalInput
            id="runway-toda"
            :model-value="store.entry.runway.todaM"
            :allow-null="true"
            :min="0"
            @update:model-value="store.updateRunway({ todaM: $event })"
          />
        </div>
        <div class="field-group">
          <label for="runway-asda">ASDA (m)</label>
          <DecimalInput
            id="runway-asda"
            :model-value="store.entry.runway.asdaM"
            :allow-null="true"
            :min="0"
            @update:model-value="store.updateRunway({ asdaM: $event })"
          />
        </div>
        <div class="field-group">
          <label for="runway-lda">LDA (m)</label>
          <DecimalInput
            id="runway-lda"
            :model-value="store.entry.runway.ldaM"
            :allow-null="true"
            :min="0"
            @update:model-value="store.updateRunway({ ldaM: $event })"
          />
        </div>
        <div class="field-group">
          <label for="runway-slope">Slope (%)</label>
          <DecimalInput
            id="runway-slope"
            :model-value="store.entry.runway.slopePercent"
            :allow-null="true"
            @update:model-value="store.updateRunway({ slopePercent: $event })"
          />
        </div>
        <SurfaceConditionSelect
          select-id="runway-surface-condition"
          :base="store.entry.runway.baseSurfaceType"
          :model-value="store.entry.runway.surfaceConditionId"
          @update:model-value="store.selectSurfaceCondition($event)"
        />
      </fieldset>

      <p v-if="store.rejection" class="compute-rejection" role="alert">
        {{ store.rejection.message }}
      </p>
      <p v-else-if="store.canCompute" class="compute-ready" role="status">
        Runway data complete — ready to compute performance.
      </p>

      <div class="actions">
        <button type="button" class="btn-secondary" @click="onSave">Save runway</button>
        <button type="button" class="btn-primary" @click="store.requestCompute()">
          Compute performance
        </button>
      </div>
      <p v-if="saved" class="save-confirmation" role="status">Runway data saved.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
// @IMP-AP-VIEW-002@ (FROM: @REQ-AP-003@, @REQ-AP-004@, @REQ-AP-006@)
import { ref } from 'vue'
import DecimalInput from '@/shared/components/DecimalInput.vue'
import type { BaseSurfaceType } from '../domain/airport.types'
import { useManualAirportStore } from '../stores/manual-airport.store'
import SurfaceConditionSelect from '../components/SurfaceConditionSelect.vue'

const store = useManualAirportStore()
const icaoQuery = ref('')
const saved = ref(false)

function onSearch(): void {
  if (icaoQuery.value.trim() === '') return
  store.searchByIcao(icaoQuery.value)
  saved.value = false
}

async function onSave(): Promise<void> {
  await store.saveEntry()
  saved.value = true
}
</script>

<style scoped>
.manual-airport-view {
  max-width: 40rem;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.icao-search-row {
  display: flex;
  gap: 0.5rem;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  padding: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.manual-entry-banner {
  background: #fef3c7;
  border-left: 4px solid #d97706;
  padding: 0.5rem 0.75rem;
  margin: 0;
}

.compute-rejection {
  background: #fee2e2;
  border-left: 4px solid #b91c1c;
  padding: 0.5rem 0.75rem;
  margin: 0;
  color: #7f1d1d;
}

.compute-ready,
.save-confirmation {
  color: #065f46;
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
}
</style>
