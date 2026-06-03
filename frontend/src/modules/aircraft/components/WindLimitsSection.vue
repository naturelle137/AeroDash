<template>
  <!-- @IMP-AC-VIEW-035@ (FROM: @REQ-AD-017@) -->
  <div class="wind-limits-section">
    <p class="section-intro">
      Wind limits come from the POH/AFM. A <strong>Demonstrated</strong> value is advisory — the
      highest wind shown during certification flight testing. A <strong>Limit</strong> value is a
      hard POH limitation that should not be exceeded. Until automated wind classification arrives,
      these values are surfaced during flight preparation so you can check the reported wind by hand.
    </p>

    <div v-if="modelValue.length === 0" class="empty-state">
      No wind limits yet. Add the demonstrated crosswind from the POH so it can be checked against
      the reported wind during flight preparation.
    </div>

    <div v-for="(wl, idx) in modelValue" :key="idx" class="wind-limit-row">
      <div class="field-group">
        <label :for="`${sectionId}-component-${idx}`">Component</label>
        <select
          :id="`${sectionId}-component-${idx}`"
          :value="wl.component"
          @change="patchRow(idx, { component: ($event.target as HTMLSelectElement).value as Component })"
        >
          <option v-for="opt in COMPONENT_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="field-group">
        <label :for="`${sectionId}-value-${idx}`">Value (kt)</label>
        <DecimalInput
          :id="`${sectionId}-value-${idx}`"
          :model-value="wl.value"
          :min="0"
          placeholder="e.g. 15"
          @update:model-value="(v) => patchRow(idx, { value: v ?? 0 })"
        />
      </div>

      <div class="field-group">
        <label :for="`${sectionId}-classification-${idx}`">Classification</label>
        <select
          :id="`${sectionId}-classification-${idx}`"
          :value="wl.classification"
          @change="patchRow(idx, { classification: ($event.target as HTMLSelectElement).value as Classification })"
        >
          <option value="Demonstrated">Demonstrated (advisory)</option>
          <option value="Limit">Limit (hard)</option>
        </select>
      </div>

      <button
        type="button"
        class="btn-remove-row"
        title="Remove wind limit"
        @click="removeRow(idx)"
      >
        ✕
      </button>
    </div>

    <span v-if="hasDuplicateComponent" class="field-error" role="alert">
      Each wind component should appear at most once — remove the duplicate so the limit is
      unambiguous.
    </span>

    <button type="button" class="btn-add-row" @click="addRow">+ Add Wind Limit</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AircraftProfileWindLimit } from '@/core/adapters/aircraft.schema'
import DecimalInput from '@/shared/components/DecimalInput.vue'

// @IMP-AC-VIEW-036@ (FROM: @REQ-AD-017@)

type Component = AircraftProfileWindLimit['component']
type Classification = AircraftProfileWindLimit['classification']

const COMPONENT_OPTIONS: readonly { value: Component; label: string }[] = [
  { value: 'MaxCrosswind', label: 'Crosswind' },
  { value: 'MaxTailwind', label: 'Tailwind' },
  { value: 'MaxTotalWind', label: 'Total wind' },
  { value: 'MaxGust', label: 'Gust' },
] as const

const props = defineProps<{
  modelValue: AircraftProfileWindLimit[]
  sectionId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: AircraftProfileWindLimit[]): void
}>()

const hasDuplicateComponent = computed<boolean>(() => {
  const seen = new Set<Component>()
  for (const wl of props.modelValue) {
    if (seen.has(wl.component)) return true
    seen.add(wl.component)
  }
  return false
})

function patchRow(idx: number, changes: Partial<AircraftProfileWindLimit>): void {
  const next = props.modelValue.map((row, i) => (i === idx ? { ...row, ...changes } : row))
  emit('update:modelValue', next)
}

function addRow(): void {
  // Crosswind is the value almost every GA POH publishes, so seed it as the
  // default component to minimise pilot input for the common case.
  const next: AircraftProfileWindLimit = {
    component: 'MaxCrosswind',
    value: 0,
    classification: 'Demonstrated',
  }
  emit('update:modelValue', [...props.modelValue, next])
}

function removeRow(idx: number): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== idx),
  )
}
</script>

<style scoped>
.wind-limits-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-intro {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.empty-state {
  padding: 0.75rem;
  border: 1px dashed var(--color-border, #d1d5db);
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.wind-limit-row {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) minmax(90px, 140px) minmax(160px, 1fr) auto;
  gap: 0.5rem;
  align-items: end;
  padding: 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-surface-alt, #f9fafb);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text, #111827);
}

.field-group select {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #111827);
  font-size: 0.875rem;
}

.field-error {
  font-size: 0.8125rem;
  color: var(--color-critical, #dc2626);
}

.btn-remove-row {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-critical, #dc2626);
  cursor: pointer;
}

.btn-add-row {
  align-self: flex-start;
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--color-border, #d1d5db);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text, #111827);
  cursor: pointer;
}
</style>
