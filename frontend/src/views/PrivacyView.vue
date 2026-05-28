<script setup lang="ts">
// @IMP-UI-VIEW-002@ (FROM: @REQ-SYS-014@, @REQ-SYS-015@)
import { computed, onMounted, ref } from 'vue'
import {
  exportAllProfiles,
  serializeBulkExport,
  wipeAllLocalData,
  type WipeReport,
} from '@/modules/aircraft/services/data-rights.service'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'

type Dialog = 'none' | 'wipe'

const fleetStore = useFleetStore()

const dialog = ref<Dialog>('none')
const busy = ref(false)
const lastError = ref<string | null>(null)
const lastWipe = ref<WipeReport | null>(null)
const lastExportAt = ref<string | null>(null)

const profileCount = computed(() => fleetStore.profiles.length)

const wipeConfirmText = ref('')
const WIPE_CONFIRM_PHRASE = 'DELETE ALL DATA'
const wipeConfirmReady = computed(() => wipeConfirmText.value.trim() === WIPE_CONFIRM_PHRASE)

onMounted(() => {
  void fleetStore.loadAll()
})

function clearError(): void {
  lastError.value = null
}

async function refreshFleet(): Promise<void> {
  await fleetStore.loadAll()
}

// ─── Bulk export ─────────────────────────────────────────────────────────
async function onExportAll(): Promise<void> {
  clearError()
  busy.value = true
  try {
    const envelope = await exportAllProfiles()
    const json = serializeBulkExport(envelope)
    triggerJsonDownload(json, envelope.exportedAt)
    lastExportAt.value = envelope.exportedAt
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : 'Export failed: unknown error'
  } finally {
    busy.value = false
  }
}

