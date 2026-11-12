<script setup lang="ts">
const props = defineProps<{
  /** Icon-only mark (no wordmark). Default: false (full logo). */
  iconOnly?: boolean
  /** Height in px of the artwork. Default: 32. */
  size?: number
}>()

// Original artwork (public/brand, derived from assets/). BASE_URL keeps hosted sub-paths working.
const base = import.meta.env.BASE_URL
const kind = (): string => (props.iconOnly ? 'icon' : 'logo')
const src = (theme: 'light' | 'dark'): string => `${base}brand/${kind()}-${theme}.png`
</script>

<template>
  <span class="app-logo" :class="{ 'app-logo--icon-only': iconOnly }" aria-hidden="true">
    <img
      class="app-logo__img app-logo__img--light"
      :src="src('light')"
      alt=""
      :height="size ?? 32"
      :style="{ height: `${size ?? 32}px` }"
      draggable="false"
    />
    <img
      class="app-logo__img app-logo__img--dark"
      :src="src('dark')"
      alt=""
      :height="size ?? 32"
      :style="{ height: `${size ?? 32}px` }"
      draggable="false"
    />
  </span>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  user-select: none;
}

.app-logo__img {
  display: block;
  width: auto;
  flex-shrink: 0;
}

/* The artwork ships on an opaque light/dark backdrop; blending lets that backdrop
   merge into the themed surface instead of showing as a box. */
.app-logo__img--light {
  mix-blend-mode: multiply;
}

.app-logo__img--dark {
  display: none;
  mix-blend-mode: screen;
}
</style>

<style>
[data-theme='dark'] .app-logo__img--light {
  display: none;
}

[data-theme='dark'] .app-logo__img--dark {
  display: block;
}
</style>
