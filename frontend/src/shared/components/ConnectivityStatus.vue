<script setup lang="ts">
import { useConnectivityStore } from '@/modules/connectivity/connectivity.store'

const { online } = useConnectivityStore()
</script>

<template>
  <details class="connectivity">
    <summary aria-label="Browser connectivity details">
      <span aria-hidden="true">{{ online ? '●' : '○' }}</span>
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
  gap: 0.25rem;
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
