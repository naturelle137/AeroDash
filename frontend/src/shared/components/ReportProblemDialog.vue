<!-- @IMP-UI-SHARED-008@ (FROM: @REQ-SYS-016@, @REQ-SYS-017@) -->
<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="report-dialog__backdrop"
      data-testid="report-problem-dialog"
      @click.self="onCancel"
    >
      <div
        class="report-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.esc.prevent="onCancel"
      >
        <h2 :id="titleId" class="report-dialog__title">Report a problem</h2>
        <p class="report-dialog__intro">
          Your report is stored on this device. Nothing leaves AeroDash unless
          you press <strong>Open on GitHub</strong> below — the description is
          automatically redacted first, and you can review the redacted text
          before submitting.
        </p>

        <form class="report-dialog__form" @submit.prevent="onSubmit">
          <label class="report-dialog__field">
            <span class="report-dialog__label">What kind of problem?</span>
            <select v-model="form.kind" class="report-dialog__select" required>
              <option value="CALCULATION">Calculation result looked wrong</option>
              <option value="DATA">Aircraft or airport data looked wrong</option>
              <option value="UI">UI / display defect</option>
              <option value="CRASH">App froze or failed to load</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label class="report-dialog__field">
            <span class="report-dialog__label">
              Short summary
              <span class="report-dialog__hint">({{ form.summary.length }}/{{ SUMMARY_MAX_LEN }})</span>
            </span>
            <input
              v-model="form.summary"
              class="report-dialog__input"
              type="text"
              :maxlength="SUMMARY_MAX_LEN"
              minlength="3"
              required
              placeholder="e.g. CG envelope showed amber after correct fuel entry"
            />
          </label>

          <label class="report-dialog__field">
            <span class="report-dialog__label">
              What happened?
              <span class="report-dialog__hint">({{ form.description.length }}/{{ DESCRIPTION_MAX_LEN }})</span>
            </span>
            <textarea
              v-model="form.description"
              class="report-dialog__textarea"
              :maxlength="DESCRIPTION_MAX_LEN"
              minlength="10"
              required
              rows="6"
              placeholder="Steps, expected vs actual, any aviation numbers you used. Avoid email, phone, GPS, registration — they will be redacted automatically."
            ></textarea>
          </label>

          <details v-if="form.description.length > 0" class="report-dialog__preview" open>
            <summary>
              Preview of redacted text
              <span v-if="preview.total > 0" class="report-dialog__badge">
                {{ preview.total }} item{{ preview.total === 1 ? '' : 's' }} redacted
              </span>
            </summary>
            <pre class="report-dialog__preview-text" data-testid="redaction-preview">{{ preview.redacted }}</pre>
          </details>

          <p v-if="formError" class="report-dialog__error" role="alert">{{ formError }}</p>

          <div class="report-dialog__actions">
            <button
              type="button"
              class="report-dialog__btn report-dialog__btn--ghost"
              @click="onCancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="report-dialog__btn report-dialog__btn--primary"
              :disabled="!canSubmit || busy"
              data-testid="report-problem-save-btn"
            >
              Save report
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  DESCRIPTION_MAX_LEN,
  SUMMARY_MAX_LEN,
  type IncidentDraft,
} from '@/core/domain/incident-report.schema'
import { useIncidentReportStore } from '@/stores/incident-report.store'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', report: { id: string }): void
}>()

const titleId = useId()
const store = useIncidentReportStore()
const route = useRoute()

const blankForm = (): IncidentDraft => ({
  kind: 'OTHER',
  summary: '',
  description: '',
})
const form = reactive<IncidentDraft>(blankForm())
const busy = ref(false)
const formError = ref<string | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      Object.assign(form, blankForm())
      formError.value = null
      busy.value = false
    }
  },
)

const preview = computed(() => store.previewRedaction(form.description))

const canSubmit = computed(
  () =>
    form.summary.trim().length >= 3 &&
    form.description.trim().length >= 10 &&
    form.summary.length <= SUMMARY_MAX_LEN &&
    form.description.length <= DESCRIPTION_MAX_LEN,
)

function onCancel(): void {
  if (busy.value) return
  emit('close')
}

async function onSubmit(): Promise<void> {
  if (!canSubmit.value || busy.value) return
  busy.value = true
  formError.value = null
  try {
    const report = await store.capture(form, {
      routeName: typeof route.name === 'string' ? route.name : null,
    })
    emit('saved', { id: report.id })
    emit('close')
  } catch (err) {
    formError.value =
      err instanceof Error ? err.message : 'Failed to save the report. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.report-dialog__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.report-dialog {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  max-width: 560px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--space-6);
}

.report-dialog__title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-lg);
  font-weight: 700;
}

.report-dialog__intro {
  margin: 0 0 var(--space-4);
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.report-dialog__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.report-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.report-dialog__label {
  font-size: var(--text-sm);
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
}

.report-dialog__hint {
  font-weight: 400;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.report-dialog__input,
.report-dialog__select,
.report-dialog__textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-input, var(--color-surface));
  color: var(--color-text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
}

.report-dialog__textarea {
  min-height: 8rem;
  resize: vertical;
}

.report-dialog__preview {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-muted, var(--color-surface));
}

.report-dialog__preview summary {
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.report-dialog__badge {
  font-size: var(--text-xs);
  font-weight: 600;
  background: var(--color-info, #1d4ed8);
  color: #fff;
  border-radius: var(--radius-full);
  padding: 0.1rem 0.5rem;
}

.report-dialog__preview-text {
  white-space: pre-wrap;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  margin: var(--space-2) 0 0;
  max-height: 12rem;
  overflow-y: auto;
}

.report-dialog__error {
  color: var(--color-danger, #dc2626);
  font-size: var(--text-sm);
  margin: 0;
}

.report-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.report-dialog__btn {
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}

.report-dialog__btn--primary {
  background: var(--color-primary, #1d4ed8);
  color: #fff;
}

.report-dialog__btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.report-dialog__btn--ghost {
  background: transparent;
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
</style>
