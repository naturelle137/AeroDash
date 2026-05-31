<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="disclaimer-gate__backdrop"
      data-testid="disclaimer-gate"
    >
      <div
        ref="dialogEl"
        class="disclaimer-gate"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="bodyId"
        tabindex="-1"
        @keydown.tab.prevent="trapFocusOnAcceptBtn"
      >
        <h2 :id="titleId" class="disclaimer-gate__title">
          AeroDash is Advisory Only
        </h2>

        <div :id="bodyId" class="disclaimer-gate__body">
          <p class="disclaimer-gate__lede">
            <strong>NO CERTIFIED AVIATION DEVICE. USE AT YOUR OWN RISK.</strong>
          </p>

          <p>
            AeroDash is an open-source flight preparation aid. It is
            <strong>not</strong> certified by EASA, FAA, or any aviation
            authority. By continuing you confirm that you are the Pilot in
            Command and that you accept the following non-negotiable
            responsibilities:
          </p>

          <ul class="disclaimer-gate__list">
            <li>
              <strong>Verify every calculation</strong> (Mass &amp; Balance,
              Performance, Fuel &amp; Endurance) against the official POH /
              AFM for the specific airframe (by serial number) before each
              flight.
            </li>
            <li>
              <strong>The official handbook always takes precedence.</strong>
              If AeroDash and the POH disagree, the POH wins — every time.
            </li>
            <li>
              AeroDash <strong>does not replace</strong> mandatory flight
              briefings (METAR / TAF / NOTAM) from official sources.
            </li>
            <li>
              Aircraft profiles, environmental models, and algorithms may
              contain errors or be out of date.
            </li>
          </ul>

          <p class="disclaimer-gate__legal">
            Full text:
            <a href="/DISCLAIMER.md" target="_blank" rel="noopener">DISCLAIMER.md</a>
            ·
            <a href="/LICENSE.txt" target="_blank" rel="noopener">EUPL-1.2 (Articles 7–8)</a>
          </p>
        </div>

        <div class="disclaimer-gate__actions">
          <button
            ref="acceptBtn"
            type="button"
            class="disclaimer-gate__btn"
            data-testid="disclaimer-gate-accept"
            @click="onAccept"
          >
            I am the Pilot in Command — I understand and accept
          </button>
        </div>

        <p v-if="storageUnavailable" class="disclaimer-gate__storage-advisory" role="status">
          Local storage is unavailable in this browser. The acknowledgement
          cannot be remembered between launches and you will be re-prompted
          each time.
        </p>

        <p
          v-if="writeFailed && !storageUnavailable"
          class="disclaimer-gate__storage-advisory"
          role="alert"
          data-testid="disclaimer-gate-write-failed"
        >
          Could not save your acknowledgement. Your browser refused the
          write — you will be re-prompted on the next launch.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// @IMP-UI-SHARED-008@ (FROM: @REQ-SYS-016@)
// @IMP-UI-SHARED-009@ (FROM: @REQ-SYS-016@)
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const localId = useId() ?? 'disclaimer-gate'
const titleId = `${localId}-title`
const bodyId = `${localId}-body`

const props = defineProps<{
  open: boolean
  storageUnavailable?: boolean
  writeFailed?: boolean
}>()

const emit = defineEmits<{
  accept: []
}>()

const dialogEl = ref<HTMLElement | null>(null)
const acceptBtn = ref<HTMLButtonElement | null>(null)
let lastFocused: HTMLElement | null = null

watch(
  () => dialogEl.value,
  async (el) => {
    if (el) {
      lastFocused = document.activeElement as HTMLElement | null
      await nextTick()
      acceptBtn.value?.focus()
    } else if (lastFocused) {
      lastFocused.focus?.()
      lastFocused = null
    }
  },
)

function onAccept(): void {
  emit('accept')
}

function trapFocusOnAcceptBtn(): void {
  acceptBtn.value?.focus()
}

