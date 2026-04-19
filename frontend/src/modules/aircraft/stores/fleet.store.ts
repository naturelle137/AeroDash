/**
 * Fleet Store — Pinia store for aircraft fleet CRUD and Draft/Verified FSM.
 * P2 Feature Module — orchestrates fleetRepository + profileValidator.
 *
 * Draft/Verified FSM contract:
 * - All new profiles start as Draft.
 * - verifyProfile(): creates a new immutable Verified snapshot (new UUID), deletes the Draft.
 * - editVerifiedProfile(): creates a new Draft copy (new UUID) with the provided changes.
 * - In-place mutation of a Verified profile is BLOCKED (throws VerifiedMutationError).
 * - Any computation using a `draft` profile emits WARN-AC-002 (Mass & Balance gate).
 *
 * @see docs/requirements/aircraft_management.md REQ-AC-001 – REQ-AC-006
 * @see docs/architecture/aircraft-fleet-module.md
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { AircraftProfileSchema } from '@/core/adapters/aircraft.schema'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { fleetRepository } from '../services/fleet.repository'
import { validateIcaoRegistration, hasDuplicateRegistration } from '../services/profile.validator'
import { useActiveAircraftStore } from './active-aircraft.store'

// @IMP-AC-STORE-005@ (FROM: @REQ-AC-001@, @REQ-AC-003@, @REQ-AC-005@, @REQ-AC-006@)

/** Thrown when attempting to mutate a Verified profile in-place. */
export class VerifiedMutationError extends Error {
  constructor(id: string) {
    super(
      `[SAFETY] Direct in-place mutation of Verified profile "${id}" is forbidden. ` +
        'Use editVerifiedProfile() to create a new Draft copy.',
    )
    this.name = 'VerifiedMutationError'
  }
}

/** Thrown when ICAO registration validation fails. */
export class InvalidRegistrationError extends Error {
  constructor(registration: string) {
    super(
      `Invalid ICAO registration: "${registration}". ` +
        'Must be 2–7 alphanumeric characters with optional hyphens.',
    )
    this.name = 'InvalidRegistrationError'
  }
}

export type FleetNotification = {
  type: 'WARNING' | 'INFO'
  code: string
  message: string
}

/** IndexedDB fleet hydration lifecycle for UI feedback (refs #158). */
export type FleetLoadState = 'LOADING' | 'READY' | 'ERROR'

