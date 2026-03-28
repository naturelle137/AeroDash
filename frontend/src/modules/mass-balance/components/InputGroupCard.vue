<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <section class="input-group-card" role="group" :aria-label="title">
    <h3 v-if="title" class="input-group-card__title">{{ title }}</h3>
    <div class="input-group-card__content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.input-group-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 0.75rem;
}

.input-group-card__title {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary, #666);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.input-group-card__content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
