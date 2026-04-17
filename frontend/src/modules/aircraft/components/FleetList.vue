<template>
  <!-- @IMP-AC-VIEW-005@ (FROM: @REQ-AC-001@, @REQ-AC-005@) -->
  <div class="fleet-list">
    <div v-if="fleetStore.fleetLoadState === 'LOADING'" class="loading-state">Loading fleet...</div>

    <div
      v-else-if="fleetStore.fleetLoadState === 'ERROR'"
      class="error-state"
      role="alert"
      aria-live="assertive"
    >
      <p>Could not load your fleet from device storage.</p>
      <p v-if="fleetStore.fleetLoadError" class="error-state__detail">{{ fleetStore.fleetLoadError }}</p>
      <button type="button" class="btn btn-retry" @click="fleetStore.loadAll()">Retry</button>
    </div>

    <div v-else-if="fleetStore.profiles.length === 0" class="empty-state">
      No aircraft profiles yet. Add your first aircraft above.
    </div>

    <ul v-else class="profiles-list" role="list">
      <li
        v-for="profile in fleetStore.profiles"
        :key="profile.id"
        class="profile-item"
        :class="{ 'profile-item--active': activeStore.activeProfile?.id === profile.id }"
        role="listitem"
      >
        <div class="profile-item__info">
          <span class="profile-item__registration">{{ profile.registration }}</span>
          <span class="profile-item__model">{{ profile.manufacturer }} {{ profile.model }}</span>
          <ProfileStatusBadge :status="profile.status" />
        </div>

        <div class="profile-item__actions">
          <!-- Select as active aircraft (refs #153) -->
          <button
            class="btn btn-primary"
            :disabled="activeStore.activeProfile?.id === profile.id"
            @click="onSelectActive(profile)"
          >
            {{ activeStore.activeProfile?.id === profile.id ? 'Active' : 'Select' }}
          </button>

          <!-- Verify draft profile -->
          <button
            v-if="profile.status === 'draft'"
            class="btn btn-success"
            @click="onVerify(profile.id)"
          >
            Verify
          </button>

          <!-- Edit verified profile (creates new Draft) -->
          <button
            v-if="profile.status === 'verified'"
            class="btn btn-secondary"
            @click="onEditVerified(profile.id)"
          >
            Edit
          </button>

          <!-- Delete profile -->
          <button class="btn btn-danger" @click="onDelete(profile.id, profile.registration)">
            Delete
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { useFleetStore } from '../stores/fleet.store'
import { useActiveAircraftStore } from '../stores/active-aircraft.store'
import ProfileStatusBadge from './ProfileStatusBadge.vue'

// @IMP-AC-VIEW-006@ (FROM: @REQ-AC-001@, @REQ-AC-005@)

const fleetStore = useFleetStore()
const activeStore = useActiveAircraftStore()

function onSelectActive(profile: AircraftProfile): void {
  // Emit draft warning if profile is a Draft (REQ-AC-005)
  fleetStore.checkDraftWarning(profile)
  activeStore.setActiveProfile(profile)
}

async function onVerify(id: string): Promise<void> {
  await fleetStore.verifyProfile(id)
}

async function onEditVerified(id: string): Promise<void> {
  await fleetStore.editVerifiedProfile(id, {})
}

async function onDelete(id: string, registration: string): Promise<void> {
  if (confirm(`Delete aircraft "${registration}"? This action cannot be undone.`)) {
    // If deleting the active profile, clear it
    if (activeStore.activeProfile?.id === id) {
      activeStore.clearActive()
    }
    await fleetStore.deleteProfile(id)
  }
}
</script>

<style scoped>
.fleet-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.loading-state,
.empty-state,
.error-state {
  padding: 1rem;
  text-align: center;
  color: #6b7280;
}

.error-state {
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #991b1b;
}

.error-state__detail {
  font-size: 0.8rem;
  margin: 0.5rem 0 0 0;
  word-break: break-word;
}

.btn-retry {
  margin-top: 0.75rem;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  font-weight: 500;
  background: #dc2626;
  color: white;
}

.profiles-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  gap: 1rem;
}

.profile-item--active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.profile-item__info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.profile-item__registration {
  font-weight: 700;
  font-size: 1rem;
  white-space: nowrap;
}

.profile-item__model {
  color: #6b7280;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-item__actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}
</style>
