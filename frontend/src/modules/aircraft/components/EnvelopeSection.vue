<!-- @IMP-AC-VIEW-ENVELOPE-001@ (FROM: @REQ-AD-011@, @REQ-MB-001@) -->
<template>
  <div class="envelope-section">
    <p v-if="modelValue.length === 0" class="field-error" role="alert">
      At least one certification category is required.
    </p>

    <div
      v-for="(cat, catIdx) in modelValue"
      :key="catIdx"
      class="category-card"
    >
      <div class="category-header">
        <h4 class="category-title">Category {{ catIdx + 1 }}</h4>
        <button
          type="button"
          class="btn-remove-cat"
          :disabled="modelValue.length <= 1"
          :title="modelValue.length <= 1 ? 'At least one category is required' : 'Remove category'"
          @click="removeCategory(catIdx)"
        >
          Remove Category
        </button>
      </div>

      <!-- Category select -->
      <div class="field-group">
        <label :for="`${sectionId}-cat-${catIdx}`">Category</label>
        <select
          :id="`${sectionId}-cat-${catIdx}`"
          :value="cat.category"
          @change="patchCategory(catIdx, { category: ($event.target as HTMLSelectElement).value as 'Normal' | 'Utility' | 'Aerobatic' })"
        >
          <option value="Normal">Normal</option>
          <option value="Utility">Utility</option>
          <option value="Aerobatic">Aerobatic</option>
        </select>
      </div>

      <!-- MTOM -->
      <div class="field-group">
        <label :for="`${sectionId}-mtom-${catIdx}`">
          MTOM (Maximum Take-Off Mass) <span class="required-tag">*</span>
        </label>
        <DecimalInput
          :id="`${sectionId}-mtom-${catIdx}`"
          :model-value="cat.mtom"
          :min="0.001"
          placeholder="e.g. 650"
          @update:model-value="(v) => patchCategory(catIdx, { mtom: v ?? 0.001 })"
        />
        <span v-if="cat.mtom <= 0" class="field-error" role="alert">
          MTOM must be greater than 0.
        </span>
      </div>

      <!-- MZFM -->
      <div class="field-group">
        <label :for="`${sectionId}-mzfm-${catIdx}`">
          MZFM (Maximum Zero Fuel Mass) <span class="optional-tag">(optional)</span>
        </label>
        <DecimalInput
          :id="`${sectionId}-mzfm-${catIdx}`"
          :model-value="cat.maxZeroFuelMass"
          :allow-null="true"
          :min="0.001"
          placeholder="optional"
          @update:model-value="(v) => patchCategory(catIdx, { maxZeroFuelMass: v })"
        />
      </div>

      <!-- Graph type -->
      <div class="field-group">
        <span class="field-label">Envelope Graph Type</span>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              :name="`${sectionId}-graphtype-${catIdx}`"
              value="arm"
              :checked="cat.graphType === 'arm'"
              @change="patchCategory(catIdx, { graphType: 'arm' })"
            />
            <span>Arm (CG position)</span>
          </label>
          <label class="radio-label">
            <input
              type="radio"
              :name="`${sectionId}-graphtype-${catIdx}`"
              value="moment"
              :checked="cat.graphType === 'moment'"
              @change="patchCategory(catIdx, { graphType: 'moment' })"
            />
            <span>Moment</span>
          </label>
        </div>
      </div>

      <!-- Envelope points table -->
      <div class="envelope-table-wrap">
        <table class="envelope-table">
          <thead>
            <tr>
              <th>{{ cat.graphType === 'arm' ? 'Arm' : 'Moment' }}</th>
              <th>Mass</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(pt, ptIdx) in cat.envelope"
              :key="ptIdx"
            >
              <td>
                <DecimalInput
                  :id="`${sectionId}-env-arm-${catIdx}-${ptIdx}`"
                  :model-value="pt.armOrMoment"
                  :aria-label="(cat.graphType === 'arm' ? 'Arm' : 'Moment') + ' for point ' + (ptIdx + 1)"
                  placeholder="0.000"
                  @update:model-value="(v) => patchEnvelopePoint(catIdx, ptIdx, { armOrMoment: v ?? 0 })"
                />
              </td>
              <td>
                <DecimalInput
                  :id="`${sectionId}-env-mass-${catIdx}-${ptIdx}`"
                  :model-value="pt.mass"
                  :aria-label="'Mass for point ' + (ptIdx + 1)"
                  placeholder="0"
                  @update:model-value="(v) => patchEnvelopePoint(catIdx, ptIdx, { mass: v ?? 0 })"
                />
              </td>
              <td>
                <button
                  type="button"
                  class="btn-remove-row"
                  :disabled="cat.envelope.length <= 4"
                  :title="cat.envelope.length <= 4 ? 'Minimum 4 points required' : 'Remove point'"
                  @click="removeEnvelopePoint(catIdx, ptIdx)"
                >
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <button
          type="button"
          class="btn-add-row"
          :disabled="cat.envelope.length >= 20"
          @click="addEnvelopePoint(catIdx)"
        >
          + Add Point
        </button>

        <p v-if="cat.envelope.length < 4" class="field-error" role="alert">
          At least 4 points required. Currently: {{ cat.envelope.length }}.
        </p>
        <p v-if="cat.envelope.length >= 20" class="field-hint">
          Maximum 20 envelope points reached.
        </p>

        <p class="field-hint envelope-hint">
          Enter the CG envelope polygon from the POH. Points should be listed in order around the
          boundary.
        </p>
      </div>
    </div>

    <button type="button" class="btn-add-category" @click="addCategory">
      + Add Certification Category
    </button>
  </div>