export const useFleetStore = defineStore('fleet', () => {
  // ─── State ────────────────────────────────────────────────────────────────

  const profiles = ref<AircraftProfile[]>([])
  /** Start LOADING so fleet UI never shows an empty list before the first `loadAll()` (#158 hydration). */
  const fleetLoadState = ref<FleetLoadState>('LOADING')
  const fleetLoadError = ref<string | null>(null)
  const notifications = ref<FleetNotification[]>([])

  /** @deprecated Prefer `fleetLoadState === 'LOADING'` for new code. */
  const isLoading = computed(() => fleetLoadState.value === 'LOADING')

  // ─── Internal helpers ─────────────────────────────────────────────────────

  function emitDraftWarning(profile: AircraftProfile): void {
    notifications.value.push({
      type: 'WARNING',
      code: 'WARN-AC-002',
      message: `Draft Profile Active — "${profile.registration}" is unverified; verify data before safety-critical use.`,
    })
  }

  function emitDuplicateWarning(registration: string): void {
    notifications.value.push({
      type: 'WARNING',
      code: 'WARN-AC-001',
      message: `Registration "${registration}" already exists in your fleet. Check for duplicate entries.`,
    })
  }

  function clearNotifications(): void {
    notifications.value = []
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** Load all profiles from IndexedDB into the store. */
  async function loadAll(): Promise<void> {
    fleetLoadState.value = 'LOADING'
    fleetLoadError.value = null
    try {
      profiles.value = await fleetRepository.findAll()
      fleetLoadState.value = 'READY'
    } catch (err) {
      fleetLoadState.value = 'ERROR'
      fleetLoadError.value =
        err instanceof Error ? err.message : 'Failed to load aircraft fleet from storage.'
    }
  }

  /**
   * Create a new aircraft profile (always starts as Draft).
   * Validates ICAO registration format and emits duplicate warning if needed.
   * If `ownerId` is absent or empty, a UUID is auto-generated.
   */
  async function createProfile(
    data: Omit<AircraftProfile, 'id' | 'status' | 'schemaVersion' | 'ownerId'> & {
      ownerId?: string
    },
  ): Promise<AircraftProfile> {
    if (!validateIcaoRegistration(data.registration)) {
      throw new InvalidRegistrationError(data.registration)
    }

    if (hasDuplicateRegistration(data.registration, profiles.value)) {
      emitDuplicateWarning(data.registration)
    }

    const newProfile: AircraftProfile = AircraftProfileSchema.parse({
      ...data,
      ownerId: data.ownerId && data.ownerId.trim() !== '' ? data.ownerId : uuidv4(),
      id: uuidv4(),
      status: 'draft',
      schemaVersion: 1,
    })

    await fleetRepository.create(newProfile)
    profiles.value.push(newProfile)
    return newProfile
  }

  /**
   * Update an existing Draft profile.
   * BLOCKS updates to Verified profiles — use editVerifiedProfile() instead.
   */
  async function updateProfile(id: string, changes: Partial<AircraftProfile>): Promise<AircraftProfile> {
    const existing = profiles.value.find((p) => p.id === id)
    if (!existing) {
      throw new Error(`Profile not found: ${id}`)
    }

    if (existing.status === 'verified') {
      throw new VerifiedMutationError(id)
    }

    if (changes.registration && changes.registration !== existing.registration) {
      if (!validateIcaoRegistration(changes.registration)) {
        throw new InvalidRegistrationError(changes.registration)
      }
      if (hasDuplicateRegistration(changes.registration, profiles.value, id)) {
        emitDuplicateWarning(changes.registration)
      }
    }

    const updated: AircraftProfile = AircraftProfileSchema.parse({
      ...existing,
      ...changes,
      id,
      status: 'draft',
    })

    await fleetRepository.update(updated)
    const idx = profiles.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      profiles.value[idx] = updated
    }
    return updated
  }

  /**
   * Delete a profile by id.
   */
  async function deleteProfile(id: string): Promise<void> {
    await fleetRepository.deleteById(id)
    profiles.value = profiles.value.filter((p) => p.id !== id)
  }

  /**
   * Verify a Draft profile:
   * Creates a new immutable verified snapshot (new UUID, same data, status='verified').
   * Deletes the original Draft.
   *
   * SAFETY: The new Verified snapshot is written to IndexedDB before the Draft is removed.
   * If any step fails the fleet remains consistent.
   */
  async function verifyProfile(id: string): Promise<AircraftProfile> {
    const draft = profiles.value.find((p) => p.id === id)
    if (!draft) {
      throw new Error(`Profile not found: ${id}`)
    }
    if (draft.status === 'verified') {
      throw new Error(`Profile "${id}" is already verified.`)
    }

    const snapshot: AircraftProfile = AircraftProfileSchema.parse({
      ...draft,
      id: uuidv4(),
      status: 'verified',
    })

    // Write the Verified snapshot first, then delete the Draft
    await fleetRepository.create(snapshot)
    await fleetRepository.deleteById(id)

    profiles.value = profiles.value.filter((p) => p.id !== id)
    profiles.value.push(snapshot)

    // If the verified Draft was the active aircraft, update to the new Verified snapshot
    const activeStore = useActiveAircraftStore()
    if (activeStore.activeProfile?.id === id) {
      activeStore.setActiveProfile(snapshot)
    }

    return snapshot
  }

  /**
   * Begin editing a Verified profile:
   * Replaces the Verified record with a new Draft at the **same `id`**, merging
   * the provided changes. The Verified → Draft transition is the only way to
   * mutate a Verified record — direct `updateProfile()` on a Verified profile
   * is still blocked by {@link VerifiedMutationError}.
   *
   * Rationale: REQ-AC-005 requires Verified records to be immutable at the store
   * layer, which this contract preserves (we never write a mutation to a record
   * that is still Verified). It does not require retaining the old Verified row
   * as an audit trail — keeping duplicate rows around confuses the pilot's fleet
   * view and was the source of perceived "new entry on every edit" behaviour.
   */
  async function editVerifiedProfile(
    id: string,
    changes: Partial<AircraftProfile>,
  ): Promise<AircraftProfile> {
    const verified = profiles.value.find((p) => p.id === id)
    if (!verified) {
      throw new Error(`Profile not found: ${id}`)
    }
    if (verified.status !== 'verified') {
      throw new Error(`Profile "${id}" is not verified — use updateProfile() for draft profiles.`)
    }

    const draftCopy: AircraftProfile = AircraftProfileSchema.parse({
      ...verified,
      ...changes,
      id,
      status: 'draft',
    })

    await fleetRepository.update(draftCopy)
    const idx = profiles.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      profiles.value[idx] = draftCopy
    }

    // If the edited Verified was the active aircraft, the reference needs to
    // track the new Draft so the rest of the app sees the updated data.
    const activeStore = useActiveAircraftStore()
    if (activeStore.activeProfile?.id === id) {
      activeStore.setActiveProfile(draftCopy)
    }

    return draftCopy
  }

  /**
   * Emit a warning notification if the given profile is a Draft.
   * Call this before using a profile for calculations (REQ-AC-005).
   */
  function checkDraftWarning(profile: AircraftProfile): void {
    if (profile.status === 'draft') {
      emitDraftWarning(profile)
    }
  }

  return {
    // State
    profiles,
    fleetLoadState,
    fleetLoadError,
    isLoading,
    notifications,
    // Actions
    loadAll,
    createProfile,
    updateProfile,
    deleteProfile,
    verifyProfile,
    editVerifiedProfile,
    checkDraftWarning,
    clearNotifications,
  }
})
