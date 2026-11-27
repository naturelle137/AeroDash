<script setup lang="ts">
defineProps<{ label: string; en: string; de: string }>()
</script>

<template>
  <details class="info-popover">
    <summary :aria-label="`Information: ${label}`">ⓘ</summary>
    <div class="info-popover__content" role="note">
      <p lang="en">{{ en }}</p>
      <p lang="de">{{ de }}</p>
    </div>
  </details>
</template>

<style scoped>
.info-popover { display: inline; }
summary { display: inline-block; cursor: pointer; padding: 0.35rem; font-size: 1rem; color: var(--color-text-primary, #212121); }
summary:focus-visible { outline: 2px solid var(--color-focus, #005fcc); }
.info-popover__content { display: block; padding: 0.5rem; background: var(--color-surface, white); color: var(--color-text-primary, #212121); border: 1px solid var(--color-border, #777); border-radius: 0.25rem; font-size: 0.875rem; font-weight: normal; line-height: 1.4; }
p { margin: 0; }
p + p { margin-top: 0.5rem; }
</style>
