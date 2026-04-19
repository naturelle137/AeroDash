<template>
  <!-- @IMP-AC-VIEW-017@ (FROM: @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-005@, @REQ-AD-011@, @REQ-AD-012@) -->
  <div class="load-points-section">
    <p class="section-intro">
      Load stations describe every place mass can be applied in the aircraft — seats, baggage
      areas, and fuel tanks. Each station has an arm (distance from the reference datum) and a
      unit. Fuel tanks carry additional metadata (unusable fuel, permissible fuel types) used by
      mass &amp; balance and fuel planning.
    </p>

    <div v-if="modelValue.length === 0" class="empty-state">
      No load stations yet. Add seats, baggage areas and fuel tanks so this aircraft can be
      used for mass &amp; balance.
    </div>

    <div
      v-for="(lp, idx) in modelValue"
      :key="idx"
      class="load-point-row"
      :class="{ 'load-point-row--fuel': !!lp.fuelTank }"
    >
      <div class="row-header">
        <div class="field-group field-name">
          <label :for="`${sectionId}-name-${idx}`">Station Name</label>
          <input
            :id="`${sectionId}-name-${idx}`"
            :value="lp.name"
            type="text"
            placeholder="e.g. Pilot, Front Baggage, Fuel Tank"
            @input="patchRow(idx, { name: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <button
          type="button"
          class="btn-remove-row"
          title="Remove station"
          @click="removeRow(idx)"
        >
          ✕
        </button>
      </div>

      <div class="row-grid">
        <div class="field-group">
          <label :for="`${sectionId}-arm-${idx}`">Arm</label>
          <DecimalInput
            :id="`${sectionId}-arm-${idx}`"
            :model-value="lp.arm"
            :allow-null="true"
            :disabled="lp.armLookup.length > 0"
            :placeholder="lp.armLookup.length > 0 ? 'Uses arm table' : '1.900'"
            @update:model-value="(v) => patchRow(idx, { arm: v })"
          />
          <span v-if="lp.armLookup.length > 0" class="field-hint">
            This station uses a variable-arm lookup table ({{ lp.armLookup.length }} rows).
          </span>
        </div>

        <div class="field-group">
          <label :for="`${sectionId}-limit-${idx}`">Operational Limit</label>
          <DecimalInput
            :id="`${sectionId}-limit-${idx}`"
            :model-value="lp.operationalLimit"
            :allow-null="true"
            :min="0"
            placeholder="optional"
            @update:model-value="(v) => patchRow(idx, { operationalLimit: v })"
          />
          <span class="field-hint">Maximum quantity allowed at this station.</span>
        </div>

        <div class="field-group">
          <label :for="`${sectionId}-qty-${idx}`">Default Quantity</label>
          <DecimalInput
            :id="`${sectionId}-qty-${idx}`"
            :model-value="lp.defaultQuantity"
            :min="0"
            @update:model-value="(v) => patchRow(idx, { defaultQuantity: v ?? 0 })"
          />
          <span
            v-if="willPromoteToUnusable(lp)"
            class="field-hint field-hint--info"
            role="note"
          >
            Will save as {{ lp.fuelTank!.unusableFuel }} {{ lp.unit }} — a fuel tank cannot
            default below its unusable fuel.
          </span>
        </div>

        <div class="field-group">
          <label :for="`${sectionId}-unit-${idx}`">Unit</label>
          <select
            :id="`${sectionId}-unit-${idx}`"
            :value="lp.unit"
            @change="patchRow(idx, { unit: ($event.target as HTMLSelectElement).value })"
          >
            <optgroup label="Mass">
              <option value="kg">kg (kilograms)</option>
              <option value="lb">lb (pounds)</option>
            </optgroup>
            <optgroup label="Volume (fuel)">
              <option value="L">L (litres)</option>
              <option value="USG">USG (US gallons)</option>
              <option value="IMPgal">IMP gal (imperial gallons)</option>
            </optgroup>
          </select>
        </div>
      </div>

      <div class="row-footer">
        <label class="toggle">
          <input
            type="checkbox"
            :checked="!!lp.fuelTank"
            @change="toggleFuelTank(idx, ($event.target as HTMLInputElement).checked)"
          />
          <span>This station is a fuel tank</span>
        </label>

        <div v-if="lp.fuelTank" class="fuel-tank-fields">
          <div class="field-group">
            <label :for="`${sectionId}-unusable-${idx}`">Unusable Fuel</label>
            <DecimalInput
              :id="`${sectionId}-unusable-${idx}`"
              :model-value="lp.fuelTank.unusableFuel"
              :min="0"
              @update:model-value="(v) => patchFuelTank(idx, { unusableFuel: v ?? 0 })"
            />
            <span class="field-hint">Quantity (in this station's unit) that cannot be burned.</span>
          </div>

          <div class="field-group">
            <span class="fuel-types-label">Permissible Fuel Types</span>
            <div class="fuel-types-checkboxes">
              <label v-for="type in FUEL_TYPES" :key="type" class="checkbox-inline">
                <input
                  type="checkbox"
                  :checked="lp.fuelTank.permissibleFuelTypes.includes(type)"
                  @change="
                    toggleFuelType(idx, type, ($event.target as HTMLInputElement).checked)
                  "
                />
                <span>{{ type }}</span>
              </label>
            </div>
            <span
              v-if="lp.fuelTank.permissibleFuelTypes.length === 0"
              class="field-error"
              role="alert"
            >
              At least one permissible fuel type is required.
            </span>
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add-row" @click="addRow">+ Add Load Station</button>
    <button type="button" class="btn-add-row btn-add-fuel" @click="addFuelTank">
      + Add Fuel Tank
    </button>
  </div>
</template>

<script setup lang="ts">
import type {
  AircraftProfileFuelTankExtension,
  AircraftProfileLoadPoint,
} from '@/core/adapters/aircraft.schema'
import DecimalInput from '@/shared/components/DecimalInput.vue'

// @IMP-AC-VIEW-018@ (FROM: @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-005@, @REQ-AD-011@, @REQ-AD-012@)

type FuelType = AircraftProfileFuelTankExtension['permissibleFuelTypes'][number]

const FUEL_TYPES: readonly FuelType[] = [
  'MoGas',
  'AvGas 100LL',
  'AvGas UL91',
  'Jet A-1',
  'Diesel',
] as const

const props = defineProps<{
  modelValue: AircraftProfileLoadPoint[]
  sectionId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: AircraftProfileLoadPoint[]): void
}>()

