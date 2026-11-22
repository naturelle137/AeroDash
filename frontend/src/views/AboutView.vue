<script setup lang="ts">
import { useAppVersionStore } from '@/stores/app-version.store'

const version = useAppVersionStore()
const releaseDate = __RELEASE_DATE__
</script>

<template>
  <section class="about">
    <h1>About AeroDash</h1>
    <dl>
      <dt>Version</dt>
      <dd>v{{ version.currentVersion }}</dd>
      <dt>Release date</dt>
      <dd>{{ releaseDate ?? 'unknown' }}</dd>
    </dl>
  </section>
</template>

<style scoped>
.about {
  padding: var(--space-6);
}
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-3) var(--space-6);
}
dt {
  font-weight: 600;
}
dd {
  margin: 0;
}
</style>
