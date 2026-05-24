<template>
  <!-- @IMP-AC-VIEW-013@ (FROM: @REQ-AD-004@, @REQ-AD-013@) -->
  <div class="weighing-reports-section">
    <p class="section-intro">
      Each weighing report records the aircraft's Basic Empty Mass (BEM), Empty CG, and its
      effective date. Reports are kept in full history so every M&amp;B calculation can reference
      the record that was valid on the flight date.
    </p>

    <div
      v-for="(report, idx) in modelValue"
      :key="idx"
      class="weighing-report-row"
      :class="{ 'weighing-report-row--invalid': rowErrors[idx] }"
    >
      <div class="field-group">
        <label :for="`${sectionId}-bem-${idx}`">BEM</label>
        <DecimalInput
          :id="`${sectionId}-bem-${idx}`"
          :model-value="report.bem"
          :min="0.001"
          placeholder="e.g. 432.5"
          @update:model-value="(v) => patchRow(idx, { bem: v ?? 0 })"
        />
      </div>
      <div class="field-group">
        <label :for="`${sectionId}-cg-${idx}`">Empty CG</label>
        <DecimalInput
          :id="`${sectionId}-cg-${idx}`"
          :model-value="report.emptyCg"
          placeholder="e.g. 1.882"
          @update:model-value="(v) => patchRow(idx, { emptyCg: v ?? 0 })"
        />
      </div>
      <div class="field-group">
        <label :for="`${sectionId}-wdate-${idx}`">Weighing Date</label>
        <input
          :id="`${sectionId}-wdate-${idx}`"
          :value="report.weighingDate"
          type="date"
          @input="patchRow(idx, { weighingDate: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="field-group">
        <label :for="`${sectionId}-vfrom-${idx}`">Valid From</label>
        <input
          :id="`${sectionId}-vfrom-${idx}`"
          :value="report.validFrom"
          type="date"
          @input="patchRow(idx, { validFrom: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <button
        type="button"
        class="btn-remove-row"
        :disabled="modelValue.length <= 1"
        :title="modelValue.length <= 1 ? 'At least one weighing report is required' : 'Remove'"
        @click="removeRow(idx)"
      >
        ✕
      </button>
    </div>

    <button type="button" class="btn-add-row" @click="addRow">+ Add Weighing Report</button>

    <p v-if="modelValue.length === 0" class="field-error" role="alert">
      At least one weighing report is required.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AircraftProfileWeighingReport } from '@/core/adapters/aircraft.schema'
import DecimalInput from '@/shared/components/DecimalInput.vue'

// @IMP-AC-VIEW-014@ (FROM: @REQ-AD-004@, @REQ-AD-013@)

const props = defineProps<{
  modelValue: AircraftProfileWeighingReport[]
  sectionId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: AircraftProfileWeighingReport[]): void
}>()

const rowErrors = computed(() =>
  props.modelValue.map(
    (r) => !r.weighingDate || !r.validFrom || !Number.isFinite(r.bem) || r.bem <= 0,
  ),
)

function patchRow(idx: number, changes: Partial<AircraftProfileWeighingReport>): void {
  const next = props.modelValue.map((row, i) => (i === idx ? { ...row, ...changes } : row))
  emit('update:modelValue', next)
}

function addRow(): void {
  const today = new Date().toISOString().slice(0, 10)
  const next = [...props.modelValue, { bem: 1, emptyCg: 0, weighingDate: today, validFrom: today }]
  emit('update:modelValue', next)
}

function removeRow(idx: number): void {
  if (props.modelValue.length <= 1) return
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== idx),
  )
}
</script>

<style scoped>
.weighing-reports-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-intro {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.weighing-report-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr auto;
  gap: 0.5rem;
  align-items: end;
  padding: 0.5rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 4px;
  background: var(--color-surface-alt, #f9fafb);
}

.weighing-report-row--invalid {
  border-color: var(--color-critical, #dc2626);
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

.field-group input {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #111827);
}

.btn-remove-row {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-critical, #dc2626);
  cursor: pointer;
}

.btn-remove-row:disabled {
  color: var(--color-text-muted, #9ca3af);
  cursor: not-allowed;
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

.field-error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-critical, #dc2626);
}
</style>
