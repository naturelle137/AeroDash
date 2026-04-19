<template>
  <!-- @IMP-AC-VIEW-005@ (FROM: @REQ-AC-001@, @REQ-AC-004@, @REQ-AC-005@) -->
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
            type="button"
            class="btn btn-primary btn-select"
            :disabled="activeStore.activeProfile?.id === profile.id"
            @click="onSelectActive(profile)"
          >
            {{ activeStore.activeProfile?.id === profile.id ? 'Active' : 'Select' }}
          </button>

          <!-- Verify draft profile -->
          <button
            v-if="profile.status === 'draft'"
            type="button"
            class="btn btn-success btn-verify"
            @click="onVerify(profile.id)"
          >
            Verify
          </button>

          <!-- Download profile as exchange file (.aerodash.json) -->
          <button
            type="button"
            class="icon-btn icon-btn--download btn-download"
            :aria-label="`Download ${profile.registration} exchange file`"
            :title="`Download ${profile.registration}`"
            @click="onDownload(profile)"
          >
            <svg
              class="icon-btn__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>

          <!-- Edit profile (draft: in-place save; verified: saving creates a new Draft) -->
          <button
            type="button"
            class="icon-btn icon-btn--edit btn-secondary"
            :aria-label="`Edit ${profile.registration}`"
            :title="`Edit ${profile.registration}`"
            @click="onEdit(profile.id)"
          >
            <svg
              class="icon-btn__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
            </svg>
          </button>

          <!-- Delete profile -->
          <button
            type="button"
            class="icon-btn icon-btn--danger btn-danger"
            :aria-label="`Delete ${profile.registration}`"
            :title="`Delete ${profile.registration}`"
            @click="onDelete(profile.id, profile.registration)"
          >
            <svg
              class="icon-btn__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { useFleetStore } from '../stores/fleet.store'
import { useActiveAircraftStore } from '../stores/active-aircraft.store'
import { downloadProfileAsJson } from '../services/profile.import'
import ProfileStatusBadge from './ProfileStatusBadge.vue'

// @IMP-AC-VIEW-006@ (FROM: @REQ-AC-001@, @REQ-AC-004@, @REQ-AC-005@)

const router = useRouter()
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

function onEdit(id: string): void {
  router.push({ name: 'fleet-edit', params: { id } })
}

function onDownload(profile: AircraftProfile): void {
  downloadProfileAsJson(profile)
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
  color: var(--color-text-secondary, #6b7280);
}

.error-state {
  border: 1px solid var(--color-critical, #fecaca);
  border-radius: 6px;
  background: var(--color-critical-bg, #fef2f2);
  color: var(--color-critical, #991b1b);
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
  background: var(--color-critical, #dc2626);
  color: var(--neutral-0, #ffffff);
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
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text-primary, #212121);
  gap: 1rem;
  transition: border-color var(--transition-fast, 150ms ease),
    box-shadow var(--transition-fast, 150ms ease);
}

.profile-item:hover {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.profile-item--active {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-bg, #eff6ff);
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
  color: var(--color-text-primary, #212121);
}

.profile-item__model {
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-item__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* ─── Labelled buttons (Select / Verify) ─── */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem; /* 44px — WCAG AAA touch-target minimum */
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast, 150ms ease),
    box-shadow var(--transition-fast, 150ms ease),
    transform var(--transition-fast, 150ms ease);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn:focus-visible {
  outline: 2px solid var(--color-focus, var(--color-primary, #3b82f6));
  outline-offset: 2px;
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #ffffff);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover, #2563eb);
}

.btn-success {
  background: var(--color-success, #10b981);
  color: var(--neutral-0, #ffffff);
}

.btn-success:hover:not(:disabled) {
  filter: brightness(1.05);
}

/* ─── Icon-only buttons (Download / Edit / Delete) ───
 *
 * Sized generously for touch use under cockpit vibration:
 *   • 2.75rem × 2.75rem (≈44 px) meets WCAG 2.2 SC 2.5.8 AAA target size.
 *   • 0.75rem gap between siblings prevents mis-tap.
 *   • Clear focus ring + hover colour differentiation for gloved use.
 */

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: background var(--transition-fast, 150ms ease),
    color var(--transition-fast, 150ms ease),
    border-color var(--transition-fast, 150ms ease),
    box-shadow var(--transition-fast, 150ms ease),
    transform var(--transition-fast, 150ms ease);
}

.icon-btn__icon {
  width: 1.375rem; /* 22px — readable from arm's length */
  height: 1.375rem;
}

.icon-btn:hover:not(:disabled) {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.icon-btn:focus-visible {
  outline: 2px solid var(--color-focus, var(--color-primary, #3b82f6));
  outline-offset: 2px;
}

.icon-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.icon-btn--download:hover:not(:disabled) {
  color: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-bg, #eff6ff);
}

.icon-btn--edit:hover:not(:disabled) {
  color: var(--color-text-primary, #1f2937);
  border-color: var(--color-text-primary, #1f2937);
  background: var(--color-surface-hover, #f3f4f6);
}

.icon-btn--danger {
  color: var(--color-critical, #dc2626);
  border-color: var(--color-border, #e5e7eb);
}

.icon-btn--danger:hover:not(:disabled) {
  color: var(--neutral-0, #ffffff);
  background: var(--color-critical, #dc2626);
  border-color: var(--color-critical, #dc2626);
}

/* Keep .btn-danger selector alive for legacy test selectors (Delete target). */
.btn-danger {
  /* visual inherits from .icon-btn--danger */
}

.btn-secondary {
  /* visual inherits from .icon-btn / .icon-btn--edit */
}

/* ─── Mobile: stack identity above actions so buttons don't overlap the registration ─── */
@media (max-width: 600px) {
  .profile-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .profile-item__info {
    flex-wrap: wrap;
  }

  .profile-item__actions {
    justify-content: space-between;
    gap: 0.75rem;
  }

  .profile-item__actions .btn {
    flex: 1 1 auto;
    min-width: 5rem;
  }

  .profile-item__actions .icon-btn {
    width: 3rem;
    height: 3rem;
    flex: 0 0 auto;
  }

  .profile-item__actions .icon-btn__icon {
    width: 1.5rem;
    height: 1.5rem;
  }
}
</style>