// Global capture-phase backstop: re-trap Tab if focus ever escapes the dialog
// subtree, even should the App-shell `inert` guard regress.
function trapTabGlobally(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key !== 'Tab') return
  const active = document.activeElement
  if (dialogEl.value && active && dialogEl.value.contains(active)) return
  event.preventDefault()
  acceptBtn.value?.focus()
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      document.addEventListener('keydown', trapTabGlobally, true)
    } else {
      document.removeEventListener('keydown', trapTabGlobally, true)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', trapTabGlobally, true)
})
</script>

<style scoped>
.disclaimer-gate__backdrop {
  position: fixed;
  inset: 0;
  z-index: 500; /* above ConfirmDialog (400) — this is the master gate */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4, 1rem);
  background: rgba(0, 0, 0, 0.85);
  overflow-y: auto;
}

.disclaimer-gate {
  width: 100%;
  max-width: 36rem;
  max-height: calc(100vh - 2 * var(--space-4, 1rem));
  overflow-y: auto;
  padding: var(--space-6, 2rem);
  border-radius: var(--radius-xl, 12px);
  background: var(--color-surface-card, var(--color-surface, #fff));
  color: var(--color-text-primary, #212121);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  border: 2px solid var(--color-warning, #b45309);
}

.disclaimer-gate:focus-visible {
  outline: 2px solid var(--color-focus, var(--color-primary, #3b82f6));
  outline-offset: 4px;
}

.disclaimer-gate__title {
  margin: 0 0 var(--space-4, 1rem);
  font-size: var(--text-xl, 1.25rem);
  font-weight: 800;
  color: var(--color-warning, #b45309);
  text-align: center;
}

.disclaimer-gate__body {
  font-size: var(--text-sm, 0.9375rem);
  line-height: 1.6;
}

.disclaimer-gate__body p {
  margin: 0 0 var(--space-3, 0.75rem);
}

.disclaimer-gate__lede {
  font-size: var(--text-base, 1rem);
  text-align: center;
}

.disclaimer-gate__list {
  margin: 0 0 var(--space-4, 1rem);
  padding-left: var(--space-5, 1.5rem);
}

.disclaimer-gate__list li {
  margin-bottom: var(--space-2, 0.5rem);
}

.disclaimer-gate__legal {
  margin-top: var(--space-4, 1rem);
  font-size: var(--text-xs, 0.8125rem);
  color: var(--color-text-secondary, #4b5563);
  text-align: center;
}

.disclaimer-gate__legal a {
  color: inherit;
  text-decoration: underline;
}

.disclaimer-gate__actions {
  display: flex;
  justify-content: center;
  margin-top: var(--space-5, 1.5rem);
}

.disclaimer-gate__btn {
  min-height: 56px; /* deliberately oversized for cockpit / gloved use */
  padding: var(--space-3, 0.75rem) var(--space-6, 2rem);
  border-radius: var(--radius-md, 6px);
  font: inherit;
  font-size: var(--text-base, 1rem);
  font-weight: 700;
  cursor: pointer;
  border: 2px solid var(--color-primary, #3b82f6);
  background: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #fff);
  transition:
    background var(--transition-fast, 150ms ease),
    border-color var(--transition-fast, 150ms ease);
}

.disclaimer-gate__btn:hover {
  background: var(--color-primary-hover, #2563eb);
  border-color: var(--color-primary-hover, #2563eb);
}

.disclaimer-gate__btn:focus-visible {
  outline: 3px solid var(--color-focus, #fff);
  outline-offset: 2px;
}

.disclaimer-gate__storage-advisory {
  margin-top: var(--space-4, 1rem);
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border-left: 3px solid var(--color-warning, #b45309);
  background: var(--color-surface-alt, #fef3c7);
  color: var(--color-text-primary, #212121);
  font-size: var(--text-xs, 0.8125rem);
  line-height: 1.5;
}
</style>
