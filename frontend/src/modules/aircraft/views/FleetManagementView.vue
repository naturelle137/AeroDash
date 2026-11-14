<template>
  <div class="fleet-management-view">
    <h1>Aircraft Fleet Management</h1>

    <!-- Notifications banner -->
    <div
      v-if="fleetStore.notifications.length > 0"
      class="notifications-banner"
      role="alert"
      aria-live="polite"
    >
      <div
        v-for="(note, idx) in fleetStore.notifications"
        :key="idx"
        class="notification"
        :class="`notification--${note.type.toLowerCase()}`"
      >
        <strong>{{ note.code }}</strong>: {{ note.message }}
      </div>
      <button class="btn-clear-notifications" @click="fleetStore.clearNotifications()">
        Dismiss
      </button>
    </div>

    <!-- Fleet list -->
    <section class="fleet-section">
      <h2>Your Fleet</h2>
      <FleetList />
    </section>

    <section class="fleet-section" aria-labelledby="restore-heading" :aria-busy="restoreBusy">
      <h2 id="restore-heading">Restore fleet backup</h2>
      <p>Choose a bulk JSON backup exported from Privacy. Restore adds new unverified drafts;
        review their source data before use. Existing aircraft and preparation stay in place.</p>
      <label for="restore-file">Fleet backup (.json, up to 5 MB / 100 profiles)</label>
      <input id="restore-file" type="file" accept=".json" class="import-file-input"
        :disabled="restoreBusy" @change="onRestoreFile" />
      <p v-if="restoreError" role="alert">{{ restoreError }}</p>
      <div v-if="restorePreview.length" data-testid="restore-preview">
        <p>Review {{ restorePreview.length }} aircraft. All will be imported as Draft.</p>
        <ul><li v-for="profile in restorePreview" :key="profile.id">{{ profile.registration }}</li></ul>
        <button type="button" class="btn btn-primary" :disabled="restoreBusy" @click="onConfirmRestore">
          Confirm restore
        </button>
        <button type="button" class="btn" :disabled="restoreBusy" @click="restorePreview = []; restoreError = ''">
          Cancel restore
        </button>
      </div>
      <p v-if="restoreNotice" role="status">{{ restoreNotice }}</p>
    </section>

    <section class="fleet-section" aria-labelledby="performance-import-help">
      <h2 id="performance-import-help">Supply POH performance tables</h2>
      <p>Use a Fleet row's Download button to download an aircraft exchange JSON. Keep its
        aircraft fields and add or review <code>profile.performanceProfiles</code> in a text editor.
        Import the file below; it becomes a new Draft. Expand “Review imported performance tables”
        on its Fleet row, compare all points against your aircraft's POH/AFM, then use Verify to
        record your initials and the applicable manual revision. <RouterLink to="/performance">Open Performance</RouterLink>
        and explicitly select the reviewed snapshot.</p>
      <p>Supply exactly one table for each <code>flightPhase</code>:
        <code>TakeoffRoll</code>, <code>TakeoffDistance50ft</code>, <code>LandingRoll</code>,
        <code>LandingDistance50ft</code>. Each table has a <code>dataPoints</code> array; each point
        has numeric <code>mass</code>, <code>pressureAltitude</code>,
        <code>temperature</code>, and positive <code>distance</code> in the table's source units.
        Declare <code>sourceUnits: {"mass":"kg","pressureAltitude":"ft","temperature":"°C","distance":"m"}</code>
        on each table. Supported units: mass kg/lb, pressure altitude ft/m, temperature °C/°F,
        distance m/ft; mixed units are supported. All four declarations are required together.
        Unknown fields, incomplete or unsupported declarations are rejected. Without sourceUnits,
        the legacy contract is kg/ft/°C/m, independent of M&amp;B sourceUnit.
        Add an optional <code>sourceReference</code> with manual revision, section/page and conditions.
        Include every mass × altitude × temperature combination once per table.</p>
      <p>No performance values are supplied by AeroDash. Preserve the applicable POH/AFM citation
        in your review's revision entry (include section/page where possible). Check source units,
        configuration and table conditions yourself; do not combine tables for different configurations.
        Missing tables and points outside any table's bounds block calculation. Imported status never
        substitutes for explicit review. Existing profiles without tables remain usable for M&amp;B.</p>
    </section>

    <!-- Add new aircraft -->
    <section class="add-aircraft-section">
      <h2>Add New Aircraft</h2>
      <p class="add-aircraft-intro">
        Use the guided wizard to create a new aircraft profile with real envelope data from your
        POH/AFM. This ensures your Mass &amp; Balance calculations use correct limits.
      </p>
      <div class="add-aircraft-actions">
        <button
          type="button"
          class="btn btn-primary btn-add-wizard"
          @click="goToWizard"
        >
          + Add New Aircraft
        </button>
        <div class="import-section">
          <label for="import-file-input" class="import-label">
            Or import from Exchange File (.json)
          </label>
          <input
            id="import-file-input"
            ref="fileInputRef"
            type="file"
            accept=".json"
            class="import-file-input"
            @change="onImportFile"
          />
          <span v-if="importError" class="field-error" role="alert">{{ importError }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { useFleetStore } from '../stores/fleet.store'
import { importProfileFromJson, validateImportFile, ImportError } from '../services/profile.import'
import FleetList from '../components/FleetList.vue'
import { previewFleetRestore, validateFleetImportFile, assertNoRegistrationConflicts } from '../services/fleet.import'


const fleetStore = useFleetStore()
const router = useRouter()

const importError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const restorePreview = ref<AircraftProfile[]>([])
const restoreError = ref('')
const restoreNotice = ref('')
const restoreBusy = ref(false)

async function onRestoreFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  restorePreview.value = []
  restoreError.value = ''
  restoreNotice.value = ''
  if (!file) return
  restoreBusy.value = true
  try {
    validateFleetImportFile(file)
    const preview = previewFleetRestore(await file.text())
    assertNoRegistrationConflicts(preview, fleetStore.profiles)
    restorePreview.value = preview
  } catch (err) {
    restoreError.value = err instanceof Error ? err.message : 'Restore failed. No aircraft were imported.'
  } finally {
    input.value = ''
    restoreBusy.value = false
  }
}

