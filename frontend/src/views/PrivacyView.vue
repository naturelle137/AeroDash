<script setup lang="ts">
// @IMP-UI-VIEW-002@ (FROM: @REQ-SYS-014@, @REQ-SYS-015@, @DES-ARCH-011@, @DES-ARCH-012@)
import { computed, onMounted, ref } from 'vue'
import {
  exportAllProfiles,
  serializeBulkExport,
  wipeAllLocalData,
  type WipeReport,
} from '@/modules/aircraft/services/data-rights.service'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import { useSessionPersistenceStore } from '@/stores/session-persistence.store'

type Dialog = 'none' | 'wipe'

const fleetStore = useFleetStore()
const sessionStore = useSessionPersistenceStore()

const dialog = ref<Dialog>('none')
const busy = ref(false)
const lastError = ref<string | null>(null)
const lastWipe = ref<WipeReport | null>(null)
const lastExportAt = ref<string | null>(null)
const lastExportOmitted = ref(0)

const profileCount = computed(() => fleetStore.profiles.length)
// A failed fleet load leaves `profiles` empty, which would otherwise read as
// "0 profiles" — dangerously misleading on the screen that controls erasure
// and export. Surface the failure so the pilot does not mistake a storage
// error for "no data to protect".
const fleetLoadFailed = computed(() => fleetStore.fleetLoadState === 'ERROR')
// Rows this build cannot read (future schemaVersion / corrupt). They are
// excluded from a bulk export but still destroyed by a wipe, so they must be
// surfaced independently of whether the pilot has exported (DES-ARCH-011 §4.1).
const unreadableCount = computed(() => fleetStore.unreadableProfileCount)

const wipeNotice = computed(() => {
  const r = lastWipe.value
  if (r === null) return ''
  if (r.profilesDeleted === null) {
    return `Local data cleared at ${r.clearedAt} (profiles removed: count unavailable).`
  }
  const n = r.profilesDeleted
  return `Local data cleared at ${r.clearedAt} — ${n} aircraft profile${n === 1 ? '' : 's'} removed.`
})

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
  lastWipe.value = null
  lastExportAt.value = null
  lastExportOmitted.value = 0
  busy.value = true
  try {
    const { envelope, omitted } = await exportAllProfiles()
    const json = serializeBulkExport(envelope)
    const downloaded = triggerJsonDownload(json, envelope.exportedAt)
    if (!downloaded) return
    lastExportAt.value = envelope.exportedAt
    lastExportOmitted.value = omitted.length
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : 'Export failed: unknown error'
  } finally {
    busy.value = false
  }
}

