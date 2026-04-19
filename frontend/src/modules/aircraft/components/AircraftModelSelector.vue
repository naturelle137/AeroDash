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
          <option v-for="entry in availableModels" :key="entry.id" :value="entry.model">
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
        autocapitalize="characters"
        autocorrect="off"
        autocomplete="off"
        spellcheck="false"
        @input="onIcaoInput(($event.target as HTMLInputElement).value)"
      />
      <!-- Bidirectional lookup results (REQ-UI-004) -->
      <ul v-if="icaoLookupResults.length > 0" class="icao-lookup-results" role="listbox">
        <li
          v-for="entry in icaoLookupResults"
          :key="entry.id"
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
  findUniqueByIcaoDesignator,
  type AircraftModelEntry,
  type CataloguePowertrainHint,
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
  /**
   * Emitted when the resolved catalogue entry exposes a powertrain hint
   * (e.g. Pipistrel Velis Electro → `'electric'`). The wizard listens for
   * this to flip the powertrain selector without forcing the pilot to
   * re-confirm the choice. Hint is `undefined` when no opinion is available
   * (Other manufacturer, free-text model, legacy entries).
   */
  (e: 'powertrain-hint', value: CataloguePowertrainHint | undefined): void
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
  // Manufacturer change clears any previously-resolved powertrain hint —
  // the wizard should fall back to its own state until a model is picked.
  emit('powertrain-hint', undefined)
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
    emit('powertrain-hint', entry.powertrain)
    icaoLookupResults.value = []
  } else {
    emit('powertrain-hint', undefined)
  }
}

function onModelInput(value: string): void {
  emit('update:model', value)
  // Free-text manufacturer (Other) — no catalogue hint applies.
  emit('powertrain-hint', undefined)
}

function onIcaoInput(value: string): void {
  const normalized = value.trim().toUpperCase()
  emit('update:icaoTypeDesignator', normalized)

  // Full designator with a single catalogue match: auto-fill hierarchy (REQ-UI-003, REQ-UI-004)
  const unique = findUniqueByIcaoDesignator(normalized)
  if (unique) {
    emit('update:manufacturer', unique.manufacturer)
    emit('update:model', unique.model)
    emit('powertrain-hint', unique.powertrain)
    icaoLookupResults.value = []
    return
  }

  // Partial or ambiguous: suggestion list (REQ-UI-004)
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
  emit('powertrain-hint', entry.powertrain)
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
  color: var(--color-text-primary, #212121);
}

.field-group select,
.field-group input[type='text'] {
  padding: 0.5rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--color-surface, #ffffff);
  color: var(--color-text-primary, #212121);
}

.field-group input[type='text']::placeholder {
  color: var(--color-text-secondary, #9ca3af);
}

.icao-lookup-results {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
  background: var(--color-surface-raised, #ffffff);
  color: var(--color-text-primary, #212121);
  max-height: 200px;
  overflow-y: auto;
}

.icao-lookup-result {
  padding: 0.5rem;
  cursor: pointer;
}

.icao-lookup-result:hover {
  background: var(--color-surface-hover, #f0f0f0);
}
</style>