</template>

<script setup lang="ts">
// @IMP-AC-VIEW-ENVELOPE-002@ (FROM: @REQ-AD-011@, @REQ-MB-001@)
import type { AircraftProfileCertificationCategory } from '@/core/adapters/aircraft.schema'
import DecimalInput from '@/shared/components/DecimalInput.vue'

const props = defineProps<{
  modelValue: AircraftProfileCertificationCategory[]
  sectionId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: AircraftProfileCertificationCategory[]): void
}>()

function patchCategory(
  idx: number,
  changes: Partial<AircraftProfileCertificationCategory>,
): void {
  const next = props.modelValue.map((cat, i) => (i === idx ? { ...cat, ...changes } : cat))
  emit('update:modelValue', next)
}

function patchEnvelopePoint(
  catIdx: number,
  ptIdx: number,
  changes: Partial<{ armOrMoment: number; mass: number }>,
): void {
  const cat = props.modelValue[catIdx]
  if (!cat) return
  const nextEnvelope = cat.envelope.map((pt, i) => (i === ptIdx ? { ...pt, ...changes } : pt))
  patchCategory(catIdx, { envelope: nextEnvelope })
}

function addEnvelopePoint(catIdx: number): void {
  const cat = props.modelValue[catIdx]
  if (!cat || cat.envelope.length >= 20) return
  patchCategory(catIdx, { envelope: [...cat.envelope, { armOrMoment: 0, mass: 0 }] })
}

function removeEnvelopePoint(catIdx: number, ptIdx: number): void {
  const cat = props.modelValue[catIdx]
  if (!cat || cat.envelope.length <= 4) return
  patchCategory(catIdx, { envelope: cat.envelope.filter((_, i) => i !== ptIdx) })
}

function addCategory(): void {
  const newCat: AircraftProfileCertificationCategory = {
    category: 'Normal',
    mtom: 1,
    maxZeroFuelMass: null,
    graphType: 'arm',
    envelope: [
      { armOrMoment: 0, mass: 0 },
      { armOrMoment: 0, mass: 1 },
      { armOrMoment: 1, mass: 1 },
      { armOrMoment: 1, mass: 0 },
    ],
  }
  emit('update:modelValue', [...props.modelValue, newCat])
}

function removeCategory(idx: number): void {
  if (props.modelValue.length <= 1) return
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== idx),
  )
}
</script>

<style scoped>
.envelope-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-surface-alt, #f9fafb);
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.category-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text, #111827);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-group label,
.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text, #111827);
}

.field-group input,
.field-group select {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #111827);
  font-size: 0.9375rem;
}

.required-tag {
  color: var(--color-critical, #dc2626);
}

.optional-tag {
  font-weight: 400;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.8125rem;
}

.radio-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.radio-label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-text, #111827);
  cursor: pointer;
}

.envelope-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.envelope-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.envelope-table th,
.envelope-table td {
  padding: 0.375rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.envelope-table th {
  font-weight: 600;
  color: var(--color-text, #111827);
  background: var(--color-surface, #ffffff);
}

.envelope-table td input {
  width: 100%;
  padding: 0.25rem 0.375rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 3px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #111827);
  font-size: 0.875rem;
}

.btn-remove-row {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 3px;
  background: var(--color-surface, #ffffff);
  color: var(--color-critical, #dc2626);
  cursor: pointer;
  font-size: 0.75rem;
}

.btn-remove-row:disabled {
  color: var(--color-text-muted, #9ca3af);
  cursor: not-allowed;
}

.btn-add-row {
  align-self: flex-start;
  padding: 0.375rem 0.75rem;
  border: 1px dashed var(--color-border, #d1d5db);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text, #111827);
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-add-row:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-add-category {
  align-self: flex-start;
  padding: 0.5rem 0.875rem;
  border: 1px dashed var(--color-primary, #3b82f6);
  border-radius: 4px;
  background: transparent;
  color: var(--color-primary, #3b82f6);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-remove-cat {
  padding: 0.25rem 0.625rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-critical, #dc2626);
  cursor: pointer;
  font-size: 0.8125rem;
}

.btn-remove-cat:disabled {
  color: var(--color-text-muted, #9ca3af);
  cursor: not-allowed;
}

.field-error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-critical, #dc2626);
}

.field-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
}

.envelope-hint {
  padding-top: 0.25rem;
  border-top: 1px dashed var(--color-border, #e5e7eb);
}
</style>
