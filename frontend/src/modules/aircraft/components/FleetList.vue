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
            class="icon-btn icon-btn--select btn-primary btn-select"
            :class="{ 'icon-btn--select-active': activeStore.activeProfile?.id === profile.id }"
            :disabled="activeStore.activeProfile?.id === profile.id"
            :aria-label="
              activeStore.activeProfile?.id === profile.id
                ? `${profile.registration} is the active aircraft`
                : `Select ${profile.registration} as active aircraft`
            "
            :aria-pressed="activeStore.activeProfile?.id === profile.id ? 'true' : 'false'"
            :title="
              activeStore.activeProfile?.id === profile.id
                ? `Active: ${profile.registration}`
                : `Select ${profile.registration}`
            "
            @click="onSelectActive(profile)"
          >
            <!-- Active: filled check-circle.  Inactive: outline check-circle. -->
            <svg
              v-if="activeStore.activeProfile?.id === profile.id"
              class="icon-btn__icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 8.3-5.4 5.4a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 1 1 1.4-1.4l1.9 1.9 4.7-4.7a1 1 0 0 1 1.4 1.4Z"
              />
            </svg>
            <svg
              v-else
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
              <circle cx="12" cy="12" r="9" />
              <path d="m8 12 3 3 5-6" />
            </svg>
            <span class="sr-only">
              {{ activeStore.activeProfile?.id === profile.id ? 'Active' : 'Select' }}
            </span>
          </button>

          <!-- Verify draft profile -->
          <button
            v-if="profile.status === 'draft'"
            type="button"
            class="icon-btn icon-btn--verify btn-success btn-verify"
            :aria-label="`Verify ${profile.registration}`"
            :title="`Verify ${profile.registration}`"
            @click="onVerify(profile.id)"
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
              <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span class="sr-only">Verify</span>
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

          <!-- Delete profile — disabled while this profile is the active
               aircraft so a stray tap can't destroy the airframe currently
               feeding the M&B Go/No-Go computation (UX-001). -->
          <button
            type="button"
            class="icon-btn icon-btn--danger btn-danger"
            :disabled="activeStore.activeProfile?.id === profile.id"
            :aria-label="
              activeStore.activeProfile?.id === profile.id
                ? `Cannot delete ${profile.registration} — it is the active aircraft`
                : `Delete ${profile.registration}`
            "
            :title="
              activeStore.activeProfile?.id === profile.id
                ? `Active aircraft cannot be deleted`
                : `Delete ${profile.registration}`
            "
            @click="onDelete(profile)"
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

    <!-- UX-001: in-app delete confirmation (replaces native confirm) -->
    <ConfirmDialog
      :open="pendingDelete !== null"
      title="Delete aircraft profile?"
      :message="
        pendingDelete
          ? `Delete ‘${pendingDelete.registration}’ (${pendingDelete.manufacturer} ${pendingDelete.model})? This removes its envelope, weighing reports and burn sequences. You can undo for a few seconds.`
          : ''
      "
      confirm-label="Delete"
      cancel-label="Keep"
      variant="danger"
      @confirm="onConfirmDelete"
      @cancel="onCancelDelete"
    />

    <!-- UX-001: post-delete undo toast (restores the profile if tapped) -->
    <UndoToast
      :open="recentlyDeleted !== null"
      :message="
        recentlyDeleted ? `Deleted ‘${recentlyDeleted.registration}’` : ''
      "
      action-label="Undo"
      :duration="8000"
      @undo="onUndoDelete"
      @dismiss="onDismissUndo"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { useFleetStore } from '../stores/fleet.store'
import { useActiveAircraftStore } from '../stores/active-aircraft.store'
import { fleetRepository } from '../services/fleet.repository'
import { downloadProfileAsJson } from '../services/profile.import'
import ProfileStatusBadge from './ProfileStatusBadge.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import UndoToast from '@/shared/components/UndoToast.vue'

// @IMP-AC-VIEW-006@ (FROM: @REQ-AC-001@, @REQ-AC-004@, @REQ-AC-005@)

const router = useRouter()
const fleetStore = useFleetStore()
const activeStore = useActiveAircraftStore()

// ─── UX-001: confirm-then-undo destructive delete ──────────────────────────
// @IMP-AC-VIEW-019@ (FROM: @REQ-AC-001@)
//
// `pendingDelete` drives the confirmation modal; once confirmed the profile is
// removed and stashed in `recentlyDeleted` so the undo toast can re-create the
// exact record (same id) via the repository, then rehydrate the store. The
// active aircraft can never reach this flow — its delete control is disabled.

const pendingDelete = ref<AircraftProfile | null>(null)
const recentlyDeleted = ref<AircraftProfile | null>(null)

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

function onDelete(profile: AircraftProfile): void {
  // Active aircraft is guarded by the disabled control; defend in depth.
  if (activeStore.activeProfile?.id === profile.id) return
  pendingDelete.value = profile
}

function onCancelDelete(): void {
  pendingDelete.value = null
}

async function onConfirmDelete(): Promise<void> {
  const profile = pendingDelete.value
  pendingDelete.value = null
  if (!profile) return
  await fleetStore.deleteProfile(profile.id)
  // Open the undo window with the full profile snapshot.
  recentlyDeleted.value = profile
}

async function onUndoDelete(): Promise<void> {
  const profile = recentlyDeleted.value
  recentlyDeleted.value = null
  if (!profile) return
  // Re-create the exact record (same id, envelope, reports) and rehydrate the
  // store. We restore through the repository because the fleet store owns no
  // restore action; loadAll() resyncs the in-memory list from persistence.
  await fleetRepository.create(profile)
  await fleetStore.loadAll()
}

function onDismissUndo(): void {
  recentlyDeleted.value = null
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

/* ─── Icon-only action buttons (Select / Verify / Download / Edit / Delete) ───
 *
 * Sized generously for touch use under cockpit vibration:
 *   • 2.75rem × 2.75rem (≈44 px) meets WCAG 2.2 SC 2.5.8 AAA target size.
 *   • 0.75rem gap between siblings prevents mis-tap.
 *   • Clear focus ring + hover colour differentiation for gloved use.
 *   • Every button carries an `aria-label` and a `.sr-only` text label so
 *     screen readers and automated tests can still discriminate actions.
 */

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

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

.icon-btn:disabled {
  cursor: not-allowed;
}

/* Select / Active — primary colour circle-check */
.icon-btn--select {
  color: var(--color-primary, #3b82f6);
}

.icon-btn--select:hover:not(:disabled) {
  color: var(--color-primary-hover, var(--color-primary, #2563eb));
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-bg, #eff6ff);
}

/* "Active" resting state: filled primary, no hover colour change needed. */
.icon-btn--select-active {
  background: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary-text, #ffffff);
  opacity: 1; /* override :disabled dim — active is a positive signal, not a blocked affordance */
}

.icon-btn--select-active:disabled {
  opacity: 1;
}

/* Verify — success colour shield-check */
.icon-btn--verify {
  color: var(--color-success, #10b981);
}

.icon-btn--verify:hover:not(:disabled) {
  color: var(--neutral-0, #ffffff);
  background: var(--color-success, #10b981);
  border-color: var(--color-success, #10b981);
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

/* Legacy .btn-* selectors preserved for existing test selectors — visuals
   inherit from .icon-btn / .icon-btn--* above. */
.btn-primary,
.btn-success,
.btn-secondary,
.btn-danger {
  /* intentionally empty — class exists only as a stable selector */
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
