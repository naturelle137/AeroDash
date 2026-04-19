<template>
  <!-- @IMP-AC-VIEW-011@ (FROM: @REQ-AD-001@, @REQ-AD-007@, @REQ-AD-014@, @REQ-AD-018@, @REQ-AD-019@) -->
  <div class="identity-section">
    <AircraftModelSelector
      :manufacturer="local.manufacturer"
      :model="local.model"
      :icao-type-designator="local.icaoTypeDesignator"
      @update:manufacturer="(v) => patch({ manufacturer: v })"
      @update:model="(v) => patch({ model: v })"
      @update:icao-type-designator="(v) => patch({ icaoTypeDesignator: v })"
    />

    <div class="field-group">
      <label :for="`${sectionId}-registration`">Registration</label>
      <input
        :id="`${sectionId}-registration`"
        :value="local.registration"
        type="text"
        maxlength="7"
        placeholder="D-EBPN"
        autocapitalize="characters"
        autocorrect="off"
        autocomplete="off"
        spellcheck="false"
        @input="patch({ registration: ($event.target as HTMLInputElement).value })"
      />
      <span v-if="registrationError" class="field-error" role="alert">{{ registrationError }}</span>
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-sourceUnit`">POH Mass Unit</label>
      <select
        :id="`${sectionId}-sourceUnit`"
        :value="local.sourceUnit"
        @change="patch({ sourceUnit: ($event.target as HTMLSelectElement).value })"
      >
        <option value="kg">kg (kilograms)</option>
        <option value="lb">lb (pounds)</option>
      </select>
      <span class="field-hint">
        Mass unit used by this aircraft's POH/AFM. Per-station quantities and fuel volume units
        are configured in <strong>Load Stations</strong>.
      </span>
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-refDatumDesc`">Reference Datum — Description</label>
      <input
        :id="`${sectionId}-refDatumDesc`"
        :value="local.referenceDatumDescription"
        type="text"
        placeholder="Leading edge of wing root"
        @input="
          patch({ referenceDatumDescription: ($event.target as HTMLInputElement).value })
        "
      />
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-refDatumLoc`">Reference Datum — Location</label>
      <input
        :id="`${sectionId}-refDatumLoc`"
        :value="local.referenceDatumLocation"
        type="text"
        placeholder="Station 0"
        @input="patch({ referenceDatumLocation: ($event.target as HTMLInputElement).value })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AircraftModelSelector from './AircraftModelSelector.vue'

// @IMP-AC-VIEW-012@ (FROM: @REQ-AD-001@, @REQ-AD-007@, @REQ-AD-014@, @REQ-AD-018@, @REQ-AD-019@)

export interface IdentityFields {
  registration: string
  manufacturer: string
  model: string
  icaoTypeDesignator: string
  sourceUnit: string
  referenceDatumDescription: string
  referenceDatumLocation: string
  /** System-generated in a future cloud sync feature; never exposed as a user input. */
  shareCode: string | null
}

const props = defineProps<{
  modelValue: IdentityFields
  registrationError?: string
  sectionId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: IdentityFields): void
}>()

// Local mirror of modelValue so multiple rapid patch() calls within one event
// handler (e.g. AircraftModelSelector emitting manufacturer + model + icao
// back-to-back, or the ICAO unique-match auto-fill path) all mutate one source
// of truth. Reading from props.modelValue directly causes later patches in the
// same synchronous batch to see stale state and clobber earlier changes —
// manifested on iOS Safari as "manufacturer tap doesn't stick" and "ICAO
// typing reverts the 4th character".
const local = ref<IdentityFields>({ ...props.modelValue })

watch(
  () => props.modelValue,
  (next) => {
    if (!isSameIdentity(next, local.value)) {
      local.value = { ...next }
    }
  },
  { deep: true },
)

function isSameIdentity(a: IdentityFields, b: IdentityFields): boolean {
  return (
    a.registration === b.registration &&
    a.manufacturer === b.manufacturer &&
    a.model === b.model &&
    a.icaoTypeDesignator === b.icaoTypeDesignator &&
    a.sourceUnit === b.sourceUnit &&
    a.referenceDatumDescription === b.referenceDatumDescription &&
    a.referenceDatumLocation === b.referenceDatumLocation &&
    a.shareCode === b.shareCode
  )
}

function patch(changes: Partial<IdentityFields>): void {
  local.value = { ...local.value, ...changes }
  emit('update:modelValue', local.value)
}
</script>

<style scoped>
.identity-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text, #111827);
}

.field-group input {
  padding: 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #111827);
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
}

.field-error {
  font-size: 0.8125rem;
  color: var(--color-critical, #dc2626);
}

.optional-tag {
  font-weight: 400;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.8125rem;
}
</style>
