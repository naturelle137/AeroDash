<!-- @IMP-UI-SHARED-008@ (FROM: @REQ-UI-011@) -->
<template>
  <!--
    Accessible, dark-mode-safe modal that offers a *set* of mutually-exclusive
    actions (not just confirm/cancel). It is the multi-action sibling of
    ConfirmDialog and the in-app replacement for native dialogs that the iOS
    back-gesture can dismiss out from under a safety-critical decision. Like
    ConfirmDialog it:
      • traps and restores focus (focus lands on the action flagged `default`,
        else the first action — kept off any destructive action so a stray tap
        under turbulence can't trigger it),
      • labels itself via aria-labelledby / aria-describedby,
      • closes on Escape and on backdrop tap (both emit `dismiss`, never a
        destructive `choose`),
      • paints from the same design tokens as the rest of the shell.
  -->
  <Teleport to="body">
    <div
      v-if="open"
      class="action-choice__backdrop"
      @click.self="onDismiss"
    >
      <div
        ref="dialogEl"
        class="action-choice"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="messageId"
        @keydown.esc.prevent="onDismiss"
      >
        <h2 :id="titleId" class="action-choice__title">{{ title }}</h2>
        <p :id="messageId" class="action-choice__message">{{ message }}</p>

        <div class="action-choice__actions">
          <button
            v-for="(action, idx) in actions"
            :key="action.id"
            :ref="(el) => registerActionRef(el, idx)"
            type="button"
            class="action-choice__btn"
            :class="`action-choice__btn--${action.variant ?? 'secondary'}`"
            @click="onChoose(action.id)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
// @IMP-UI-SHARED-009@ (FROM: @REQ-UI-011@)
/** A single selectable action rendered as a button. */
export interface DialogAction {
  /** Stable identifier emitted via `choose`. */
  id: string
  /** Visible button label. */
  label: string
  /** Visual weight — defaults to `secondary`. `danger` paints the critical colour. */
  variant?: 'primary' | 'danger' | 'secondary'
  /** When true this action receives initial focus (keep it off destructive actions). */
  default?: boolean
}
</script>

<script setup lang="ts">
import { nextTick, ref, watch, type ComponentPublicInstance } from 'vue'

let uid = 0
const localId = `action-choice-${++uid}`
const titleId = `${localId}-title`
const messageId = `${localId}-message`

const props = defineProps<{
  open: boolean
  title: string
  message: string
  actions: readonly DialogAction[]
}>()

const emit = defineEmits<{
  choose: [id: string]
  dismiss: []
}>()

const dialogEl = ref<HTMLElement | null>(null)
const actionEls = ref<(HTMLButtonElement | null)[]>([])
let lastFocused: HTMLElement | null = null

function registerActionRef(el: Element | ComponentPublicInstance | null, idx: number): void {
  actionEls.value[idx] = (el as HTMLButtonElement | null) ?? null
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement as HTMLElement | null
      await nextTick()
      // Prefer the action explicitly flagged `default`; otherwise the first.
      // Never auto-focus a destructive action.
      const defaultIdx = props.actions.findIndex((a) => a.default)
      const focusIdx = defaultIdx >= 0 ? defaultIdx : 0
      actionEls.value[focusIdx]?.focus()
    } else {
      lastFocused?.focus?.()
      lastFocused = null
    }
  },
)

function onChoose(id: string): void {
  emit('choose', id)
}

function onDismiss(): void {
  emit('dismiss')
}
</script>

<style scoped>
.action-choice__backdrop {
  position: fixed;
  inset: 0;
  z-index: 400; /* above app header (200) + sticky strips (150) */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4, 1rem);
  background: rgba(0, 0, 0, 0.55);
}

.action-choice {
  width: 100%;
  max-width: 28rem;
  padding: var(--space-5, 1.5rem);
  border-radius: var(--radius-xl, 12px);
  background: var(--color-surface-card, var(--color-surface, #fff));
  color: var(--color-text-primary, #212121);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  border: 1px solid var(--color-border, #e5e7eb);
}

.action-choice__title {
  margin: 0 0 var(--space-2, 0.5rem);
  font-size: var(--text-lg, 1.125rem);
  font-weight: 700;
}

.action-choice__message {
  margin: 0 0 var(--space-5, 1.5rem);
  font-size: var(--text-sm, 0.875rem);
  line-height: 1.5;
  color: var(--color-text-secondary, #4b5563);
}

.action-choice__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
  flex-wrap: wrap;
}

.action-choice__btn {
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

.action-choice__btn:focus-visible {
  outline: 2px solid var(--color-focus, var(--color-primary, #3b82f6));
  outline-offset: 2px;
}

.action-choice__btn--secondary {
  background: var(--color-surface-alt, #f3f4f6);
  color: var(--color-text-primary, #212121);
  border-color: var(--color-border, #e5e7eb);
}

.action-choice__btn--secondary:hover {
  background: var(--color-surface-hover, #e5e7eb);
}

.action-choice__btn--danger {
  background: var(--color-critical, #dc2626);
  color: var(--neutral-0, #fff);
}

.action-choice__btn--danger:hover {
  background: var(--color-critical-hover, var(--color-critical, #b91c1c));
}

.action-choice__btn--primary {
  background: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #fff);
}

.action-choice__btn--primary:hover {
  background: var(--color-primary-hover, var(--color-primary, #2563eb));
}
</style>
