<template>
  <div class="surface-condition-select">
    <label :for="selectId">Surface condition</label>
    <select
      :id="selectId"
      :value="modelValue ?? ''"
      :aria-invalid="modelValue === null"
      @change="onChange(($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>— Select surface condition —</option>
      <option v-for="option in options" :key="option.id" :value="option.id">
        {{ option.label }}
      </option>
    </select>
    <p v-if="modelValue === null" class="surface-condition-hint" role="alert">
      Required before performance can be computed.
    </p>
  </div>
</template>

<script setup lang="ts">
// @IMP-AP-VIEW-001@ (FROM: @REQ-AP-004@)
import { computed } from 'vue'
import type { BaseSurfaceType } from '../domain/airport.types'
import { surfaceConditionsFor } from '../domain/surface-conditions'

const props = defineProps<{
  base: BaseSurfaceType
  modelValue: string | null
  selectId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
}>()

const options = computed(() => surfaceConditionsFor(props.base))

function onChange(value: string): void {
  emit('update:modelValue', value === '' ? null : value)
}
</script>

<style scoped>
.surface-condition-select {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.surface-condition-hint {
  margin: 0;
  font-size: 0.85rem;
  color: #b91c1c;
}
</style>
