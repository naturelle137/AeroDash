<script setup lang="ts">
// @IMP-SYS-SHARED-003@ (FROM: @REQ-UI-013@)
import { useAppVersionStore } from '@/stores/app-version.store'

const { currentVersion, buildDate } = useAppVersionStore()
</script>

<template>
  <span class="app-version">v{{ currentVersion }} ({{ buildDate }})</span>
</template>

<style scoped>
.app-version {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}
</style>
