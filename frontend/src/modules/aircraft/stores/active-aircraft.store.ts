/**
 * Active Aircraft Store — Pinia store for in-session aircraft context.
 * P2/P3 Feature Module — manages the currently selected aircraft profile
 * without requiring a full page reload.
 *
 * @see docs/requirements/aircraft_management.md REQ-AC-005
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'

// @IMP-AC-STORE-006@ (FROM: @REQ-AC-005@)

export const useActiveAircraftStore = defineStore('activeAircraft', () => {
  // ─── State ────────────────────────────────────────────────────────────────

  const activeProfile = ref<AircraftProfile | null>(null)

  // ─── Getters ──────────────────────────────────────────────────────────────

  /** True if the currently active profile is in Draft status. */
  const isDraft = computed(() => activeProfile.value?.status === 'draft')

  /** True if a profile is currently selected. */
  const hasActiveProfile = computed(() => activeProfile.value !== null)

  // ─── Actions ──────────────────────────────────────────────────────────────

  /**
   * Set the active aircraft profile for in-session use.
   *
   * Hot-swaps the aircraft context without a page reload. When switching to a
   * different airframe, the mass-balance store is cleared so prior-aircraft
   * load data, results, and notifications cannot leak into the next flight's
   * computation. The persisted session payload (`localStorage`) is cleared via
   * session-persistence's watcher on `mbStore.aircraft.id`.
   *
   * Identity for the "same airframe" test is `registration` — not `id` —
   * because verifying a Draft and editing a Verified profile both mint a new
   * UUID but keep the same airframe, and the pilot's M&B inputs should be
   * preserved across those status transitions.
   */
  function setActiveProfile(profile: AircraftProfile): void {
    const priorRegistration = activeProfile.value?.registration
    if (priorRegistration !== undefined && priorRegistration !== profile.registration) {
      useMassBalanceStore().clearProfile()
    }
    activeProfile.value = profile
  }

  /**
   * Clear the currently active aircraft profile and any dependent M&B state.
   */
  function clearActive(): void {
    useMassBalanceStore().clearProfile()
    activeProfile.value = null
  }

  return {
    // State
    activeProfile,
    // Getters
    isDraft,
    hasActiveProfile,
    // Actions
    setActiveProfile,
    clearActive,
  }
})
