<template>
  <!-- @IMP-AC-VIEW-020@ (FROM: @REQ-AC-007@) -->
  <!--
    Verification sign-off modal (REQ-AC-007, H-011). Verifying a profile is no
    longer a single un-attributed tap: the pilot must record who checked the
    data, against which POH revision, and on what date. The provenance is bound
    to the profile's active weighing report by the fleet store and later drives
    expiry. Mirrors ConfirmDialog's focus/escape/backdrop behaviour.
  -->
  <Teleport to="body">
    <div v-if="open" class="verify-dialog__backdrop" @click.self="onCancel">
      <div
        class="verify-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.esc.prevent="onCancel"
      >
        <h2 :id="titleId" class="verify-dialog__title">Verify {{ registration }}</h2>
        <p class="verify-dialog__intro">
          Confirm you have checked this profile against the official POH/AFM. Your
          sign-off is recorded with the profile.
        </p>

        <label class="verify-dialog__field">
          <span class="verify-dialog__label">Verifier initials</span>
          <input
            ref="initialsEl"
            v-model="verifiedBy"
            type="text"
            class="verify-dialog__input"
            maxlength="10"
            autocomplete="off"
            aria-label="Verifier initials"
            placeholder="e.g. JS"
          />
        </label>

        <label class="verify-dialog__field">
          <span class="verify-dialog__label">POH / AFM revision</span>
          <input
            v-model="pohRevision"
            type="text"
            class="verify-dialog__input"
            maxlength="40"
            autocomplete="off"
            aria-label="POH revision"
            placeholder="e.g. Rev 7"
          />
        </label>

        <label class="verify-dialog__field">
          <span class="verify-dialog__label">Verification date</span>
          <input
            v-model="verifiedOn"
            type="date"
            class="verify-dialog__input"
            aria-label="Verification date"
          />
        </label>

        <p v-if="!canConfirm" class="verify-dialog__hint" role="status">
          Enter your initials and the POH revision to sign off.
        </p>

        <div class="verify-dialog__actions">
          <button
            ref="cancelBtn"
            type="button"
            class="verify-dialog__btn verify-dialog__btn--cancel"
            @click="onCancel"
          >
            Cancel
          </button>
          <button
            type="button"
            class="verify-dialog__btn verify-dialog__btn--primary"
            :disabled="!canConfirm"
            @click="onConfirm"
          >
            Verify
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// @IMP-AC-VIEW-021@ (FROM: @REQ-AC-007@)
import { computed, nextTick, ref, watch } from 'vue'
import type { VerificationSignoff } from '../stores/fleet.store'

let uid = 0
const titleId = `verify-${++uid}-title`

const props = defineProps<{
  open: boolean
  registration: string
}>()

const emit = defineEmits<{
  confirm: [signoff: VerificationSignoff]
  cancel: []
}>()

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const verifiedBy = ref('')
const pohRevision = ref('')
const verifiedOn = ref(todayIso())

const initialsEl = ref<HTMLInputElement | null>(null)
const cancelBtn = ref<HTMLButtonElement | null>(null)
let lastFocused: HTMLElement | null = null

const canConfirm = computed(
  () => verifiedBy.value.trim() !== '' && pohRevision.value.trim() !== '' && verifiedOn.value !== '',
)

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      // Reset the form each time the dialog opens so a prior attempt's text
      // never leaks into a different aircraft's sign-off.
      verifiedBy.value = ''
      pohRevision.value = ''
      verifiedOn.value = todayIso()
      lastFocused = document.activeElement as HTMLElement | null
      await nextTick()
      initialsEl.value?.focus()
    } else {
      lastFocused?.focus?.()
      lastFocused = null
    }
  },
)

function onConfirm(): void {
  if (!canConfirm.value) return
  emit('confirm', {
    verifiedBy: verifiedBy.value.trim(),
    pohRevision: pohRevision.value.trim(),
    verifiedOn: verifiedOn.value,
  })
}

function onCancel(): void {
  emit('cancel')
}
</script>

<style scoped>
.verify-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4, 1rem);
  background: rgba(0, 0, 0, 0.55);
}

.verify-dialog {
  width: 100%;
  max-width: 28rem;
  padding: var(--space-5, 1.5rem);
  border-radius: var(--radius-xl, 12px);
  background: var(--color-surface-card, var(--color-surface, #fff));
  color: var(--color-text-primary, #212121);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  border: 1px solid var(--color-border, #e5e7eb);
}

.verify-dialog__title {
  margin: 0 0 var(--space-2, 0.5rem);
  font-size: var(--text-lg, 1.125rem);
  font-weight: 700;
}

.verify-dialog__intro {
  margin: 0 0 var(--space-4, 1rem);
  font-size: var(--text-sm, 0.875rem);
  line-height: 1.5;
  color: var(--color-text-secondary, #4b5563);
}

.verify-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  margin-bottom: var(--space-3, 0.75rem);
}

.verify-dialog__label {
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary, #6b7280);
}

.verify-dialog__input {
  min-height: 44px;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font: inherit;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-md, 6px);
  background: var(--color-surface, #fff);
  color: var(--color-text, #212121);
}

.verify-dialog__input:focus-visible {
  outline: 2px solid var(--color-focus, var(--color-primary, #3b82f6));
  outline-offset: 2px;
  border-color: var(--color-primary, #3b82f6);
}

.verify-dialog__hint {
  margin: 0 0 var(--space-3, 0.75rem);
  font-size: var(--text-xs, 0.75rem);
  color: var(--color-text-secondary, #6b7280);
}

.verify-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
  flex-wrap: wrap;
  margin-top: var(--space-2, 0.5rem);
}

.verify-dialog__btn {
  min-height: 44px;
  padding: var(--space-2, 0.5rem) var(--space-5, 1.5rem);
  border-radius: var(--radius-md, 6px);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background var(--transition-fast, 150ms ease),
    border-color var(--transition-fast, 150ms ease),
    color var(--transition-fast, 150ms ease);
}

.verify-dialog__btn:focus-visible {
  outline: 2px solid var(--color-focus, var(--color-primary, #3b82f6));
  outline-offset: 2px;
}

.verify-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.verify-dialog__btn--cancel {
  background: var(--color-surface-alt, #f3f4f6);
  color: var(--color-text-primary, #212121);
  border-color: var(--color-border, #e5e7eb);
}

.verify-dialog__btn--cancel:hover {
  background: var(--color-surface-hover, #e5e7eb);
}

.verify-dialog__btn--primary {
  background: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #fff);
}

.verify-dialog__btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover, var(--color-primary, #2563eb));
}
</style>
