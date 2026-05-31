<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import DecimalInput, { type DecimalRejection } from '@/shared/components/DecimalInput.vue'
import type { StationInput } from '@/modules/mass-balance/stores/mass-balance.types'

/** How long the transient inline rejection hint stays visible (ms). */
const REJECTION_HINT_MS = 2500

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
  /**
   * Maximum capacity of this station, in the same `unit`. For fuel stations
   * this is the operational limit from the profile. When provided AND greater
   * than the minimum, a slider is rendered so pilots can scrub the fuel load.
   * Pass null / undefined for non-fuel stations or tanks without a capacity.
   */
  maxCapacity?: number | null
  /**
   * Coarse increment for the secondary ± buttons (UX-002). Reaching a 75 kg
   * passenger via the fine ±1 control is 75 taps under turbulence; the coarse
   * control gets there in a handful of taps. Defaults to a unit-aware value
   * (10 for lb, 5 otherwise) when omitted.
   */
  coarseStep?: number
  /**
   * Optional preset quantities (in `unit`) rendered as one-tap chips — e.g.
   * standard passenger weights. Omit / empty for stations without presets.
   */
  presets?: readonly number[]
}>()

const emit = defineEmits<{
  'update:weight': [weight: number]
}>()

const minWeight = computed(() => props.unusableFuel ?? 0)
const hasUnusable = computed(() => (props.unusableFuel ?? 0) > 0)
const showSlider = computed(
  () =>
    props.maxCapacity !== null &&
    props.maxCapacity !== undefined &&
    props.maxCapacity > minWeight.value,
)

/** Unit-aware coarse step: pounds tend to want a bigger jump than kilograms. */
const coarseStepValue = computed(() => {
  if (props.coarseStep && props.coarseStep > 0) return props.coarseStep
  return props.unit?.toLowerCase() === 'lb' ? 10 : 5
})

const presetList = computed(() => props.presets ?? [])

/** Finite upper bound for the field — the operational limit when a slider is shown. */
const fieldMax = computed(() =>
  showSlider.value && props.maxCapacity != null ? props.maxCapacity : undefined,
)

function clamp(value: number): number {
  if (!Number.isFinite(value)) return minWeight.value
  const ceiling = showSlider.value && props.maxCapacity != null ? props.maxCapacity : Infinity
  return Math.min(ceiling, Math.max(minWeight.value, value))
}

// ─── Sanitised decimal entry + inline rejection feedback (UX-010 / UX-011) ──
// @IMP-MB-UI-009@ (FROM: @REQ-UQ-001@)
//
// The field is a DecimalInput (type=text + inputmode=decimal + regex sanitiser)
// instead of type=number, so "e"/"+" can no longer slip through and be parsed
// as a magnitude shift ("1e2" → 100). DecimalInput blocks the bad input and
// emits `reject`; we surface a transient inline hint and an immediate error
// border so the pilot sees the value was refused rather than silently swallowed.

/** Transient message shown when the last keystroke was refused; null when clear. */
const rejectionHint = ref<string | null>(null)
const isRejected = computed(() => rejectionHint.value !== null)
let rejectionTimer: ReturnType<typeof setTimeout> | null = null

function clearRejectionTimer(): void {
  if (rejectionTimer !== null) {
    clearTimeout(rejectionTimer)
    rejectionTimer = null
  }
}

const unitSuffix = computed(() => (props.unit ? ` ${props.unit}` : ''))

function onFieldInput(value: number | null): void {
  // An accepted value clears any stale rejection hint immediately.
  rejectionHint.value = null
  clearRejectionTimer()
  emit('update:weight', clamp(value ?? minWeight.value))
}

function onReject(detail: DecimalRejection): void {
  if (detail.reason === 'min') {
    rejectionHint.value = `Minimum is ${minWeight.value}${unitSuffix.value}.`
  } else if (detail.reason === 'max') {
    rejectionHint.value =
      fieldMax.value != null ? `Maximum is ${fieldMax.value}${unitSuffix.value}.` : 'Value too high.'
  } else {
    rejectionHint.value = 'Enter digits only — letters and symbols (e, +) are not allowed.'
  }
  clearRejectionTimer()
  rejectionTimer = setTimeout(() => {
    rejectionHint.value = null
    rejectionTimer = null
  }, REJECTION_HINT_MS)
}

onBeforeUnmount(clearRejectionTimer)

function onSliderInput(event: Event): void {
  const parsed = parseFloat((event.target as HTMLInputElement).value)
  if (!Number.isNaN(parsed)) {
    emit('update:weight', clamp(parsed))
  }
}

function adjust(delta: number): void {
  emit('update:weight', clamp(props.station.weight + delta))
}

function increment(): void {
  adjust(1)
}

function decrement(): void {
  adjust(-1)
}

function incrementCoarse(): void {
  adjust(coarseStepValue.value)
}

function decrementCoarse(): void {
  adjust(-coarseStepValue.value)
}

function applyPreset(value: number): void {
  emit('update:weight', clamp(value))
}
</script>

