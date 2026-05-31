<!-- @IMP-UI-COMP-DECIMAL-001@ (FROM: @REQ-UQ-001@) -->
<template>
  <input
    :id="id"
    type="text"
    inputmode="decimal"
    pattern="[0-9]*[.,]?[0-9]*"
    autocomplete="off"
    :value="rawString"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @input="onInput"
    @blur="onBlur"
  />
</template>

<script lang="ts">
/** Why a typed value was blocked: a non-decimal character, or out of [min,max]. */
export interface DecimalRejection {
  reason: 'invalid' | 'min' | 'max'
}
</script>

<script setup lang="ts">
// @IMP-UI-COMP-DECIMAL-002@ (FROM: @REQ-UQ-001@)
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number | null
    min?: number
    max?: number
    placeholder?: string
    id?: string
    disabled?: boolean
    ariaLabel?: string
    allowNull?: boolean
  }>(),
  {
    allowNull: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void
  (e: 'reject', detail: DecimalRejection): void
}>()

// Characters that are NOT part of a plain decimal number. The critical ones are
// "e"/"E"/"+", which a native `type=number` field accepted and `Number()` would
// expand ("1e2" → 100), silently corrupting a safety-critical value with no
// feedback (UX-010 / UX-011). They are stripped on input and surfaced via the
// `reject` event so a consumer can warn the pilot instead of failing silently.
const NON_DECIMAL = /[^0-9.,-]/g

// Raw string the user is currently typing — preserved verbatim during input
const rawString = ref<string>(props.modelValue !== null && props.modelValue !== undefined ? String(props.modelValue) : '')

// When the parent resets modelValue externally (e.g., after form reset), sync rawString
watch(
  () => props.modelValue,
  (newVal) => {
    const parsed = parseRaw(rawString.value)
    // Only reset rawString if external value differs from current parsed value
    // to avoid destroying in-progress typing
    if (newVal === null || newVal === undefined) {
      if (rawString.value !== '' && parsed === null) return
      rawString.value = ''
    } else if (parsed !== newVal) {
      rawString.value = String(newVal)
    }
  },
)

function parseRaw(raw: string): number | null {
  if (raw.trim() === '' || raw === '-' || raw.endsWith('.') || raw.endsWith(',')) return null
  const normalized = raw.replace(',', '.')
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return n
}

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement

  // Strip any character that cannot belong to a decimal number ("e", "+",
  // letters, …). Forcing the DOM value back is required because Vue's `:value`
  // binding won't re-render an unchanged model, leaving the rejected glyph on
  // screen otherwise. A stripped character is surfaced via `reject` so the
  // value can never be silently corrupted ("1e2" → 100) (UX-010 / UX-011).
  const sanitised = input.value.replace(NON_DECIMAL, '')
  if (sanitised !== input.value) {
    // Forbidden glyph entered: strip it from the field, flag the rejection, and
    // commit nothing. The stripped remainder is committed on the next valid
    // keystroke or on blur — never silently as a corrupted value.
    input.value = sanitised
    rawString.value = sanitised
    emit('reject', { reason: 'invalid' })
    return
  }
  rawString.value = sanitised

  const raw = sanitised.trim()

  // Empty input
  if (raw === '') {
    emit('update:modelValue', props.allowNull ? null : 0)
    return
  }

  // Intermediate states — user is still typing; do not emit yet
  if (raw === '-' || raw.endsWith('.') || raw.endsWith(',')) {
    return
  }

  const parsed = parseRaw(raw)
  if (parsed === null) return

  // Reject below min (if min >= 0, negative values are rejected)
  if (props.min !== undefined && parsed < props.min) {
    // Do not emit the out-of-range value, but no longer fail silently — tell
    // the consumer so it can show inline feedback (UX-011).
    emit('reject', { reason: 'min' })
    return
  }

  // Reject above max
  if (props.max !== undefined && parsed > props.max) {
    emit('reject', { reason: 'max' })
    return
  }

  emit('update:modelValue', parsed)
}

function onBlur(): void {
  // On blur, normalize: if the raw string is an intermediate state, emit final value
  const raw = rawString.value.trim()
  if (raw === '' || raw === '-' || raw.endsWith('.') || raw.endsWith(',')) {
    const fallback = props.allowNull ? null : 0
    rawString.value = fallback !== null ? String(fallback) : ''
    emit('update:modelValue', fallback)
    return
  }

  const parsed = parseRaw(raw)
  if (parsed !== null) {
    // Apply min/max clamping on blur
    if (props.min !== undefined && parsed < props.min) {
      rawString.value = String(props.min)
      emit('update:modelValue', props.min)
      return
    }
    if (props.max !== undefined && parsed > props.max) {
      rawString.value = String(props.max)
      emit('update:modelValue', props.max)
      return
    }
    emit('update:modelValue', parsed)
  }
}
</script>
