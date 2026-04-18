<template>
  <!-- @IMP-AC-VIEW-011@ (FROM: @REQ-AD-001@, @REQ-AD-007@, @REQ-AD-014@, @REQ-AD-018@, @REQ-AD-019@) -->
  <div class="identity-section">
    <AircraftModelSelector
      :manufacturer="modelValue.manufacturer"
      :model="modelValue.model"
      :icao-type-designator="modelValue.icaoTypeDesignator"
      @update:manufacturer="(v) => patch({ manufacturer: v })"
      @update:model="(v) => patch({ model: v })"
      @update:icao-type-designator="(v) => patch({ icaoTypeDesignator: v })"
    />

    <div class="field-group">
      <label :for="`${sectionId}-registration`">Registration (REQ-AD-001)</label>
      <input
        :id="`${sectionId}-registration`"
        :value="modelValue.registration"
        type="text"
        maxlength="7"
        placeholder="D-EBPN"
        @input="patch({ registration: ($event.target as HTMLInputElement).value })"
      />
      <span v-if="registrationError" class="field-error" role="alert">{{ registrationError }}</span>
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-ownerId`">Owner ID (REQ-AD-019)</label>
      <input
        :id="`${sectionId}-ownerId`"
        :value="modelValue.ownerId"
        type="text"
        placeholder="user-123"
        @input="patch({ ownerId: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-sourceUnit`">POH Source Unit (REQ-AD-014)</label>
      <input
        :id="`${sectionId}-sourceUnit`"
        :value="modelValue.sourceUnit"
        type="text"
        placeholder="kg"
        @input="patch({ sourceUnit: ($event.target as HTMLInputElement).value })"
      />
      <span class="field-hint">The unit system from the manufacturer's POH/AFM (e.g. kg, lb).</span>
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-refDatumDesc`">Reference Datum Description (REQ-AD-007)</label>
      <input
        :id="`${sectionId}-refDatumDesc`"
        :value="modelValue.referenceDatumDescription"
        type="text"
        placeholder="Leading edge of wing root"
        @input="
          patch({ referenceDatumDescription: ($event.target as HTMLInputElement).value })
        "
      />
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-refDatumLoc`">Reference Datum Location (REQ-AD-007)</label>
      <input
        :id="`${sectionId}-refDatumLoc`"
        :value="modelValue.referenceDatumLocation"
        type="text"
        placeholder="Station 0"
        @input="patch({ referenceDatumLocation: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-shareCode`">Share Code (REQ-AD-018, optional)</label>
      <input
        :id="`${sectionId}-shareCode`"
        :value="modelValue.shareCode ?? ''"
        type="text"
        placeholder="e.g. ABC-123"
        @input="onShareCodeInput(($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import AircraftModelSelector from './AircraftModelSelector.vue'

// @IMP-AC-VIEW-012@ (FROM: @REQ-AD-001@, @REQ-AD-007@, @REQ-AD-014@, @REQ-AD-018@, @REQ-AD-019@)

export interface IdentityFields {
  registration: string
  manufacturer: string
  model: string
  icaoTypeDesignator: string
  ownerId: string
  sourceUnit: string
  referenceDatumDescription: string
  referenceDatumLocation: string
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

function patch(changes: Partial<IdentityFields>): void {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function onShareCodeInput(raw: string): void {
  const trimmed = raw.trim()
  patch({ shareCode: trimmed === '' ? null : trimmed })
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
</style>