function triggerJsonDownload(json: string, exportedAt: string): void {
  if (typeof document === 'undefined') return
  const safeStamp = exportedAt.replace(/[:.]/g, '-')
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aerodash-fleet-${safeStamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ─── Delete-All-Data (REQ-SYS-014) ────────────────────────────────────────
function onRequestWipe(): void {
  clearError()
  wipeConfirmText.value = ''
  dialog.value = 'wipe'
}

async function onConfirmWipe(): Promise<void> {
  clearError()
  if (!wipeConfirmReady.value) return
  busy.value = true
  try {
    const report = await wipeAllLocalData()
    lastWipe.value = report
    dialog.value = 'none'
    wipeConfirmText.value = ''
    await refreshFleet()
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : 'Delete-All-Data failed: unknown error'
  } finally {
    busy.value = false
  }
}

function onCancelWipe(): void {
  dialog.value = 'none'
  wipeConfirmText.value = ''
}
</script>

<template>
  <main class="privacy-view" aria-labelledby="privacy-heading">
    <header class="privacy-view__header">
      <h1 id="privacy-heading">Privacy &amp; Local Data</h1>
      <p class="privacy-view__intro">
        AeroDash stores your aircraft fleet and saved session entirely on this device.
        Use the actions below to exercise your data-subject rights — export, retention
        purge, or full deletion — without leaving the app.
      </p>
    </header>

    <p
      v-if="lastError"
      class="privacy-view__error"
      role="alert"
      data-testid="privacy-error"
    >
      {{ lastError }}
    </p>

    <p
      v-if="lastWipe"
      class="privacy-view__notice privacy-view__notice--ok"
      role="status"
      aria-live="polite"
      data-testid="privacy-wipe-notice"
    >
      Local data cleared at {{ lastWipe.clearedAt }} — {{ lastWipe.profilesDeleted }} aircraft
      profile{{ lastWipe.profilesDeleted === 1 ? '' : 's' }} removed.
    </p>

    <p
      v-if="lastExportAt"
      class="privacy-view__notice privacy-view__notice--ok"
      role="status"
      aria-live="polite"
      data-testid="privacy-export-notice"
    >
      Bulk JSON export generated at {{ lastExportAt }}.
    </p>

    <!-- ─── Export-all card ─────────────────────────────────────────── -->
    <section class="card" aria-labelledby="export-heading">
      <h2 id="export-heading">Bulk JSON Export (Art. 15 / Art. 20)</h2>
      <p>
        Export every aircraft profile currently held in IndexedDB to a single
        downloadable JSON file. The export is sorted by registration and includes
        the envelope's schema version so re-imports can validate it safely.
      </p>
      <p class="card__meta" data-testid="profile-count">
        Profiles available: {{ profileCount }}
      </p>
      <button
        type="button"
        class="btn btn-primary"
        data-testid="export-all-btn"
        :disabled="busy || profileCount === 0"
        @click="onExportAll"
      >
        Export all profiles as JSON
      </button>
    </section>

    <!-- ─── Delete-All-Data card ────────────────────────────────────── -->
    <section class="card card--danger" aria-labelledby="wipe-heading">
      <h2 id="wipe-heading">Delete All Local Data (Art. 17)</h2>
      <p>
        Permanently clear every aircraft profile, the saved Mass &amp; Balance
        session payload, and all AeroDash storage keys (IndexedDB, localStorage,
        sessionStorage). This action cannot be undone — export first if you may
        still need the data.
      </p>
      <button
        type="button"
        class="btn btn-danger"
        data-testid="wipe-request-btn"
        :disabled="busy"
        @click="onRequestWipe"
      >
        Delete all local data…
      </button>
    </section>

    <!-- ─── Confirmation dialog: wipe ───────────────────────────────── -->
    <div
      v-if="dialog === 'wipe'"
      class="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wipe-dialog-heading"
      data-testid="wipe-dialog"
    >
      <div class="dialog">
        <h2 id="wipe-dialog-heading">Confirm: delete all local data</h2>
        <p>
          You are about to delete every aircraft profile and clear all AeroDash
          storage on this device. This action cannot be undone.
        </p>
        <p>
          To confirm, type
          <code>{{ WIPE_CONFIRM_PHRASE }}</code> exactly into the field below.
        </p>
        <label class="dialog__field">
          <span>Confirmation phrase</span>
          <input
            v-model="wipeConfirmText"
            type="text"
            data-testid="wipe-confirm-input"
            autocomplete="off"
            spellcheck="false"
            aria-label="Type the confirmation phrase to enable the delete button"
          />
        </label>
        <div class="dialog__actions">
          <button
            type="button"
            class="btn"
            data-testid="wipe-cancel-btn"
            :disabled="busy"
            @click="onCancelWipe"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger"
            data-testid="wipe-confirm-btn"
            :disabled="busy || !wipeConfirmReady"
            @click="onConfirmWipe"
          >
            Delete everything
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.privacy-view {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: var(--color-text, #212121);
}

.privacy-view__header h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  font-weight: 700;
}

.privacy-view__intro {
  margin: 0;
  color: var(--color-text-secondary, #4b5563);
}

.privacy-view__error {
  color: var(--color-critical, #b91c1c);
  background: var(--color-critical-bg, #fee2e2);
  border: 1px solid var(--color-critical, #b91c1c);
  padding: 0.75rem 1rem;
  border-radius: 6px;
}

.privacy-view__notice {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.95rem;
}

.privacy-view__notice--ok {
  color: var(--color-success, #166534);
  background: var(--color-success-bg, #dcfce7);
  border: 1px solid var(--color-success, #166534);
}

.card {
  border: 1px solid var(--color-border, #e5e7eb);
  background: var(--color-surface-card, #f9fafb);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card--danger {
  border-color: var(--color-critical, #b91c1c);
}

.card h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.card__meta {
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.875rem;
  margin: 0;
}

.btn {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  border: 1px solid var(--color-border, #d1d5db);
  background: var(--color-surface, #ffffff);
  cursor: pointer;
  font-size: 0.95rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  color: #ffffff;
}

.btn-secondary {
  background: var(--color-surface, #ffffff);
  color: var(--color-primary, #2563eb);
  border-color: var(--color-primary, #2563eb);
}

.btn-danger {
  background: var(--color-critical, #b91c1c);
  border-color: var(--color-critical, #b91c1c);
  color: #ffffff;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.dialog {
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #111827);
  max-width: 480px;
  width: 100%;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dialog h2 {
  margin: 0;
  font-size: 1.125rem;
}

.dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dialog__field input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 1rem;
}

.dialog__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
</style>
