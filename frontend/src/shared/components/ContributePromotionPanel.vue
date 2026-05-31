<script setup lang="ts">
// @IMP-UI-SHARED-014@ (FROM: @REQ-SYS-016@, @DES-UX-018@)
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '@/core/logic/github-issue-url'
</script>

<template>
  <section class="promotion-panel" aria-labelledby="promotion-heading" data-testid="promotion-panel">
    <h2 id="promotion-heading" class="promotion-panel__title">How else can you help?</h2>
    <p class="promotion-panel__body">
      AeroDash is built in the open. Contribution isn't only writing code —
      telling us what didn't work, suggesting what could work better, improving
      the wording in the manual, or sharing a real-world flight-prep edge case
      all directly improve the next version.
    </p>
    <ul class="promotion-panel__list">
      <li>Report a defect you noticed.</li>
      <li>Suggest a feature.</li>
      <li>Improve the documentation.</li>
      <li>Share a real-world edge case in a discussion.</li>
    </ul>
    <div class="promotion-panel__links">
      <a
        :href="GITHUB_ISSUES_URL"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="promotion-issues-link"
      >
        Browse open issues ↗
      </a>
      <a
        :href="GITHUB_REPO_URL"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="promotion-repo-link"
      >
        Open the GitHub repository ↗
      </a>
    </div>
  </section>
</template>

<style scoped>
.promotion-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem 1.5rem;
  background: var(--color-surface-card, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.promotion-panel__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
}

.promotion-panel__body {
  margin: 0;
  color: var(--color-text-secondary, #4b5563);
  line-height: 1.5;
}

.promotion-panel__list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--color-text-primary, #111827);
  font-size: 0.95rem;
}

.promotion-panel__links {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.promotion-panel__links a {
  color: var(--color-primary, #1d4ed8);
  font-weight: 600;
  text-decoration: none;
}

.promotion-panel__links a:hover,
.promotion-panel__links a:focus-visible {
  text-decoration: underline;
  outline-offset: 2px;
}
</style>
