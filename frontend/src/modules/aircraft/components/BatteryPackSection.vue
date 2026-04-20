<template>
  <!-- @IMP-AC-VIEW-BAT-001@ (FROM: @REQ-AD-020@, @REQ-AD-021@) -->
  <div class="battery-pack-section">
    <p class="section-intro">
      Electric aircraft replace the fuel tank with a battery pack. Enter the nameplate usable
      energy from the POH/AFM together with the reserve floor you plan below. Pack mass is fixed
      at the Basic Empty Mass — it does not migrate during flight, which is why there is no burn
      sequence for electric aircraft.
    </p>

    <div class="field-group">
      <label :for="`${sectionId}-usable-energy`">Usable Energy (kWh)</label>
      <DecimalInput
        :id="`${sectionId}-usable-energy`"
        :model-value="modelValue.usableEnergyKwh"
        :min="0.01"
        placeholder="e.g. 24.8"
        @update:model-value="(v) => patch({ usableEnergyKwh: v ?? 0 })"
      />
      <span class="field-hint">
        Nameplate usable pack capacity at 100% state of charge. Taken from the POH/AFM, after
        deducting manufacturer-defined unusable energy.
      </span>
      <span v-if="usableEnergyError" class="field-error" role="alert">{{ usableEnergyError }}</span>
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-reserve-floor`">Reserve Floor (kWh)</label>
      <DecimalInput
        :id="`${sectionId}-reserve-floor`"
        :model-value="modelValue.reserveFloorKwh"
        :min="0"
        placeholder="e.g. 4.0"
        @update:model-value="(v) => patch({ reserveFloorKwh: v ?? 0 })"
      />
      <span class="field-hint">
        Minimum landing reserve required by POH/AFM. Endurance planning warns when projected
        remaining energy drops below this floor. Must be strictly below usable energy.
      </span>
      <span v-if="reserveFloorError" class="field-error" role="alert">{{ reserveFloorError }}</span>
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-nominal-voltage`">Nominal Voltage (V) <span class="optional">optional</span></label>
      <DecimalInput
        :id="`${sectionId}-nominal-voltage`"
        :model-value="modelValue.nominalVoltage ?? null"
        :allow-null="true"
        :min="0"
        placeholder="e.g. 345"
        @update:model-value="(v) => patch({ nominalVoltage: v ?? undefined })"
      />
      <span class="field-hint">Used for future derating lookups. Informational at v1.</span>
    </div>

    <div class="field-group">
      <label :for="`${sectionId}-chemistry`">Cell Chemistry <span class="optional">optional</span></label>
      <input
        :id="`${sectionId}-chemistry`"
        :value="modelValue.chemistry ?? ''"
        type="text"
        placeholder="e.g. LiFePO4, NMC"
        autocomplete="off"
        @input="onChemistryInput(($event.target as HTMLInputElement).value)"
      />
      <span class="field-hint">Free text — regulatory labelling is still evolving for aviation batteries.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AircraftProfileBatteryPack } from '@/core/adapters/aircraft.schema'
import DecimalInput from '@/shared/components/DecimalInput.vue'

// @IMP-AC-VIEW-BAT-002@ (FROM: @REQ-AD-020@, @REQ-AD-021@)

const props = defineProps<{
  modelValue: AircraftProfileBatteryPack
  sectionId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: AircraftProfileBatteryPack): void
}>()

function patch(changes: Partial<AircraftProfileBatteryPack>): void {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

function onChemistryInput(value: string): void {
  const trimmed = value.trim()
  // `chemistry` is `z.string().min(1).optional()` — an empty string would fail
  // schema parsing, so collapse to undefined instead.
  patch({ chemistry: trimmed === '' ? undefined : value })
}

const usableEnergyError = computed<string>(() => {
  if (!Number.isFinite(props.modelValue.usableEnergyKwh)) return ''
  if (props.modelValue.usableEnergyKwh <= 0) {
    return 'Usable energy must be greater than zero.'
  }
  return ''
})

const reserveFloorError = computed<string>(() => {
  if (!Number.isFinite(props.modelValue.reserveFloorKwh)) return ''
  if (props.modelValue.reserveFloorKwh < 0) {
    return 'Reserve floor cannot be negative.'
  }
  if (
    props.modelValue.usableEnergyKwh > 0 &&
    props.modelValue.reserveFloorKwh >= props.modelValue.usableEnergyKwh
  ) {
    return 'Reserve floor must be strictly below usable energy.'
  }
  return ''
})
</script>

<style scoped>
.battery-pack-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-intro {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
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

.field-group input[type='text'] {
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

.optional {
  font-weight: 400;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
}
</style>