<template>
  <!-- @IMP-MB-UI-006@ (FROM: @REQ-UQ-004@) -->
  <div
    class="mass-station-input"
    :class="{
      'mass-station-input--disabled': disabled,
      'mass-station-input--error': station.hasError,
      'mass-station-input--rejected': isRejected,
    }"
  >
    <div class="mass-station-input__header">
      <label :for="`station-${station.index}`" class="mass-station-input__label">
        {{ station.name }}
      </label>
      <!-- @IMP-MB-UI-007@ (FROM: @REQ-UQ-005@) -->
      <span v-if="unit" class="mass-station-input__unit" aria-label="unit">{{ unit }}</span>
    </div>

    <!-- @IMP-MB-UI-008@ (FROM: @REQ-UQ-004@) -->
    <!-- UX-002: coarse (±N) controls flank the fine (±1) control so a 75 kg
         passenger is a handful of taps, not 75. The fine control is retained. -->
    <div class="mass-station-input__control">
      <button
        type="button"
        class="mass-station-input__stepper mass-station-input__stepper--coarse"
        :disabled="disabled || station.weight <= minWeight"
        :aria-label="`Decrease by ${coarseStepValue}`"
        @click="decrementCoarse"
      >
        −{{ coarseStepValue }}
      </button>

      <button
        type="button"
        class="mass-station-input__stepper"
        :disabled="disabled || station.weight <= minWeight"
        aria-label="Decrease"
        @click="decrement"
      >
        −
      </button>

      <DecimalInput
        :id="`station-${station.index}`"
        class="mass-station-input__field"
        :model-value="station.weight"
        :min="minWeight"
        :max="fieldMax"
        :disabled="disabled"
        :aria-invalid="station.hasError || isRejected || undefined"
        @update:model-value="onFieldInput"
        @reject="onReject"
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

      <button
        type="button"
        class="mass-station-input__stepper mass-station-input__stepper--coarse"
        :disabled="disabled"
        :aria-label="`Increase by ${coarseStepValue}`"
        @click="incrementCoarse"
      >
        +{{ coarseStepValue }}
      </button>
    </div>

    <!-- Transient inline rejection feedback (UX-010 / UX-011): shown when the
         last keystroke was refused (non-decimal char or out of range). -->
    <p
      v-if="rejectionHint"
      class="mass-station-input__reject-hint"
      role="alert"
      aria-live="assertive"
    >
      {{ rejectionHint }}
    </p>

    <!-- UX-002: one-tap preset chips (e.g. standard passenger weights). -->
    <div
      v-if="presetList.length > 0"
      class="mass-station-input__presets"
      role="group"
      :aria-label="`${station.name} quick presets`"
    >
      <button
        v-for="preset in presetList"
        :key="preset"
        type="button"
        class="mass-station-input__preset-chip"
        :disabled="disabled"
        :aria-label="`Set ${station.name} to ${preset}${unit ? ` ${unit}` : ''}`"
        @click="applyPreset(preset)"
      >
        {{ preset }}{{ unit ? ` ${unit}` : '' }}
      </button>
    </div>

    <p
      v-if="hasUnusable"
      class="mass-station-input__unusable"
      :aria-label="`Unusable fuel: ${unusableFuel} ${unit ?? ''}`"
    >
      {{ unusableFuel }}{{ unit ? ` ${unit}` : '' }} unusable — minimum load
    </p>

    <div v-if="showSlider" class="mass-station-input__slider-row">
      <span class="mass-station-input__slider-bound">{{ minWeight }}</span>
      <input
        type="range"
        class="mass-station-input__slider"
        :aria-label="`${station.name} fuel load slider`"
        :value="station.weight"
        :min="minWeight"
        :max="maxCapacity ?? undefined"
        :disabled="disabled"
        step="1"
        @input="onSliderInput"
      />
      <span class="mass-station-input__slider-bound">{{ maxCapacity }}</span>
    </div>
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

/* Transient input-rejection state (UX-010 / UX-011) — distinct from the
   computation `--error` state; signals the last keystroke was refused. */
.mass-station-input--rejected .mass-station-input__control {
  border-color: var(--color-critical, #f44336);
  box-shadow: 0 0 0 2px var(--color-critical-bg, #ffebee);
}

.mass-station-input__reject-hint {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 600;
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

.mass-station-input__slider-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.mass-station-input__slider-bound {
  font-size: 0.6875rem;
  color: var(--color-text-secondary, #757575);
  font-variant-numeric: tabular-nums;
  min-width: 2.25rem;
  text-align: center;
}

.mass-station-input__slider {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 2.75rem;
  accent-color: var(--color-primary, #1976d2);
  touch-action: manipulation;
}

.mass-station-input__slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Landscape on wide phones / tablets: place slider inline to the right of the
 * stepper control so the input row stays compact. */
@media (min-width: 720px) and (orientation: landscape) {
  .mass-station-input__slider-row {
    padding: 0;
  }
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

.mass-station-input__stepper--coarse {
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  padding: 0 0.25rem;
  color: var(--color-primary, #1976d2);
}

/* UX-002: one-tap preset chips ─────────────────────────────────────────── */
.mass-station-input__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.mass-station-input__preset-chip {
  min-height: 2.25rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 1rem;
  background: var(--color-surface-alt, #f5f5f5);
  color: var(--color-text-primary, #212121);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background 0.1s ease,
    border-color 0.1s ease;
}

.mass-station-input__preset-chip:hover:not(:disabled) {
  background: var(--color-surface-hover, #e0e0e0);
  border-color: var(--color-primary, #1976d2);
}

.mass-station-input__preset-chip:focus-visible {
  outline: 2px solid var(--color-focus, #1976d2);
  outline-offset: 1px;
}

.mass-station-input__preset-chip:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mass-station-input__field {
  /* UX-002: widened from 5rem so 4+ digit loads (e.g. avgas in lb) read with
     tabular-nums without cramped precision typing under turbulence. */
  width: 7rem;
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
