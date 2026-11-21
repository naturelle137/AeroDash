<template>
  <div class="passenger-profiles">
    <p>Standard weights are stored with this aircraft and do not change existing loads.</p>
    <fieldset v-for="(profile, index) in modelValue" :key="index">
      <legend>Passenger profile {{ index + 1 }}</legend>
      <label :for="`${sectionId}-name-${index}`">Name</label>
      <input :id="`${sectionId}-name-${index}`" :value="profile.name" @input="patch(index, { name: ($event.target as HTMLInputElement).value })" />
      <label :for="`${sectionId}-weight-${index}`">Standard weight</label>
      <DecimalInput :id="`${sectionId}-weight-${index}`" :model-value="profile.standardWeight" :min="0" :max="500000" preserve-invalid @update:model-value="value => patch(index, { standardWeight: value ?? 0 })" />
      <label :for="`${sectionId}-unit-${index}`">Unit</label>
      <select :id="`${sectionId}-unit-${index}`" :value="profile.unit" @change="patch(index, { unit: ($event.target as HTMLSelectElement).value as 'kg' | 'lbs' })">
        <option value="kg">kg</option><option value="lbs">lb</option>
      </select>
      <p v-if="!validPassengerProfile(profile)" role="alert">Enter a name and a positive weight up to 500000.</p>
      <button type="button" @click="remove(index)">Remove passenger profile {{ index + 1 }}</button>
    </fieldset>
    <button type="button" @click="add">Add passenger profile</button>
  </div>
</template>

<script setup lang="ts">
import type { AircraftProfilePassengerProfile } from '@/core/adapters/aircraft.schema'
import DecimalInput from '@/shared/components/DecimalInput.vue'
import { validPassengerProfile } from '../services/passenger-profile.validator'

const props = defineProps<{ modelValue: AircraftProfilePassengerProfile[]; sectionId: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: AircraftProfilePassengerProfile[]): void }>()
function patch(index: number, changes: Partial<AircraftProfilePassengerProfile>): void {
  emit('update:modelValue', props.modelValue.map((row, i) => i === index ? { ...row, ...changes } : row))
}
function add(): void {
  emit('update:modelValue', [...props.modelValue, { name: '', standardWeight: 0, unit: 'kg' }])
}
function remove(index: number): void {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<style scoped>
.passenger-profiles, fieldset { display: flex; flex-direction: column; gap: 0.5rem; }
fieldset { min-width: 0; border: 1px solid var(--color-border, #d1d5db); border-radius: 6px; }
input, select { width: 100%; box-sizing: border-box; padding: 0.5rem; }
button { align-self: flex-start; padding: 0.5rem; }
p[role='alert'] { color: var(--color-critical, #991b1b); }
</style>
