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
}>()

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
  rawString.value = input.value

  const raw = input.value.trim()

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
    // Do not emit — user typed an out-of-range intermediate value
    // (we preserve raw string so they can continue editing)
    return
  }

  // Reject above max
  if (props.max !== undefined && parsed > props.max) {
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