/** Returns `true` once the download has been kicked off, `false` outside a DOM. */
function triggerJsonDownload(json: string, exportedAt: string): boolean {
  if (typeof document === 'undefined') return false
  const safeStamp = exportedAt.replace(/[:.]/g, '-')
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aerodash-fleet-${safeStamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revocation: some browsers drop the download if the object URL is
  // revoked synchronously in the same tick as click().
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return true
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
  lastWipe.value = null
  lastExportAt.value = null
  lastExportOmitted.value = 0
  busy.value = true
  try {
    // Cancel any pending debounced session autosave first, so a timer scheduled
    // just before this wipe cannot re-write the `aerodash:session:payload` key
    // after the fact (REQ-SYS-014 — erasure must be irrecoverable). The key
    // itself is left for wipeAllLocalData()'s sweep to remove and count.
    sessionStore.cancelPendingSave()
    const report = await wipeAllLocalData()
    dialog.value = 'none'
    wipeConfirmText.value = ''
    await refreshFleet()
    if (report.complete) {
      lastWipe.value = report
    } else {
      // REQ-SYS-014: report the failure; never signal a complete erasure while
      // any data remains. Show the CRITICAL banner, not the success notice.
      lastWipe.value = null
      lastError.value = formatIncompleteWipe(report)
    }
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : 'Delete-All-Data failed: unknown error'
  } finally {
    busy.value = false
  }
}

function formatIncompleteWipe(report: WipeReport): string {
  const n = report.failures.length
  return (
    `Erasure incomplete — ${n} item${n === 1 ? '' : 's'} could not be deleted and ` +
    `may remain on this device. Retry the deletion, then use your browser's ` +
    `“Clear site data” for this site if it still fails.`
  )
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
        Use the actions below to exercise your data-subject rights — export or full
        deletion — without leaving the app.
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
      v-if="fleetLoadFailed"
      class="privacy-view__error"
      role="alert"
      data-testid="privacy-fleet-load-error"
    >
      Your saved fleet could not be read from this device's storage, so the
      profile count below is unavailable — it does not mean your data is gone.
      Reload AeroDash and try again before exporting or deleting.
    </p>

    <p
      v-if="unreadableCount > 0"
      class="privacy-view__notice privacy-view__notice--warn"
      role="alert"
      data-testid="privacy-unreadable-warning"
    >
      Warning: {{ unreadableCount }} profile{{ unreadableCount === 1 ? '' : 's' }} saved on this
      device cannot be read by this version of AeroDash and will NOT be included in an export.
      Update AeroDash to recover {{ unreadableCount === 1 ? 'it' : 'them' }} before deleting all
      data — a wipe erases {{ unreadableCount === 1 ? 'it' : 'them' }} permanently.
    </p>

    <p
      v-if="lastWipe"
      class="privacy-view__notice privacy-view__notice--ok"
      role="status"
      aria-live="polite"
      data-testid="privacy-wipe-notice"
    >
      {{ wipeNotice }}
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

    <p
      v-if="lastExportAt && lastExportOmitted > 0"
      class="privacy-view__notice privacy-view__notice--warn"
      role="alert"
      data-testid="privacy-export-omitted"
    >
      Warning: {{ lastExportOmitted }} profile{{ lastExportOmitted === 1 ? '' : 's' }} could
      not be included in this export (saved by a newer app version or unreadable). The export
      is therefore not a complete copy — update AeroDash to recover them before deleting all
      data.
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
        Profiles available: {{ fleetLoadFailed ? 'unavailable' : profileCount }}
      </p>
      <button
        type="button"
        class="btn btn-primary"
        data-testid="export-all-btn"
        :disabled="busy || fleetLoadFailed || profileCount === 0"
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
        <p
          v-if="fleetLoadFailed"
          class="dialog__warn"
          role="alert"
          data-testid="wipe-load-error-warning"
        >
          Your saved fleet could not be read from this device's storage, so it could not be
          exported and its contents are unknown here. Deleting now still erases whatever
          remains — permanently and with no backup. Reload AeroDash and export first if you
          may still need the data.
        </p>
        <p
          v-if="unreadableCount > 0"
          class="dialog__warn"
          role="alert"
          data-testid="wipe-unreadable-warning"
        >
          {{ unreadableCount }} profile{{ unreadableCount === 1 ? '' : 's' }} on this device
          cannot be read by this version and {{ unreadableCount === 1 ? 'is' : 'are' }} not
          included in any export. Deleting now destroys
          {{ unreadableCount === 1 ? 'it' : 'them' }} permanently — update AeroDash first to
          recover {{ unreadableCount === 1 ? 'it' : 'them' }}.
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

.privacy-view__notice--warn {
  color: var(--color-warning, #92400e);
  background: var(--color-warning-bg, #fef3c7);
  border: 1px solid var(--color-warning, #92400e);
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

.dialog__warn {
  margin: 0;
  padding: 0.625rem 0.875rem;
  border-radius: 6px;
  color: var(--color-warning, #92400e);
  background: var(--color-warning-bg, #fef3c7);
  border: 1px solid var(--color-warning, #92400e);
  font-size: 0.9rem;
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
