<template>
  <!-- @IMP-AC-VIEW-007@ (FROM: @REQ-AC-001@, @REQ-AC-004@, @REQ-AC-005@, @REQ-AC-006@) -->
  <main class="fleet-management-view">
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
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { useFleetStore } from '../stores/fleet.store'
import { importProfileFromJson, validateImportFile, ImportError } from '../services/profile.import'
import FleetList from '../components/FleetList.vue'

// @IMP-AC-VIEW-008@ (FROM: @REQ-AC-001@, @REQ-AC-004@, @REQ-AC-006@)

const fleetStore = useFleetStore()
const router = useRouter()

const importError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

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
    // into memory (CS-003 / TECH-008).
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
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--color-surface-card, #f9fafb);
  color: var(--color-text, #212121);
}

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
  color: var(--color-text, #212121);
}

.field-error {
  color: var(--color-critical, #dc2626);
  font-size: 0.8rem;
}
</style>
