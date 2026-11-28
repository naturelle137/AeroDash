<script setup lang="ts">
import type { exportUnverifiedGate } from './export-gate'

defineProps<{ gate: NonNullable<ReturnType<typeof exportUnverifiedGate>>; action: string }>()
defineEmits<{ acknowledge: []; cancel: [] }>()
</script>

<template>
  <section role="alertdialog" aria-modal="true" aria-labelledby="export-gate-title" class="export-gate" data-testid="export-gate">
    <h2 id="export-gate-title">CRITICAL {{ gate.notification.id }} · {{ gate.notification.message }}</h2>
    <p>The file contains unverified data ({{ gate.status }}). {{ action }} proceeds only after acknowledgment; entries stay unverified in the file.</p>
    <ul aria-label="Unverified fields"><li v-for="field in gate.parameters" :key="field"><code>{{ field }}</code></li></ul>
    <button type="button" @click="$emit('acknowledge')">Acknowledge unverified data and continue</button>
    <button type="button" @click="$emit('cancel')">Cancel</button>
  </section>
</template>

<style scoped>
.export-gate { margin: .75rem 0; padding: .75rem; border: 2px solid #b71c1c; background: #ffebee; color: #1a1a1a; }
.export-gate button { min-height: 44px; margin: .5rem .5rem 0 0; font: inherit; }
</style>
