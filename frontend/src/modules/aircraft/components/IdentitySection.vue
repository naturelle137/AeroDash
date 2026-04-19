<template>
  <!-- @IMP-AC-VIEW-011@ (FROM: @REQ-AD-001@, @REQ-AD-007@, @REQ-AD-014@, @REQ-AD-018@, @REQ-AD-019@, @REQ-AD-020@) -->
  <div class="identity-section">
    <AircraftModelSelector
      :manufacturer="local.manufacturer"
      :model="local.model"
      :icao-type-designator="local.icaoTypeDesignator"
      @update:manufacturer="(v) => patch({ manufacturer: v })"
      @update:model="(v) => patch({ model: v })"
      @update:icao-type-designator="(v) => patch({ icaoTypeDesignator: v })"
      @powertrain-hint="onPowertrainHint"
    />

    <!-- @IMP-AC-VIEW-031@ (FROM: @REQ-AD-020@)
         Powertrain choice. Visible at the very top of the wizard so the rest
         of the flow can branch — combustion-only profiles see fuel tanks and
         burn sequences in the Load Stations step, electric profiles see a
         Battery Pack section instead. The choice persists even when the
         catalogue hint disagrees, since the pilot may be entering a custom
         airframe (Other manufacturer) for which no hint exists. -->
    <fieldset class="powertrain-fieldset">
      <legend>Powertrain</legend>
      <p class="field-hint">
        Pick the energy source for this airframe. Combustion shows fuel tanks
        and burn sequences. Electric shows a battery pack instead — there is
        no fuel mass to enter and Mass &amp; Balance does not migrate in flight.
      </p>
      <div class="powertrain-options" role="radiogroup" aria-label="Powertrain">
        <label
          class="powertrain-option"
          :class="{ 'powertrain-option--active': local.powertrain === 'combustion' }"
        >
          <input
            type="radio"
            name="powertrain"
            value="combustion"
            :checked="local.powertrain === 'combustion'"
            @change="patch({ powertrain: 'combustion' })"
          />
          <span class="powertrain-option__title">Combustion</span>
          <span class="powertrain-option__sub">Piston / turbine — fuel tanks &amp; burn sequence</span>
        </label>
        <label
          class="powertrain-option"
          :class="{ 'powertrain-option--active': local.powertrain === 'electric' }"
        >
          <input
            type="radio"
            name="powertrain"
            value="electric"
            :checked="local.powertrain === 'electric'"
            @change="patch({ powertrain: 'electric' })"
          />
          <span class="powertrain-option__title">Electric</span>
          <span class="powertrain-option__sub">Battery pack — energy in kWh, mass fixed at BEM</span>
        </label>
      </div>
    </fieldset>

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
import type { PowertrainType } from '@/core/domain/aircraft.types'
import type { CataloguePowertrainHint } from '../data/aircraft-model-catalogue'

// @IMP-AC-VIEW-012@ (FROM: @REQ-AD-001@, @REQ-AD-007@, @REQ-AD-014@, @REQ-AD-018@, @REQ-AD-019@, @REQ-AD-020@)

export interface IdentityFields {
  registration: string
  manufacturer: string
  model: string
  icaoTypeDesignator: string
  sourceUnit: string
  referenceDatumDescription: string
  referenceDatumLocation: string
  /**
   * Powertrain discriminator. Defaults to `'combustion'` on wizard seed and on
   * legacy profiles (see @REQ-AD-020@ and ADR-009). Pilots may override the
   * catalogue hint — the hint only pre-selects, it never locks.
   */
  powertrain: PowertrainType
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
    a.powertrain === b.powertrain &&
    a.shareCode === b.shareCode
  )
}

function patch(changes: Partial<IdentityFields>): void {
  local.value = { ...local.value, ...changes }
  emit('update:modelValue', local.value)
}

/**
 * AircraftModelSelector surfaces a powertrain hint whenever the pilot picks a
 * catalogue entry that carries one (e.g. Pipistrel Velis Electro → `electric`).
 * We honour the hint by patching the powertrain on the fly — the pilot can
 * still flip the radio afterwards, so the hint is advisory, not a lock.
 * `undefined` means "no opinion" (Other manufacturer, free-text model, legacy
 * entries) and we intentionally leave the current choice untouched.
 */
function onPowertrainHint(hint: CataloguePowertrainHint | undefined): void {
  if (hint === undefined) return
  if (local.value.powertrain === hint) return
  patch({ powertrain: hint })
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

.powertrain-fieldset {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
}

.powertrain-fieldset legend {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text, #111827);
  padding: 0 0.25rem;
}

.powertrain-options {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.powertrain-option {
  flex: 1 1 12rem;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0.25rem 0.5rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  cursor: pointer;
  background: var(--color-surface, #ffffff);
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
}

.powertrain-option:hover {
  border-color: var(--color-primary, #2563eb);
}

.powertrain-option--active {
  border-color: var(--color-primary, #2563eb);
  box-shadow: 0 0 0 1px var(--color-primary, #2563eb);
}

.powertrain-option input[type='radio'] {
  grid-row: 1 / span 2;
  margin: 0;
}

.powertrain-option__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text, #111827);
}

.powertrain-option__sub {
  grid-column: 2;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
}
</style>
