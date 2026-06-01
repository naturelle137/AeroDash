<script setup lang="ts">
// @IMP-UI-SHARED-010@ (FROM: @REQ-SYS-017@, @DES-UX-014@)
type Category = 'defect' | 'feature' | 'security'

interface CategoryDef {
  id: Category
  label: string
  summary: string
  tooltip: string
}

const categories: CategoryDef[] = [
  {
    id: 'defect',
    label: 'Report a defect',
    summary: "Something doesn't work the way it should.",
    tooltip:
      'Use this when AeroDash shows a wrong number, a button does nothing, the app crashes, or something looks broken. We use these reports to fix problems.',
  },
  {
    id: 'feature',
    label: 'Request a feature',
    summary: 'Suggest something new or an improvement.',
    tooltip:
      "Use this when you have an idea for something AeroDash could do but currently doesn't — a new calculation, a new layout, support for a new aircraft, an extra option.",
  },
  {
    id: 'security',
    label: 'Report a security vulnerability',
    summary: "You've found a way the app could be abused.",
    tooltip:
      'Use this when you think someone could misuse AeroDash to harm a pilot, steal data, or bypass a safety check. Security reports are handled privately on GitHub — they are not visible in the public issue list.',
  },
]

const emit = defineEmits<{
  pick: [category: Category]
}>()
</script>

<template>
  <ul class="category-grid" role="list" aria-label="Pick a contribution category">
    <li v-for="cat in categories" :key="cat.id" class="category-grid__item">
      <button
        type="button"
        class="category-card"
        :class="`category-card--${cat.id}`"
        :data-testid="`category-${cat.id}`"
        :aria-describedby="`tooltip-${cat.id}`"
        @click="emit('pick', cat.id)"
      >
        <span class="category-card__label">{{ cat.label }}</span>
        <span class="category-card__summary">{{ cat.summary }}</span>
        <span :id="`tooltip-${cat.id}`" class="visually-hidden">{{ cat.tooltip }}</span>
      </button>
      <p class="category-grid__tooltip" :aria-hidden="true">
        <span class="info-glyph" aria-hidden="true">i</span>
        <span>{{ cat.tooltip }}</span>
      </p>
    </li>
  </ul>
</template>

<style scoped>
.category-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.category-grid__item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.category-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 1rem 1.25rem;
  min-height: 56px;
  background: var(--color-surface-card, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  text-align: left;
  font-size: 1rem;
  cursor: pointer;
  color: inherit;
  box-shadow: var(--shadow-sm);
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

.category-card:hover {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.category-card:focus-visible {
  outline: 2px solid var(--color-focus, #3b82f6);
  outline-offset: 2px;
}

.category-card__label {
  font-weight: 600;
  font-size: 1.0625rem;
  color: var(--color-text-primary, #111827);
}

.category-card__summary {
  font-size: 0.9375rem;
  color: var(--color-text-secondary, #4b5563);
}

.category-card--security {
  border-style: dashed;
}

.category-grid__tooltip {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0;
  padding: 0 0.25rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.4;
}

.info-glyph {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary-bg, #dbeafe);
  color: var(--color-primary, #1d4ed8);
  font-size: 0.75rem;
  font-weight: 700;
  font-style: italic;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (min-width: 768px) {
  .category-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .category-grid__item {
    height: 100%;
  }
  .category-card {
    flex: 1;
  }
}
</style>
