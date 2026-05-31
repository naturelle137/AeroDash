<script setup lang="ts">
// @IMP-UI-VIEW-003@ (FROM: @REQ-SYS-016@, @REQ-SYS-017@, @REQ-SYS-018@, @DES-UX-013@, @DES-UX-014@, @DES-UX-017@, @DES-UX-018@, @DES-UX-019@)
import { computed, ref } from 'vue'
import ContributeCategoryGrid from '@/shared/components/ContributeCategoryGrid.vue'
import ContributeBugForm from '@/shared/components/ContributeBugForm.vue'
import ContributeFeatureForm from '@/shared/components/ContributeFeatureForm.vue'
import ContributeSecurityCard from '@/shared/components/ContributeSecurityCard.vue'
import ContributePromotionPanel from '@/shared/components/ContributePromotionPanel.vue'
import {
  buildBugReportUrl,
  buildFeatureRequestUrl,
  type BugReportInput,
  type FeatureRequestInput,
} from '@/core/logic/github-issue-url'

type Screen = 'category' | 'defect' | 'feature' | 'security'

const screen = ref<Screen>('category')
const heading = computed(() => {
  switch (screen.value) {
    case 'defect':
      return 'Report a defect'
    case 'feature':
      return 'Request a feature'
    case 'security':
      return 'Report a security vulnerability'
    default:
      return 'Help us improve AeroDash'
  }
})

function pickCategory(next: Screen): void {
  screen.value = next
}

function backToCategory(): void {
  screen.value = 'category'
}

function openInNewTab(url: string): void {
  if (typeof window === 'undefined') return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function onSubmitBug(input: BugReportInput): void {
  openInNewTab(buildBugReportUrl(input))
}

function onSubmitFeature(input: FeatureRequestInput): void {
  openInNewTab(buildFeatureRequestUrl(input))
}
</script>

<template>
  <main class="contribute-view" aria-labelledby="contribute-heading">
    <header class="contribute-view__header">
      <h1 id="contribute-heading">{{ heading }}</h1>
      <p v-if="screen === 'category'" class="contribute-view__intro">
        Found something that doesn't work? Have an idea for an improvement?
        Noticed a security concern? Pick the closest match below — we'll guide you
        through what to write, then hand off to GitHub for submission.
      </p>
    </header>

    <ContributeCategoryGrid
      v-if="screen === 'category'"
      data-testid="contribute-category-grid"
      @pick="pickCategory"
    />

    <ContributeBugForm
      v-else-if="screen === 'defect'"
      data-testid="contribute-bug-form"
      @back="backToCategory"
      @submit="onSubmitBug"
    />

    <ContributeFeatureForm
      v-else-if="screen === 'feature'"
      data-testid="contribute-feature-form"
      @back="backToCategory"
      @submit="onSubmitFeature"
    />

    <ContributeSecurityCard
      v-else-if="screen === 'security'"
      data-testid="contribute-security-card"
      @back="backToCategory"
    />

    <ContributePromotionPanel data-testid="contribute-promotion" />
  </main>
</template>

<style scoped>
.contribute-view {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: var(--color-text-primary, #111827);
}

.contribute-view__header h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  font-weight: 700;
}

.contribute-view__intro {
  margin: 0;
  color: var(--color-text-secondary, #4b5563);
  line-height: 1.5;
}
</style>
