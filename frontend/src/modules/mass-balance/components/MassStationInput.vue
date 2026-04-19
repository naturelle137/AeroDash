<script setup lang="ts">
import { computed } from 'vue'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'

const props = defineProps<{
  station: StationInput
  disabled?: boolean
  unit?: string
  /**
   * Unusable fuel for fuel stations, in the same `unit` as the station. For
   * non-fuel stations pass 0 (default). The pilot can never set the loaded
   * quantity below the unusable amount — the tank always carries unusable
   * fuel, so entering less would model a dry tank and contradict the POH.
   */
  unusableFuel?: number
}>()

const emit = defineEmits<{
  'update:weight': [weight: number]
}>()

const minWeight = computed(() => props.unusableFuel ?? 0)
const hasUnusable = computed(() => (props.unusableFuel ?? 0) > 0)

function clamp(value: number): number {
  if (!Number.isFinite(value)) return minWeight.value
  return Math.max(minWeight.value, value)
}

function onInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const parsed = parseFloat(raw)
  if (!Number.isNaN(parsed)) {
    emit('update:weight', clamp(parsed))
  }
}

function increment(): void {
  emit('update:weight', clamp(props.station.weight + 1))
}

function decrement(): void {
  emit('update:weight', clamp(props.station.weight - 1))
}
</script>

<template>
  <!-- @IMP-MB-UI-006@ (FROM: @REQ-UQ-004@) -->
  <div
    class="mass-station-input"
    :class="{
      'mass-station-input--disabled': disabled,
      'mass-station-input--error': station.hasError,
    }"
  >
    <div class="mass-station-input__header">
      <label :for="`station-${station.index}`" class="mass-station-input__label">
        {{ station.name }}
      </label>
      <!-- @IMP-MB-UI-007@ (FROM: @REQ-UQ-005@) -->
      <span v-if="unit" class="mass-station-input__unit" aria-label="unit">{{ unit }}</span>
    </div>

    <div class="mass-station-input__control">
      <button
        type="button"
        class="mass-station-input__stepper"
        :disabled="disabled || station.weight <= minWeight"
        aria-label="Decrease"
        @click="decrement"
      >
        −
      </button>

      <input
        :id="`station-${station.index}`"
        type="number"
        class="mass-station-input__field"
        :value="station.weight"
        :disabled="disabled"
        :aria-invalid="station.hasError || undefined"
        inputmode="decimal"
        :min="minWeight"
        step="1"
        @input="onInput"
      />

      <button
        type="button"
        class="mass-station-input__stepper"
        :disabled="disabled"
        aria-label="Increase"
        @click="increment"
      >
        +
      </button>
    </div>

    <p
      v-if="hasUnusable"
      class="mass-station-input__unusable"
      :aria-label="`Unusable fuel: ${unusableFuel} ${unit ?? ''}`"
    >
      {{ unusableFuel }}{{ unit ? ` ${unit}` : '' }} unusable — minimum load
    </p>
  </div>
</template>

<style scoped>
.mass-station-input {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
}

.mass-station-input__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.mass-station-input--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.mass-station-input--error .mass-station-input__control {
  border-color: var(--color-critical, #f44336);
  box-shadow: 0 0 0 2px var(--color-critical-bg, #ffebee);
}

.mass-station-input--error .mass-station-input__field {
  background: var(--color-critical-bg, #ffebee);
  color: var(--color-critical, #c62828);
}

.mass-station-input--error .mass-station-input__label {
  color: var(--color-critical, #c62828);
}

.mass-station-input__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary, #212121);
}

.mass-station-input__unit {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--color-text-secondary, #666);
  text-transform: none;
}

.mass-station-input__unusable {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--color-text-secondary, #757575);
  font-style: italic;
}

.mass-station-input__control {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 0.25rem;
  overflow: hidden;
}

.mass-station-input__stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  border: none;
  background: var(--color-surface-alt, #f5f5f5);
  color: var(--color-text-primary, #212121);
  font-size: 1.125rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.1s ease;
}

.mass-station-input__stepper:hover:not(:disabled) {
  background: var(--color-surface-hover, #e0e0e0);
}

.mass-station-input__stepper:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mass-station-input__field {
  width: 5rem;
  min-height: 2.75rem;
  border: none;
  border-left: 1px solid var(--color-border, #e0e0e0);
  border-right: 1px solid var(--color-border, #e0e0e0);
  text-align: center;
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
  background: var(--color-surface, #fff);
  color: var(--color-text-primary, #212121);
  -moz-appearance: textfield;
}

.mass-station-input__field:focus {
  outline: 2px solid var(--color-focus, #1976d2);
  outline-offset: -2px;
}

.mass-station-input__field::-webkit-inner-spin-button,
.mass-station-input__field::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* ─── Mobile portrait: stretch the control full width so steppers can't clip ── */
@media (max-width: 600px) {
  .mass-station-input__control {
    width: 100%;
    box-sizing: border-box;
  }

  .mass-station-input__field {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }
}
</style>
