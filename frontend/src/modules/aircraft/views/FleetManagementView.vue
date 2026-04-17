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
      <form class="add-aircraft-form" @submit.prevent="onSubmitAdd">
        <!-- Model selector hierarchy (REQ-UI-001–004) -->
        <AircraftModelSelector
          v-model:manufacturer="formManufacturer"
          v-model:model="formModel"
          v-model:icao-type-designator="formIcaoDesignator"
        />

        <!-- Registration -->
        <div class="field-group">
          <label for="registration-input">Registration</label>
          <input
            id="registration-input"
            v-model="formRegistration"
            type="text"
            placeholder="e.g. D-EBPN"
            maxlength="7"
            required
          />
          <span v-if="registrationError" class="field-error" role="alert">{{
            registrationError
          }}</span>
        </div>

        <!-- Owner ID -->
        <div class="field-group">
          <label for="owner-id-input">Owner ID</label>
          <input id="owner-id-input" v-model="formOwnerId" type="text" placeholder="user-123" />
        </div>

        <!-- Cost per hour (REQ-AD-006) -->
        <div class="field-group">
          <label for="cost-per-hour-input">Cost per Hour (optional)</label>
          <input
            id="cost-per-hour-input"
            v-model.number="formCostPerHour"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 150"
          />
        </div>

        <!-- Passenger profiles section (REQ-AC-006) -->
        <fieldset class="passenger-profiles-fieldset">
          <legend>Passenger Profiles (optional)</legend>
          <div
            v-for="(pax, idx) in formPassengerProfiles"
            :key="idx"
            class="passenger-profile-row"
          >
            <input v-model="pax.name" type="text" placeholder="Name" />
            <input v-model.number="pax.standardWeight" type="number" min="1" placeholder="Weight" />
            <select v-model="pax.unit">
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
            <button type="button" class="btn-remove-pax" @click="removePassengerProfile(idx)">
              ✕
            </button>
          </div>
          <button type="button" class="btn-add-pax" @click="addPassengerProfile">
            + Add Passenger Profile
          </button>
        </fieldset>

        <!-- Import from file (REQ-AC-004) -->
        <div class="import-section">
          <label for="import-file-input">Or Import from Exchange File</label>
          <input
            id="import-file-input"
            ref="fileInputRef"
            type="file"
            accept=".json"
            @change="onImportFile"
          />
          <span v-if="importError" class="field-error" role="alert">{{ importError }}</span>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
            {{ isSubmitting ? 'Adding...' : 'Add to Fleet' }}
          </button>
        </div>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { useFleetStore } from '../stores/fleet.store'
import { importProfileFromJson, ImportError } from '../services/profile.import'
import { validateIcaoRegistration } from '../services/profile.validator'
import FleetList from '../components/FleetList.vue'
import AircraftModelSelector from '../components/AircraftModelSelector.vue'

// @IMP-AC-VIEW-008@ (FROM: @REQ-AC-001@, @REQ-AC-004@, @REQ-AC-006@)

const fleetStore = useFleetStore()

// ─── Form state ────────────────────────────────────────────────────────────

const formManufacturer = ref('')
const formModel = ref('')
const formIcaoDesignator = ref('')
const formRegistration = ref('')
const formOwnerId = ref('user-local')
const formCostPerHour = ref<number | undefined>(undefined)
const formPassengerProfiles = ref<
  { name: string; standardWeight: number; unit: 'kg' | 'lbs' }[]
>([])

const registrationError = ref('')
const importError = ref('')
const isSubmitting = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  fleetStore.loadAll()
})

// ─── Passenger profiles ────────────────────────────────────────────────────

function addPassengerProfile(): void {
  formPassengerProfiles.value.push({ name: '', standardWeight: 86, unit: 'kg' })
}

function removePassengerProfile(idx: number): void {
  formPassengerProfiles.value.splice(idx, 1)
}

// ─── Form submission ───────────────────────────────────────────────────────

async function onSubmitAdd(): Promise<void> {
  registrationError.value = ''
  importError.value = ''

  if (!validateIcaoRegistration(formRegistration.value)) {
    registrationError.value =
      'Invalid registration format. Use 2–7 alphanumeric characters (e.g. D-EBPN).'
    return
  }

  isSubmitting.value = true
  try {
    const data: Omit<AircraftProfile, 'id' | 'status' | 'schemaVersion'> = {
      ownerId: formOwnerId.value || 'user-local',
      registration: formRegistration.value.toUpperCase(),
      manufacturer: formManufacturer.value || 'Unknown',
      model: formModel.value || 'Unknown',
      icaoTypeDesignator: formIcaoDesignator.value || 'ZZZZ',
      sourceUnit: 'kg',
      referenceDatumDescription: 'To be defined',
      referenceDatumLocation: 'Station 0',
      shareCode: null,
      weighingReports: [
        {
          bem: 1,
          emptyCg: 0,
          weighingDate: new Date().toISOString().slice(0, 10),
          validFrom: new Date().toISOString().slice(0, 10),
        },
      ],
      loadPoints: [],
      certificationCategories: [
        {
          category: 'Normal',
          mtom: 1,
          maxZeroFuelMass: null,
          graphType: 'arm',
          envelope: [
            { armOrMoment: 0, mass: 0 },
            { armOrMoment: 0, mass: 1 },
            { armOrMoment: 1, mass: 1 },
            { armOrMoment: 1, mass: 0 },
          ],
        },
      ],
      passengerProfiles: formPassengerProfiles.value.filter(
        (p) => p.name.trim() !== '' && p.standardWeight > 0,
      ),
      ...(formCostPerHour.value !== undefined && { costPerHour: formCostPerHour.value }),
    }

    await fleetStore.createProfile(data)

    // Reset form
    formManufacturer.value = ''
    formModel.value = ''
    formIcaoDesignator.value = ''
    formRegistration.value = ''
    formCostPerHour.value = undefined
    formPassengerProfiles.value = []
  } catch (err) {
    if (err instanceof Error) {
      registrationError.value = err.message
    }
  } finally {
    isSubmitting.value = false
  }
}

// ─── Import from file ──────────────────────────────────────────────────────

async function onImportFile(event: Event): Promise<void> {
  importError.value = ''
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
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

.add-aircraft-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-group label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text-primary, #212121);
}

.field-group input,
.field-group select {
  padding: 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--color-surface, #ffffff);
  color: var(--color-text-primary, #212121);
}

.field-group input::placeholder {
  color: var(--color-text-secondary, #9ca3af);
}

.field-error {
  color: var(--color-critical, #dc2626);
  font-size: 0.8rem;
}

.passenger-profiles-fieldset {
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--color-text, #212121);
}

.passenger-profiles-fieldset legend {
  color: var(--color-text-primary, #212121);
  font-weight: 600;
}

.passenger-profile-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.passenger-profile-row input,
.passenger-profile-row select {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 4px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text-primary, #212121);
}

.btn-remove-pax {
  background: none;
  border: none;
  color: var(--color-critical, #ef4444);
  cursor: pointer;
  font-size: 1rem;
}

.btn-add-pax {
  background: none;
  border: 1px dashed var(--color-border, #9ca3af);
  color: var(--color-text-secondary, #6b7280);
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  align-self: flex-start;
}

.import-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.import-section label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text-primary, #212121);
}

.import-section input[type='file'] {
  color: var(--color-text, #212121);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
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
</style>
