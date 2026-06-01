<script setup lang="ts">
// @IMP-UI-SHARED-013@ (FROM: @REQ-SYS-019@, @DES-UX-017@)
import { GITHUB_SECURITY_ADVISORY_URL } from '@/core/logic/github-issue-url'

const emit = defineEmits<{
  back: []
}>()
</script>

<template>
  <section
    class="security-card"
    data-testid="security-card"
    aria-labelledby="security-card-heading"
  >
    <h2 id="security-card-heading" class="security-card__title">
      Security reports are handled privately
    </h2>
    <p>
      Security reports go to a form on GitHub that only the maintainers can read —
      they are not visible in the public issue list. This protects both pilots and
      the project while we work on a fix.
    </p>
    <ul class="security-card__bullets">
      <li>
        Don't post exploit details in a normal bug report — use this path instead.
      </li>
      <li>
        We will reach out via the GitHub advisory thread once we've reproduced the
        issue.
      </li>
    </ul>
    <div class="security-card__actions">
      <button
        type="button"
        class="btn"
        data-testid="security-back"
        @click="emit('back')"
      >
        ← Back
      </button>
      <a
        class="btn btn-primary"
        data-testid="security-open"
        :href="GITHUB_SECURITY_ADVISORY_URL"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the private security form on GitHub (opens github.com in a new tab)"
      >
        Open the private security form on GitHub ↗
      </a>
    </div>
  </section>
</template>

<style scoped>
.security-card {
  padding: 1.25rem 1.5rem;
  background: var(--color-surface-card, #f9fafb);
  border: 1px solid var(--color-warning, #f59e0b);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.security-card__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.security-card__bullets {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: var(--color-text-secondary, #4b5563);
  font-size: 0.95rem;
}

.security-card__actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  min-height: 44px;
  padding: 0.55rem 1.1rem;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--color-border, #d1d5db);
  background: var(--color-surface, #ffffff);
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:focus-visible {
  outline: 2px solid var(--color-focus, #3b82f6);
  outline-offset: 2px;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #ffffff);
}
</style>
