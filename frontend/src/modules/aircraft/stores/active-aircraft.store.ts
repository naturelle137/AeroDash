/**
 * Active Aircraft Store — Pinia store for in-session aircraft context.
 * P2/P3 Feature Module — manages the currently selected aircraft profile
 * without requiring a full page reload (refs #153).
 *
 * @see docs/requirements/aircraft_management.md REQ-AC-005
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

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
   * Hot-swaps the aircraft context without a page reload.
   * Any modules observing activeProfile will reactively update.
   */
  function setActiveProfile(profile: AircraftProfile): void {
    activeProfile.value = profile
  }

  /**
   * Clear the currently active aircraft profile.
   */
  function clearActive(): void {
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
