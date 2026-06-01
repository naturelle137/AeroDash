<script setup lang="ts">
// @IMP-UI-SHARED-012@ (FROM: @REQ-SYS-018@, @DES-UX-016@)
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { FeatureRequestInput } from '@/core/logic/github-issue-url'

const TITLE_MAX = 200
const DOD_SEED = '- [ ] '

const emit = defineEmits<{
  back: []
  submit: [input: FeatureRequestInput]
}>()

const title = ref('')
const problem = ref('')
const solution = ref('')
const reqId = ref('')
const safetyImpact = ref('')
const dod = ref('')
const showAdvanced = ref(false)
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const submitting = ref(false)

function updateOnline(): void {
  isOnline.value = navigator.onLine
}

onMounted(() => {
  if (dod.value === '') dod.value = DOD_SEED
  if (typeof window !== 'undefined') {
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', updateOnline)
    window.removeEventListener('offline', updateOnline)
  }
})

const titleTooLong = computed(() => title.value.trim().length > TITLE_MAX)

const canSubmit = computed(() => {
  return (
    !submitting.value &&
    title.value.trim() !== '' &&
    !titleTooLong.value &&
    problem.value.trim() !== '' &&
    solution.value.trim() !== '' &&
    dod.value.trim() !== '' &&
    dod.value.trim() !== DOD_SEED.trim() &&
    isOnline.value
  )
})

function onSubmit(): void {
  if (!canSubmit.value) return
  // Double-submit guard: prevents a double-tap from opening two GitHub tabs.
  submitting.value = true
  emit('submit', {
    title: title.value.trim(),
    problem: problem.value.trim(),
    solution: solution.value.trim(),
    dod: dod.value.trim(),
    req_id: reqId.value.trim() === '' ? undefined : reqId.value.trim(),
    safety_impact: safetyImpact.value.trim() === '' ? undefined : safetyImpact.value.trim(),
  })
}
</script>

<template>
  <form class="contribute-form" data-testid="feature-form" @submit.prevent="onSubmit">
    <p class="contribute-form__intro">
      Tell us your idea. We'll move you to GitHub in the next step — you can
      edit anything before submitting there.
    </p>

    <label class="field">
      <span class="field__label">Title</span>
      <span class="field__help">A short summary of the idea, in one line.</span>
      <input
        v-model="title"
        type="text"
        data-testid="feature-title"
        :aria-required="true"
        :aria-invalid="titleTooLong"
        :maxlength="TITLE_MAX + 50"
      />
      <span v-if="titleTooLong" class="field__error" role="alert">
        Title must be {{ TITLE_MAX }} characters or fewer.
      </span>
    </label>

    <label class="field">
      <span class="field__label">Problem statement / use case</span>
      <span class="field__help">
        What are you trying to do? Try the form: "As a pilot, I want to … so that …".
      </span>
      <textarea
        v-model="problem"
        data-testid="feature-problem"
        rows="4"
        :aria-required="true"
        placeholder="As a pilot, I want to ... so that ..."
      />
    </label>

    <label class="field">
      <span class="field__label">Proposed solution</span>
      <span class="field__help">How could AeroDash help? Describe your ideal version.</span>
      <textarea
        v-model="solution"
        data-testid="feature-solution"
        rows="4"
        :aria-required="true"
      />
    </label>

    <label class="field">
      <span class="field__label">Definition of Done / checklist</span>
      <span class="field__help">
        What would need to be done for this to be "finished"? A short checklist is fine.
      </span>
      <textarea
        v-model="dod"
        data-testid="feature-dod"
        rows="4"
        :aria-required="true"
      />
    </label>

    <details
      class="field-disclosure"
      :open="showAdvanced"
      @toggle="(e) => (showAdvanced = (e.target as HTMLDetailsElement).open)"
    >
      <summary>Advanced (optional)</summary>
      <label class="field">
        <span class="field__label">Related requirement</span>
        <span class="field__help">Skip if unsure. Format: REQ-SYS-XXX.</span>
        <input
          v-model="reqId"
          type="text"
          data-testid="feature-req-id"
          placeholder="REQ-SYS-XXX"
        />
      </label>
      <label class="field">
        <span class="field__label">Potential safety impact</span>
        <span class="field__help">
          Could this feature affect a Go/No-Go decision? Skip if you don't know.
        </span>
        <textarea
          v-model="safetyImpact"
          data-testid="feature-safety-impact"
          rows="3"
        />
      </label>
    </details>

    <p
      v-if="!isOnline"
      class="contribute-form__offline-note"
      role="status"
      data-testid="feature-offline-note"
    >
      You need a connection to open GitHub — try again when online.
    </p>

    <div class="contribute-form__actions">
      <button
        type="button"
        class="btn"
        data-testid="feature-back"
        @click="emit('back')"
      >
        ← Back
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        data-testid="feature-submit"
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
.field textarea {
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
.field textarea:focus-visible {
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
