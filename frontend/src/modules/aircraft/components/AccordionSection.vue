<template>
  <!-- @IMP-AC-VIEW-009@ (FROM: @REQ-AC-001@, @REQ-AC-005@) -->
  <section class="accordion-section" :class="{ 'accordion-section--open': open }">
    <button
      type="button"
      class="accordion-header"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="toggle"
    >
      <span class="accordion-title">{{ title }}</span>
      <span v-if="summary" class="accordion-summary">{{ summary }}</span>
      <span class="accordion-chevron" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>
    <div v-show="open" :id="bodyId" class="accordion-body" role="region">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// @IMP-AC-VIEW-010@ (FROM: @REQ-AC-001@, @REQ-AC-005@)
const props = defineProps<{
  title: string
  summary?: string
  modelValue: boolean
  sectionId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const open = computed(() => props.modelValue)
const bodyId = computed(() => `accordion-body-${props.sectionId}`)

function toggle(): void {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.accordion-section {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-surface, #ffffff);
  overflow: hidden;
}

.accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-alt, #f9fafb);
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text, #111827);
}

.accordion-header:hover {
  background: var(--color-surface-hover, #f3f4f6);
}

.accordion-title {
  flex-shrink: 0;
}

.accordion-summary {
  flex: 1;
  font-weight: 400;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.accordion-chevron {
  flex-shrink: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.accordion-body {
  padding: 1rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}
</style>
