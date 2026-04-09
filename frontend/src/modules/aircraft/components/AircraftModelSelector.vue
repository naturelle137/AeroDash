<template>
  <!-- @IMP-AC-VIEW-002@ (FROM: @REQ-UI-001@, @REQ-UI-002@, @REQ-UI-003@, @REQ-UI-004@) -->
  <div class="aircraft-model-selector">
    <!-- Manufacturer selection -->
    <div class="field-group">
      <label for="manufacturer-select">Manufacturer</label>
      <select
        id="manufacturer-select"
        :value="manufacturer"
        @change="onManufacturerChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">-- Select Manufacturer --</option>
        <option v-for="mfr in manufacturers" :key="mfr" :value="mfr">{{ mfr }}</option>
      </select>
    </div>

    <!-- Model selection — dropdown or free text depending on manufacturer (REQ-UI-002) -->
    <div class="field-group">
      <label for="model-input">Model</label>
      <template v-if="isOtherManufacturer">
        <!-- Free text for 'Other' manufacturer (REQ-UI-002) -->
        <input
          id="model-input"
          type="text"
          :value="model"
          placeholder="Enter model name"
          @input="onModelInput(($event.target as HTMLInputElement).value)"
        />
      </template>
      <template v-else>
        <!-- Dropdown populated for known manufacturer (REQ-UI-001) -->
        <select
          id="model-input"
          :value="model"
          :disabled="!manufacturer"
          @change="onModelChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">-- Select Model --</option>
          <option v-for="entry in availableModels" :key="entry.model" :value="entry.model">
            {{ entry.model }}
          </option>
        </select>
      </template>
    </div>

    <!-- ICAO type designator — auto-filled or manual (REQ-UI-003, REQ-UI-004) -->
    <div class="field-group">
      <label for="icao-designator-input">ICAO Type Designator</label>
      <input
        id="icao-designator-input"
        type="text"
        :value="icaoTypeDesignator"
        placeholder="e.g. C172"
        maxlength="4"
        @input="onIcaoInput(($event.target as HTMLInputElement).value)"
      />
      <!-- Bidirectional lookup results (REQ-UI-004) -->
      <ul v-if="icaoLookupResults.length > 0" class="icao-lookup-results" role="listbox">
        <li
          v-for="entry in icaoLookupResults"
          :key="`${entry.manufacturer}-${entry.model}`"
          role="option"
          class="icao-lookup-result"
          @click="selectFromLookup(entry)"
        >
          {{ entry.manufacturer }} / {{ entry.model }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AIRCRAFT_MODEL_CATALOGUE,
  getManufacturers,
  getModelsByManufacturer,
  findByIcaoDesignator,
  type AircraftModelEntry,
} from '../data/aircraft-model-catalogue'

// @IMP-AC-VIEW-003@ (FROM: @REQ-UI-001@, @REQ-UI-002@, @REQ-UI-003@, @REQ-UI-004@)

interface Props {
  manufacturer?: string
  model?: string
  icaoTypeDesignator?: string
}

interface Emits {
  (e: 'update:manufacturer', value: string): void
  (e: 'update:model', value: string): void
  (e: 'update:icaoTypeDesignator', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  manufacturer: '',
  model: '',
  icaoTypeDesignator: '',
})
const emit = defineEmits<Emits>()

// ─── Computed state ───────────────────────────────────────────────────────────

const manufacturers = computed(() => getManufacturers())
const availableModels = computed(() => getModelsByManufacturer(props.manufacturer))
const isOtherManufacturer = computed(() => props.manufacturer === 'Other')

const icaoLookupResults = ref<AircraftModelEntry[]>([])

// ─── Handlers ────────────────────────────────────────────────────────────────

function onManufacturerChange(value: string): void {
  emit('update:manufacturer', value)
  emit('update:model', '')
  emit('update:icaoTypeDesignator', '')
  icaoLookupResults.value = []
}

function onModelChange(value: string): void {
  emit('update:model', value)
  // Auto-fill ICAO type designator from catalogue (REQ-UI-003)
  const entry = AIRCRAFT_MODEL_CATALOGUE.find(
    (e) => e.manufacturer === props.manufacturer && e.model === value,
  )
  if (entry) {
    emit('update:icaoTypeDesignator', entry.icaoTypeDesignator)
    icaoLookupResults.value = []
  }
}

function onModelInput(value: string): void {
  emit('update:model', value)
}

function onIcaoInput(value: string): void {
  const normalized = value.trim().toUpperCase()
  emit('update:icaoTypeDesignator', normalized)

  // Bidirectional lookup: populate suggestion list (REQ-UI-004)
  if (normalized.length >= 2) {
    icaoLookupResults.value = findByIcaoDesignator(normalized)
  } else {
    icaoLookupResults.value = []
  }
}

function selectFromLookup(entry: AircraftModelEntry): void {
  emit('update:manufacturer', entry.manufacturer)
  emit('update:model', entry.model)
  emit('update:icaoTypeDesignator', entry.icaoTypeDesignator)
  icaoLookupResults.value = []
}

// Clear lookup results when manufacturer/model are set externally
watch(
  () => [props.manufacturer, props.model],
  () => {
    icaoLookupResults.value = []
  },
)
</script>

<style scoped>
.aircraft-model-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-group label {
  font-weight: 600;
  font-size: 0.875rem;
}

.field-group select,
.field-group input[type='text'] {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.icao-lookup-results {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  max-height: 200px;
  overflow-y: auto;
}

.icao-lookup-result {
  padding: 0.5rem;
  cursor: pointer;
}

.icao-lookup-result:hover {
  background: #f0f0f0;
}
</style>