async function onConfirmRestore(): Promise<void> {
  if (restoreBusy.value || !restorePreview.value.length) return
  restoreBusy.value = true
  restoreError.value = ''
  try {
    const count = restorePreview.value.length
    await fleetStore.restoreProfiles(restorePreview.value)
    restorePreview.value = []
    restoreNotice.value = `Restored ${count} aircraft as Draft. Review their data before use.`
  } catch (err) {
    restoreError.value = err instanceof Error ? `Restore failed: ${err.message}` : 'Restore failed. No aircraft were imported.'
  } finally {
    restoreBusy.value = false
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  fleetStore.loadAll()
})

// ─── Navigation ────────────────────────────────────────────────────────────

function goToWizard(): void {
  router.push({ name: 'fleet-new' })
}

// ─── Import from file ──────────────────────────────────────────────────────

async function onImportFile(event: Event): Promise<void> {
  importError.value = ''
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    // Fail-closed guard: reject oversized / non-JSON files BEFORE reading them
    // into memory.
    validateImportFile(file)
    const text = await file.text()
    const profile = importProfileFromJson(text)
    // Create in fleet via store (handles duplicate detection etc.)
    await fleetStore.createProfile({
      ...profile,
      // Omit id, status, schemaVersion — createProfile assigns these
    } as Omit<AircraftProfile, 'id' | 'status' | 'schemaVersion'>)
  } catch (err) {
    if (err instanceof ImportError) {
      importError.value = err.message
    } else if (err instanceof Error) {
      importError.value = `Import failed: ${err.message}`
    } else {
      importError.value = 'Import failed: unknown error'
    }
  } finally {
    // Reset file input
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
}
</script>

<style scoped>
.fleet-management-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  color: var(--color-text, #212121);
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text-primary, #212121);
}

h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--color-text-primary, #212121);
}

.fleet-section,
.add-aircraft-section {
  min-width: 0;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--color-surface-card, #f9fafb);
  color: var(--color-text, #212121);
}

[aria-labelledby="performance-import-help"] { overflow-wrap: anywhere; }

.notifications-banner {
  background: var(--color-warning-bg, #fef3c7);
  border: 1px solid var(--color-warning, #fcd34d);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--color-warning, #92400e);
}

.notification {
  font-size: 0.875rem;
}

.notification--warning {
  color: var(--color-warning, #92400e);
}

.notification--info {
  color: var(--color-info, #1e40af);
}

.btn-clear-notifications {
  align-self: flex-end;
  background: none;
  border: 1px solid var(--color-warning, #d97706);
  color: var(--color-warning, #92400e);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.add-aircraft-intro {
  margin: 0 0 1.25rem;
  font-size: 0.9375rem;
  color: var(--color-text-secondary, #6b7280);
}

.add-aircraft-actions {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.btn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #ffffff);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover, #2563eb);
}

.btn-add-wizard {
  align-self: flex-start;
  padding: 0.75rem 1.5rem;
  font-size: 1.0625rem;
}

.import-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--color-border, #e5e7eb);
}

.import-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.import-file-input {
  min-height: 44px;
  max-width: 100%;
  color: var(--color-text, #212121);
}

.import-file-input::file-selector-button {
  min-height: 44px;
  cursor: pointer;
}

a[href="/performance"] {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  max-width: 100%;
}

.field-error {
  color: var(--color-critical, #dc2626);
  font-size: 0.8rem;
}
</style>
