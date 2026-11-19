<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <details class="input-help">
    <summary :aria-label="`${label} help`"><span aria-hidden="true">ⓘ</span> <span>Help: {{ label }}</span></summary>
    <p><slot /></p>
  </details>
</template>

<style scoped>
.input-help { min-width: 0; overflow-wrap: anywhere; }
summary { min-height: 44px; display: flex; align-items: center; gap: .35rem; cursor: pointer; }
summary:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
p { margin: 0 0 .5rem; line-height: 1.6; }
</style>
