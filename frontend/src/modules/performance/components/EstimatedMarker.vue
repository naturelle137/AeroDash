<script setup lang="ts">
// @IMP-PF-VIEW-001@ (FROM: @REQ-PF-017@)
</script>

<template>
  <span class="estimated-marker" role="note" aria-label="Estimated value, derived via CAA SSL 07">
    <span class="estimated-marker__tag">[ESTIMATED]</span>
    <span class="estimated-marker__source">(CAA SSL 07)</span>
  </span>
</template>

<style scoped>
.estimated-marker {
  display: inline-flex;
  gap: 0.25rem;
  align-items: baseline;
  font-size: 0.75rem;
  font-weight: 600;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 0.25rem;
  padding: 0.05rem 0.35rem;
  white-space: nowrap;
}

.estimated-marker__source {
  font-weight: 400;
  font-size: 0.7rem;
  opacity: 0.85;
}
</style>
