<script setup lang="ts">
// @IMP-UI-SHARED-001@ (FROM: @REQ-UI-011@)
defineProps<{
  /** Icon-only mark (no wordmark). Default: false (full wordmark). */
  iconOnly?: boolean
  /** Size in px applied to the icon mark. Default: 32. */
  size?: number
}>()
</script>

<template>
  <span class="app-logo" :class="{ 'app-logo--icon-only': iconOnly }" aria-hidden="true">
    <!-- ═══ Icon mark: stylised "A" with aircraft sweep ═════════════════════ -->
    <svg
      class="app-logo__mark"
      :width="size ?? 32"
      :height="size ?? 32"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Left leg of the A -->
      <path
        d="M4 74 L36 8 C37.2 5.5 42.8 5.5 44 8 L76 74 H63 L40 26 L17 74 Z"
        fill="currentColor"
      />
      <!-- Cut-out inner triangle to make the A hollow at top -->
      <polygon points="40,26 28,54 52,54" fill="var(--color-bg, #fafafa)" />
      <!-- Sweep curve replacing the crossbar — the runway sweep -->
      <path
        d="M12 68 Q40 46 68 68"
        stroke="currentColor"
        stroke-width="5"
        fill="none"
        stroke-linecap="round"
      />
      <!-- Aircraft silhouette: flying rightward across the upper-right of the A -->
      <!-- Fuselage -->
      <ellipse cx="59" cy="22" rx="9" ry="2.5" fill="currentColor" transform="rotate(-25 59 22)" />
      <!-- Main wing -->
      <path
        d="M56 20 L48 13 L50 13 L57 19 L67 10 L69 10 L60 20"
        fill="currentColor"
        transform="rotate(-25 59 22)"
      />
      <!-- Horizontal stabiliser -->
      <path
        d="M51 22 L46 17 L48 17 L52 22"
        fill="currentColor"
        transform="rotate(-25 59 22)"
      />
      <!-- Propeller disc (circle, front of fuselage) -->
      <circle cx="68" cy="18" r="2.2" fill="currentColor" transform="rotate(-25 59 22)" />
    </svg>

    <!-- ═══ Wordmark ═════════════════════════════════════════════════════════ -->
    <span v-if="!iconOnly" class="app-logo__wordmark">
      <span class="app-logo__word-aero">Aero</span><span class="app-logo__word-dash">Dash</span>
    </span>
  </span>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-primary);
  text-decoration: none;
  user-select: none;
}

.app-logo__mark {
  flex-shrink: 0;
  display: block;
}

.app-logo__wordmark {
  display: flex;
  align-items: baseline;
  gap: 0;
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
  line-height: 1;
}

.app-logo__word-aero {
  color: var(--color-primary);
}

.app-logo__word-dash {
  color: var(--color-text-secondary);
}

.app-logo--icon-only .app-logo__wordmark {
  display: none;
}
</style>
