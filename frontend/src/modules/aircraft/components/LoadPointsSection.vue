<template>
  <!-- @IMP-AC-VIEW-017@ (FROM: @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-005@, @REQ-AD-011@, @REQ-AD-012@) -->
  <div class="load-points-section">
    <p class="section-intro">
      Load stations describe every place mass can be applied in the aircraft — seats, baggage
      areas, and fuel tanks. Each station has an arm (distance from the reference datum) and a
      unit. Fuel tanks carry additional metadata (unusable fuel, permissible fuel types, burn
      sequences) used by mass &amp; balance and fuel planning.
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

      <!-- Per-station category restriction — only meaningful when the aircraft
           is certified in more than one category (e.g. Normal + Utility), since
           payload/seat/tank availability can differ between categories. -->
      <div
        v-if="availableCategories.length > 1"
        class="field-group category-restriction"
      >
        <span class="fuel-types-label">Allowed in Categories</span>
        <div class="fuel-types-checkboxes">
          <label
            v-for="cat in availableCategories"
            :key="cat"
            class="checkbox-inline"
          >
            <input
              type="checkbox"
              :checked="isCategoryChecked(lp, cat)"
              @change="
                toggleCategory(idx, cat, ($event.target as HTMLInputElement).checked)
              "
            />
            <span>{{ cat }}</span>
          </label>
        </div>
        <span
          v-if="isCategoryRestrictionEmpty(lp)"
          class="field-error"
          role="alert"
        >
          Select at least one category, or leave all checked for unrestricted use.
        </span>
        <span v-else class="field-hint">
          Uncheck categories in which this station is not certified (e.g. rear seats in
          Aerobatic). Leaving all checked means the station is available in every category.
        </span>
      </div>

      <div v-if="!isElectric || lp.fuelTank" class="row-footer">
        <label v-if="!isElectric" class="toggle">
          <input
            type="checkbox"
            :checked="!!lp.fuelTank"
            @change="toggleFuelTank(idx, ($event.target as HTMLInputElement).checked)"
          />
          <span>This station is a fuel tank</span>
        </label>

        <div v-if="lp.fuelTank" class="fuel-tank-fields">
          <div class="fuel-tank-grid">
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

          <!-- Burn sequence editor. A tank may belong to multiple sequences
               (e.g. "Standard" and "Alternative") with a different ordinal
               position in each. Mass & balance uses these to compute CG
               waypoints as fuel drains. -->
          <div class="burn-seq-block">
            <div class="burn-seq-header">
              <span class="fuel-types-label">Burn Sequences</span>
              <button
                type="button"
                class="btn-add-seq"
                @click="addBurnSequence(idx)"
              >
                + Add Sequence Entry
              </button>
            </div>
            <p class="field-hint burn-seq-intro">
              Assign this tank a position in one or more drain orders. Position 1 drains
              first. Leave empty for tanks with no explicit order (treated as single-tank burn).
            </p>

            <div v-if="lp.fuelTank.burnSequences.length === 0" class="burn-seq-empty">
              No burn sequence entries yet.
            </div>

            <div
              v-for="(bs, bsIdx) in lp.fuelTank.burnSequences"
              :key="bsIdx"
              class="burn-seq-row"
            >
              <div class="field-group burn-seq-name">
                <label :for="`${sectionId}-bs-name-${idx}-${bsIdx}`">Sequence Name</label>
                <input
                  :id="`${sectionId}-bs-name-${idx}-${bsIdx}`"
                  type="text"
                  placeholder="e.g. Standard"
                  :value="bs.sequenceName"
                  @input="
                    patchBurnSequence(idx, bsIdx, {
                      sequenceName: ($event.target as HTMLInputElement).value,
                    })
                  "
                />
              </div>
              <div class="field-group burn-seq-ord">
                <label :for="`${sectionId}-bs-ord-${idx}-${bsIdx}`">Position</label>
                <DecimalInput
                  :id="`${sectionId}-bs-ord-${idx}-${bsIdx}`"
                  :model-value="bs.ordinalPosition"
                  :min="1"
                  @update:model-value="
                    (v) => patchBurnSequence(idx, bsIdx, { ordinalPosition: toOrdinal(v) })
                  "
                />
              </div>
              <button
                type="button"
                class="btn-remove-row btn-remove-seq"
                title="Remove sequence entry"
                @click="removeBurnSequence(idx, bsIdx)"
              >
                ✕
              </button>
            </div>

            <span
              v-if="hasDuplicateSequenceNames(lp.fuelTank.burnSequences)"
              class="field-error"
              role="alert"
            >
              A tank cannot appear twice in the same sequence — sequence names must be unique
              within a tank.
            </span>
            <span
              v-if="hasInvalidOrdinal(lp.fuelTank.burnSequences)"
              class="field-error"
              role="alert"
            >
              Position must be a positive integer (1, 2, 3…).
            </span>
            <span
              v-if="hasBlankSequenceName(lp.fuelTank.burnSequences)"
              class="field-error"
              role="alert"
            >
              Sequence name cannot be empty.
            </span>
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add-row" @click="addRow">+ Add Load Station</button>
    <button
      v-if="!isElectric"
      type="button"
      class="btn-add-row btn-add-fuel"
      @click="addFuelTank"
    >
      + Add Fuel Tank
    </button>
    <p v-else class="section-intro section-intro--electric">
      This aircraft is battery-electric — fuel tanks are not available. Battery pack capacity is
      managed in the dedicated Battery Pack section.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  AircraftProfileFuelTankExtension,
  AircraftProfileLoadPoint,
} from '@/core/adapters/aircraft.schema'
import DecimalInput from '@/shared/components/DecimalInput.vue'

