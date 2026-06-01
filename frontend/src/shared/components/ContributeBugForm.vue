<script setup lang="ts">
// @IMP-UI-SHARED-011@ (FROM: @REQ-SYS-018@, @DES-UX-015@)
import { computed, onMounted, ref } from 'vue'
import {
  BUG_SEVERITY_VALUES,
  type BugReportInput,
  type BugSeverity,
} from '@/core/logic/github-issue-url'
import {
  buildContributionEnvironment,
  detectEnvironmentSources,
} from '@/shared/utils/contribution-environment'

const TITLE_MAX = 200

const emit = defineEmits<{
  back: []
  submit: [input: BugReportInput]
}>()

const title = ref('')
const description = ref('')
const reproduction = ref('')
const severity = ref<BugSeverity | ''>('')
const hazardRef = ref('')
const environment = ref('')
const showAdvanced = ref(false)
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

onMounted(() => {
  environment.value = buildContributionEnvironment(detectEnvironmentSources())
  if (typeof window !== 'undefined') {
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
  }
})

function updateOnline(): void {
  isOnline.value = navigator.onLine
}

const titleTooLong = computed(() => title.value.trim().length > TITLE_MAX)

const canSubmit = computed(() => {
  return (
    title.value.trim() !== '' &&
    !titleTooLong.value &&
    description.value.trim() !== '' &&
    reproduction.value.trim() !== '' &&
    severity.value !== '' &&
    environment.value.trim() !== '' &&
    isOnline.value
  )
})

function onSubmit(): void {
  if (!canSubmit.value || severity.value === '') return
  emit('submit', {
    title: title.value.trim(),
    description: description.value.trim(),
    reproduction: reproduction.value.trim(),
    severity: severity.value,
    environment: environment.value.trim(),
    hazard_ref: hazardRef.value.trim() === '' ? undefined : hazardRef.value.trim(),
  })
}
</script>

<template>
  <form class="contribute-form" data-testid="bug-form" @submit.prevent="onSubmit">
    <p class="contribute-form__intro">
      Tell us what happened. We'll move you to GitHub in the next step — you
      can edit anything before submitting there.
    </p>

    <label class="field">
      <span class="field__label">Title</span>
      <span class="field__help">A short summary — what went wrong, in one line.</span>
      <input
        v-model="title"
        type="text"
        data-testid="bug-title"
        :aria-required="true"
        :aria-invalid="titleTooLong"
        :maxlength="TITLE_MAX + 50"
      />
      <span v-if="titleTooLong" class="field__error" role="alert">
        Title must be {{ TITLE_MAX }} characters or fewer.
      </span>
    </label>

    <label class="field">
      <span class="field__label">Bug description</span>
      <span class="field__help">What happened? Be as detailed as you can.</span>
      <textarea
        v-model="description"
        data-testid="bug-description"
        rows="4"
        :aria-required="true"
        placeholder="When calculating x, the moment arm was y."
      />
    </label>

    <label class="field">
      <span class="field__label">Steps to reproduce</span>
      <span class="field__help">How can someone else make the same thing happen?</span>
      <textarea
        v-model="reproduction"
        data-testid="bug-reproduction"
        rows="5"
        :aria-required="true"
        :placeholder="'1. Go to page ...\n2. Enter ...\n3. Select ...\n4. Click on ...'"
      />
    </label>

    <label class="field">
      <span class="field__label">Severity &amp; safety relevance</span>
      <span class="field__help">How badly did this affect you?</span>
      <select
        v-model="severity"
        data-testid="bug-severity"
        :aria-required="true"
      >
        <option value="" disabled>Choose…</option>
        <option v-for="s in BUG_SEVERITY_VALUES" :key="s" :value="s">{{ s }}</option>
      </select>
    </label>

    <label class="field">
      <span class="field__label">Environment</span>
      <span class="field__help">
        Browser, OS, device. We auto-fill what we can detect; please add anything missing.
      </span>
      <textarea
        v-model="environment"
        data-testid="bug-environment"
        rows="3"
        :aria-required="true"
      />
    </label>

    <details class="field-disclosure" :open="showAdvanced" @toggle="(e) => (showAdvanced = (e.target as HTMLDetailsElement).open)">
      <summary>Advanced (optional)</summary>
      <label class="field">
        <span class="field__label">Safety hazard reference</span>
        <span class="field__help">Skip if unsure — leave blank. Format: H-XXX.</span>
        <input
          v-model="hazardRef"
          type="text"
          data-testid="bug-hazard-ref"
          placeholder="H-XXX"
        />
      </label>
    </details>

    <p
      v-if="!isOnline"
      class="contribute-form__offline-note"
      role="status"
      data-testid="bug-offline-note"
    >
      You need a connection to open GitHub — try again when online.
    </p>

    <div class="contribute-form__actions">
      <button
        type="button"
        class="btn"
        data-testid="bug-back"
        @click="emit('back')"
      >
        ← Back
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        data-testid="bug-submit"
        :disabled="!canSubmit"
        :aria-label="canSubmit ? 'Open GitHub to submit (opens github.com in a new tab)' : 'Fill all required fields to enable submission'"
      >
        Open GitHub to submit ↗
      </button>
    </div>
  </form>
</template>

<style scoped>
.contribute-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: var(--color-surface-card, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.contribute-form__intro {
  margin: 0;
  color: var(--color-text-secondary, #4b5563);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field__label {
  font-weight: 600;
  font-size: 0.95rem;
}

.field__help {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #6b7280);
}

.field input,
.field textarea,
.field select {
  padding: 0.55rem 0.75rem;
  font-size: 0.95rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text-primary, #111827);
  font-family: inherit;
}

.field textarea {
  resize: vertical;
  min-height: 80px;
}

.field input:focus-visible,
.field textarea:focus-visible,
.field select:focus-visible {
  outline: 2px solid var(--color-focus, #3b82f6);
  outline-offset: 1px;
}

.field__error {
  color: var(--color-critical, #b91c1c);
  font-size: 0.85rem;
}

.field-disclosure {
  border: 1px dashed var(--color-border, #d1d5db);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.field-disclosure summary {
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-secondary, #4b5563);
}

.field-disclosure .field {
  margin-top: 0.75rem;
}

.contribute-form__offline-note {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  background: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning, #92400e);
  border: 1px solid var(--color-warning, #f59e0b);
  font-size: 0.9rem;
}

.contribute-form__actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.5rem;
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
}

.btn:focus-visible {
  outline: 2px solid var(--color-focus, #3b82f6);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #ffffff);
}
</style>
