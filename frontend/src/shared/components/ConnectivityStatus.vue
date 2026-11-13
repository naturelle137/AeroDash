<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const online = ref(navigator.onLine)
function refresh(): void {
  online.value = navigator.onLine
}

onMounted(() => {
  refresh()
  window.addEventListener('online', refresh)
  window.addEventListener('offline', refresh)
  // A restored document may have missed connectivity events while suspended.
  window.addEventListener('pageshow', refresh)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', refresh)
  window.removeEventListener('offline', refresh)
  window.removeEventListener('pageshow', refresh)
})
</script>

<template>
  <details class="connectivity">
    <summary aria-label="Browser connectivity details">
      <span role="status" aria-live="polite" aria-atomic="true">Browser {{ online ? 'online' : 'offline' }}</span>
    </summary>
    <p class="connectivity__help">
      Browser-reported connectivity only; Internet access, offline cache readiness and source freshness
      are not verified. After a successful online load and caching, local Fleet, M&amp;B, raw Performance
      and saved runway inputs can be used offline. Check aircraft data against the POH/AFM.
      Weather, airport queries and cloud sync remain unavailable.
    </p>
  </details>
</template>

<style scoped>
.connectivity {
  position: relative;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
summary:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.connectivity__help {
  position: absolute;
  right: 0;
  width: min(300px, calc(100vw - 32px));
  padding: 1rem;
  margin: 0;
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid currentColor;
  border-radius: 6px;
  line-height: 1.5;
}
</style>