// @IMP-AC-VIEW-018@ (FROM: @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-005@, @REQ-AD-011@, @REQ-AD-012@)

type FuelType = AircraftProfileFuelTankExtension['permissibleFuelTypes'][number]
type Category = NonNullable<AircraftProfileLoadPoint['allowableCategories']>[number]
type BurnSequenceEntry = AircraftProfileFuelTankExtension['burnSequences'][number]

const FUEL_TYPES: readonly FuelType[] = [
  'MoGas',
  'AvGas 100LL',
  'AvGas UL91',
  'Jet A-1',
  'Diesel',
] as const

const props = withDefaults(
  defineProps<{
    modelValue: AircraftProfileLoadPoint[]
    sectionId: string
    availableCategories?: readonly Category[]
    /**
     * Controls whether fuel-tank UI (toggle + "+ Add Fuel Tank" button + the
     * per-row unusable/permissible/burn-sequence fields) is visible. Defaults
     * to `'combustion'` so existing callers that do not pass the prop retain
     * the full fuel editor. For `'electric'` airframes the fuel editor is
     * suppressed entirely — see @REQ-AD-020@ and ADR-009. The schema's
     * `ELECTRIC_AIRCRAFT_HAS_FUEL_TANK` guard backstops the UI omission.
     */
    powertrain?: 'combustion' | 'electric'
  }>(),
  {
    availableCategories: () => [],
    powertrain: 'combustion',
  },
)

const isElectric = computed(() => props.powertrain === 'electric')

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

// ─── Per-station category restriction ────────────────────────────────────────

function isCategoryChecked(lp: AircraftProfileLoadPoint, cat: Category): boolean {
  // null = unrestricted (available in every category) → every box ticked.
  return lp.allowableCategories === null || lp.allowableCategories.includes(cat)
}

function isCategoryRestrictionEmpty(lp: AircraftProfileLoadPoint): boolean {
  return Array.isArray(lp.allowableCategories) && lp.allowableCategories.length === 0
}