function patchRow(idx: number, changes: Partial<AircraftProfileLoadPoint>): void {
  const next = props.modelValue.map((row, i) => (i === idx ? { ...row, ...changes } : row))
  emit('update:modelValue', next)
}

function patchFuelTank(idx: number, changes: Partial<AircraftProfileFuelTankExtension>): void {
  const row = props.modelValue[idx]
  if (!row || !row.fuelTank) return
  const nextTank: AircraftProfileFuelTankExtension = { ...row.fuelTank, ...changes }
  patchRow(idx, { fuelTank: nextTank })
}

function willPromoteToUnusable(lp: AircraftProfileLoadPoint): boolean {
  return (
    lp.fuelTank !== null &&
    lp.fuelTank.unusableFuel > 0 &&
    lp.defaultQuantity < lp.fuelTank.unusableFuel
  )
}

function toggleFuelTank(idx: number, enabled: boolean): void {
  const row = props.modelValue[idx]
  if (!row) return
  if (enabled) {
    const tank: AircraftProfileFuelTankExtension = row.fuelTank ?? {
      unusableFuel: 0,
      permissibleFuelTypes: ['AvGas 100LL'],
      burnSequences: [],
    }
    patchRow(idx, { fuelTank: tank })
  } else {
    patchRow(idx, { fuelTank: null })
  }
}

function toggleFuelType(idx: number, type: FuelType, checked: boolean): void {
  const row = props.modelValue[idx]
  if (!row || !row.fuelTank) return
  const current = row.fuelTank.permissibleFuelTypes
  const next = checked
    ? Array.from(new Set([...current, type]))
    : current.filter((t) => t !== type)
  patchFuelTank(idx, { permissibleFuelTypes: next })
}

function addRow(): void {
  const next: AircraftProfileLoadPoint = {
    name: '',
    arm: 0,
    armLookup: [],
    operationalLimit: null,
    defaultQuantity: 0,
    unit: 'kg',
    allowableCategories: null,
    fuelTank: null,
  }
  emit('update:modelValue', [...props.modelValue, next])
}

function addFuelTank(): void {
  const next: AircraftProfileLoadPoint = {
    name: 'Fuel Tank',
    arm: 0,
    armLookup: [],
    operationalLimit: null,
    defaultQuantity: 0,
    unit: 'L',
    allowableCategories: null,
    fuelTank: {
      unusableFuel: 0,
      permissibleFuelTypes: ['AvGas 100LL'],
      burnSequences: [],
    },
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
.load-points-section {
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

.load-point-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-surface-alt, #f9fafb);
}

.load-point-row--fuel {
  border-left: 3px solid var(--color-primary, #3b82f6);
}

.row-header {
  display: flex;
  align-items: end;
  gap: 0.5rem;
}

.field-name {
  flex: 1;
}

.row-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem;
}

.row-footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border, #e5e7eb);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-text, #111827);
  cursor: pointer;
}

.fuel-tank-fields {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 2fr;
  gap: 0.75rem;
  padding: 0.5rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
}

.fuel-types-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text, #111827);
}

.fuel-types-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
}

.checkbox-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: var(--color-text, #111827);
  cursor: pointer;
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

.field-group input,
.field-group select {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #111827);
  font-size: 0.875rem;
}

.field-group input:disabled {
  background: var(--color-surface-alt, #f3f4f6);
  color: var(--color-text-muted, #9ca3af);
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
}

.field-hint--info {
  color: var(--color-info, #1d4ed8);
  font-weight: 500;
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

.btn-add-fuel {
  color: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
}
</style>
