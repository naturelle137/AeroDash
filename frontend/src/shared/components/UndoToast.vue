<!-- @IMP-UI-SHARED-005@ (FROM: @REQ-UI-011@) -->
<template>
  <!--
    Transient "undo" toast for recoverable destructive actions (delete aircraft,
    reset payload). After the action commits, this surfaces a short-lived bar
    with an UNDO control; if the pilot taps it within the window the parent
    restores the prior state. Auto-dismisses after `duration` ms.

    A live-region (role="status") so a screen reader announces both the message
    and the recovery affordance. The countdown is purely cosmetic.
  -->
  <Teleport to="body">
    <Transition name="undo-toast">
      <div
        v-if="open"
        class="undo-toast"
        role="status"
        aria-live="polite"
      >
        <span class="undo-toast__message">{{ message }}</span>
        <button
          ref="undoBtn"
          type="button"
          class="undo-toast__action"
          @click="onUndo"
        >
          {{ actionLabel }}
        </button>
        <button
          type="button"
          class="undo-toast__dismiss"
          :aria-label="dismissLabel"
          @click="onDismiss"
        >
          &times;
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// @IMP-UI-SHARED-006@ (FROM: @REQ-UI-011@)
import { onBeforeUnmount, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    message: string
    actionLabel?: string
    dismissLabel?: string
    /** Auto-dismiss window in ms (5–10 s). */
    duration?: number
  }>(),
  {
    actionLabel: 'Undo',
    dismissLabel: 'Dismiss',
    duration: 7000,
  },
)

const emit = defineEmits<{
  /** Pilot tapped UNDO within the window. */
  undo: []
  /** Window elapsed or pilot dismissed — the action is now permanent. */
  dismiss: []
}>()

let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

watch(
  () => props.open,
  (isOpen) => {
    clearTimer()
    if (isOpen) {
      timer = setTimeout(() => {
        emit('dismiss')
      }, props.duration)
    }
  },
  { immediate: true },
)

function onUndo(): void {
  clearTimer()
  emit('undo')
}

function onDismiss(): void {
  clearTimer()
  emit('dismiss')
}

onBeforeUnmount(clearTimer)
</script>

<style scoped>
.undo-toast {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 1.5rem);
  transform: translateX(-50%);
  z-index: 420; /* above the confirm dialog backdrop */
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  max-width: calc(100vw - 2rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border-radius: var(--radius-lg, 10px);
  background: var(--color-surface-inverse, #1f2933);
  color: var(--color-text-inverse, #f8fafc);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.undo-toast__message {
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
}

.undo-toast__action {
  min-height: 36px;
  padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
  border: 1px solid transparent;
  border-radius: var(--radius-md, 6px);
  background: transparent;
  color: var(--color-primary-on-dark, #93c5fd);
  font: inherit;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  flex-shrink: 0;
}

.undo-toast__action:hover {
  background: rgba(255, 255, 255, 0.1);
}

.undo-toast__action:focus-visible {
  outline: 2px solid var(--color-primary-on-dark, #93c5fd);
  outline-offset: 2px;
}

.undo-toast__dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-full, 999px);
  background: transparent;
  color: inherit;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.8;
}

.undo-toast__dismiss:hover {
  opacity: 1;
}

.undo-toast__dismiss:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* Enter/leave transition — slide up + fade. */
.undo-toast-enter-active,
.undo-toast-leave-active {
  transition:
    opacity var(--transition-fast, 150ms ease),
    transform var(--transition-fast, 150ms ease);
}

.undo-toast-enter-from,
.undo-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 1rem);
}

@media (prefers-reduced-motion: reduce) {
  .undo-toast-enter-active,
  .undo-toast-leave-active {
    transition: none;
  }
}
</style>