function toggleCategory(idx: number, cat: Category, checked: boolean): void {
  const row = props.modelValue[idx]
  if (!row) return
  // Start from the intersection of the current restriction with the currently
  // available categories — this silently drops stale entries (e.g. a category
  // that was removed from the aircraft after this station was configured).
  const baseline: Category[] =
    row.allowableCategories === null
      ? [...props.availableCategories]
      : row.allowableCategories.filter((c): c is Category =>
          (props.availableCategories as readonly Category[]).includes(c),
        )

  const asSet = new Set<Category>(baseline)
  if (checked) asSet.add(cat)
  else asSet.delete(cat)

  const next: Category[] = (props.availableCategories as readonly Category[]).filter(
    (c) => asSet.has(c),
  )

  // If every currently-available category is ticked, collapse back to `null`
  // (unrestricted) — storing the explicit list would lock the station to the
  // *current* category set, so a later category added to the aircraft would
  // not include this station automatically.
  const allTicked =
    next.length === props.availableCategories.length && props.availableCategories.length > 0
  patchRow(idx, { allowableCategories: allTicked ? null : next })
}

// ─── Burn sequence editor ────────────────────────────────────────────────────

function toOrdinal(v: number | null): number {
  if (v === null || !Number.isFinite(v)) return 1
  return Math.max(1, Math.trunc(v))
}

function patchBurnSequence(
  idx: number,
  bsIdx: number,
  changes: Partial<BurnSequenceEntry>,
): void {
  const row = props.modelValue[idx]
  if (!row || !row.fuelTank) return
  const nextSeq = row.fuelTank.burnSequences.map((bs, i) =>
    i === bsIdx ? { ...bs, ...changes } : bs,
  )
  patchFuelTank(idx, { burnSequences: nextSeq })
}

function addBurnSequence(idx: number): void {
  const row = props.modelValue[idx]
  if (!row || !row.fuelTank) return
  // Seed ordinal position as (highest existing + 1) so the new entry lands at
  // the end of the sequence by default — the most common pilot intent when
  // adding a subsequent tank to an existing drain order.
  const maxOrd = row.fuelTank.burnSequences.reduce(
    (max, bs) => (bs.ordinalPosition > max ? bs.ordinalPosition : max),
    0,
  )
  const next: BurnSequenceEntry = {
    sequenceName: row.fuelTank.burnSequences[0]?.sequenceName ?? 'Standard',
    ordinalPosition: maxOrd + 1,
  }
  patchFuelTank(idx, { burnSequences: [...row.fuelTank.burnSequences, next] })
}

function removeBurnSequence(idx: number, bsIdx: number): void {
  const row = props.modelValue[idx]
  if (!row || !row.fuelTank) return
  patchFuelTank(idx, {
    burnSequences: row.fuelTank.burnSequences.filter((_, i) => i !== bsIdx),
  })
}

function hasDuplicateSequenceNames(entries: readonly BurnSequenceEntry[]): boolean {
  const seen = new Set<string>()
  for (const e of entries) {
    const key = e.sequenceName.trim().toLowerCase()
    if (key === '') continue
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function hasInvalidOrdinal(entries: readonly BurnSequenceEntry[]): boolean {
  return entries.some(
    (e) => !Number.isFinite(e.ordinalPosition) || e.ordinalPosition < 1 || !Number.isInteger(e.ordinalPosition),
  )
}

function hasBlankSequenceName(entries: readonly BurnSequenceEntry[]): boolean {
  return entries.some((e) => e.sequenceName.trim() === '')
}

// ─── Row lifecycle ───────────────────────────────────────────────────────────

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

.section-intro--electric {
  padding: 0.625rem 0.75rem;
  border: 1px dashed var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface-alt, #f9fafb);
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
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
}

.fuel-tank-grid {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 2fr;
  gap: 0.75rem;
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

.category-restriction {
  padding: 0.5rem 0.625rem;
  border: 1px dashed var(--color-border, #e5e7eb);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
}

.burn-seq-block {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border: 1px dashed var(--color-border, #e5e7eb);
  border-radius: 4px;
  background: var(--color-surface-alt, #f9fafb);
}

.burn-seq-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.burn-seq-intro {
  margin: 0;
}

.burn-seq-empty {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #6b7280);
  font-style: italic;
}

.burn-seq-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(90px, 120px) auto;
  gap: 0.5rem;
  align-items: end;
}

.burn-seq-name input,
.burn-seq-ord input {
  width: 100%;
}

.btn-remove-seq {
  align-self: center;
}

.btn-add-seq {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-primary, #3b82f6);
  font-size: 0.75rem;
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
