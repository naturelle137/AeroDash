<!-- @IMP-UI-SHARED-003@ (FROM: @REQ-UI-011@) -->
<template>
  <!--
    Accessible, dark-mode-safe confirmation modal — the in-app replacement for
    the native `window.confirm()` used on destructive cockpit actions. A native
    confirm renders unstyled, ignores the dark theme, reads poorly on a screen
    reader, and is dismissable by the iOS back-gesture. This modal:
      • traps and restores focus (focus lands on the confirm action),
      • labels itself via aria-labelledby / aria-describedby,
      • closes on Escape and on backdrop tap (treated as cancel),
      • paints from the same design tokens as the rest of the shell.
  -->
  <Teleport to="body">
    <div
      v-if="open"
      class="confirm-dialog__backdrop"
      @click.self="onCancel"
    >
      <div
        ref="dialogEl"
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="messageId"
        @keydown.esc.prevent="onCancel"
      >
        <h2 :id="titleId" class="confirm-dialog__title">{{ title }}</h2>
        <p :id="messageId" class="confirm-dialog__message">{{ message }}</p>

        <div class="confirm-dialog__actions">
          <button
            ref="cancelBtn"
            type="button"
            class="confirm-dialog__btn confirm-dialog__btn--cancel"
            @click="onCancel"
          >
            {{ cancelLabel }}
          </button>
          <button
            ref="confirmBtn"
            type="button"
            class="confirm-dialog__btn"
            :class="
              variant === 'danger'
                ? 'confirm-dialog__btn--danger'
                : 'confirm-dialog__btn--primary'
            "
            @click="onConfirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// @IMP-UI-SHARED-004@ (FROM: @REQ-UI-011@)
import { nextTick, ref, watch } from 'vue'

let uid = 0
const localId = `confirm-${++uid}`
const titleId = `${localId}-title`
const messageId = `${localId}-message`

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    /** `danger` paints the confirm action in the critical colour. */
    variant?: 'danger' | 'primary'
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'danger',
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogEl = ref<HTMLElement | null>(null)
const confirmBtn = ref<HTMLButtonElement | null>(null)
const cancelBtn = ref<HTMLButtonElement | null>(null)
let lastFocused: HTMLElement | null = null

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement as HTMLElement | null
      await nextTick()
      // Land focus on Cancel — the non-destructive default — so a stray
      // Enter/Space under turbulence doesn't trigger the destructive action.
      cancelBtn.value?.focus()
    } else {
      lastFocused?.focus?.()
      lastFocused = null
    }
  },
)

function onConfirm(): void {
  emit('confirm')
}

function onCancel(): void {
  emit('cancel')
}
</script>

<style scoped>
.confirm-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 400; /* above app header (200) + sticky strips (150) */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4, 1rem);
  background: rgba(0, 0, 0, 0.55);
}

.confirm-dialog {
  width: 100%;
  max-width: 28rem;
  padding: var(--space-5, 1.5rem);
  border-radius: var(--radius-xl, 12px);
  background: var(--color-surface-card, var(--color-surface, #fff));
  color: var(--color-text-primary, #212121);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  border: 1px solid var(--color-border, #e5e7eb);
}

.confirm-dialog__title {
  margin: 0 0 var(--space-2, 0.5rem);
  font-size: var(--text-lg, 1.125rem);
  font-weight: 700;
}

.confirm-dialog__message {
  margin: 0 0 var(--space-5, 1.5rem);
  font-size: var(--text-sm, 0.875rem);
  line-height: 1.5;
  color: var(--color-text-secondary, #4b5563);
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
  flex-wrap: wrap;
}

.confirm-dialog__btn {
  min-height: 44px; /* WCAG 2.2 AAA touch target — gloved cockpit use */
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

.confirm-dialog__btn:focus-visible {
  outline: 2px solid var(--color-focus, var(--color-primary, #3b82f6));
  outline-offset: 2px;
}

.confirm-dialog__btn--cancel {
  background: var(--color-surface-alt, #f3f4f6);
  color: var(--color-text-primary, #212121);
  border-color: var(--color-border, #e5e7eb);
}

.confirm-dialog__btn--cancel:hover {
  background: var(--color-surface-hover, #e5e7eb);
}

.confirm-dialog__btn--danger {
  background: var(--color-critical, #dc2626);
  color: var(--neutral-0, #fff);
}

.confirm-dialog__btn--danger:hover {
  background: var(--color-critical-hover, var(--color-critical, #b91c1c));
}

.confirm-dialog__btn--primary {
  background: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #fff);
}

.confirm-dialog__btn--primary:hover {
  background: var(--color-primary-hover, var(--color-primary, #2563eb));
}
</style>
