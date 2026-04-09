/**
 * Fleet Store — Pinia store for aircraft fleet CRUD and Draft/Verified FSM.
 * P2 Feature Module — orchestrates fleetRepository + profileValidator.
 *
 * Draft/Verified FSM contract:
 * - All new profiles start as Draft.
 * - verifyProfile(): creates a new immutable Verified snapshot (new UUID), deletes the Draft.
 * - editVerifiedProfile(): creates a new Draft copy (new UUID) with the provided changes.
 * - In-place mutation of a Verified profile is BLOCKED (throws VerifiedMutationError).
 * - Any computation using a Draft profile emits WARN-AC-002.
 *
 * @see docs/requirements/aircraft_management.md REQ-AC-001 – REQ-AC-006
 * @see docs/architecture/aircraft-fleet-module.md
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { AircraftProfileSchema } from '@/core/adapters/aircraft.schema'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { fleetRepository } from '../services/fleet.repository'
import { validateIcaoRegistration, hasDuplicateRegistration } from '../services/profile.validator'

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

export const useFleetStore = defineStore('fleet', () => {
  // ─── State ────────────────────────────────────────────────────────────────

  const profiles = ref<AircraftProfile[]>([])
  const isLoading = ref(false)
  const notifications = ref<FleetNotification[]>([])

  // ─── Internal helpers ─────────────────────────────────────────────────────

  function emitDraftWarning(profile: AircraftProfile): void {
    notifications.value.push({
      type: 'WARNING',
      code: 'WARN-AC-002',
      message: `Profile "${profile.registration}" is in Draft status. Verify all data before use in calculations.`,
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
    isLoading.value = true
    try {
      profiles.value = await fleetRepository.findAll()
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new aircraft profile (always starts as Draft).
   * Validates ICAO registration format and emits duplicate warning if needed.
   */
  async function createProfile(
    data: Omit<AircraftProfile, 'id' | 'status' | 'schemaVersion'>,
  ): Promise<AircraftProfile> {
    if (!validateIcaoRegistration(data.registration)) {
      throw new InvalidRegistrationError(data.registration)
    }

    if (hasDuplicateRegistration(data.registration, profiles.value)) {
      emitDuplicateWarning(data.registration)
    }

    const newProfile: AircraftProfile = AircraftProfileSchema.parse({
      ...data,
      id: uuidv4(),
      status: 'Draft',
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

    if (existing.status === 'Verified') {
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
      status: 'Draft',
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
   * Creates a new immutable Verified snapshot (new UUID, same data, status='Verified').
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
    if (draft.status === 'Verified') {
      throw new Error(`Profile "${id}" is already Verified.`)
    }

    const snapshot: AircraftProfile = AircraftProfileSchema.parse({
      ...draft,
      id: uuidv4(),
      status: 'Verified',
    })

    // Write the Verified snapshot first, then delete the Draft
    await fleetRepository.create(snapshot)
    await fleetRepository.deleteById(id)

    profiles.value = profiles.value.filter((p) => p.id !== id)
    profiles.value.push(snapshot)
    return snapshot
  }

  /**
   * Begin editing a Verified profile:
   * Creates a new Draft copy (new UUID) with the provided changes.
   * The original Verified snapshot is NOT modified.
   *
   * SAFETY: The original Verified profile remains in the fleet as the source of truth.
   */
  async function editVerifiedProfile(
    id: string,
    changes: Partial<AircraftProfile>,
  ): Promise<AircraftProfile> {
    const verified = profiles.value.find((p) => p.id === id)
    if (!verified) {
      throw new Error(`Profile not found: ${id}`)
    }
    if (verified.status !== 'Verified') {
      throw new Error(`Profile "${id}" is not Verified — use updateProfile() for Draft profiles.`)
    }

    const draftCopy: AircraftProfile = AircraftProfileSchema.parse({
      ...verified,
      ...changes,
      id: uuidv4(),
      status: 'Draft',
    })

    await fleetRepository.create(draftCopy)
    profiles.value.push(draftCopy)
    return draftCopy
  }

  /**
   * Emit a warning notification if the given profile is a Draft.
   * Call this before using a profile for calculations (REQ-AC-005).
   */
  function checkDraftWarning(profile: AircraftProfile): void {
    if (profile.status === 'Draft') {
      emitDraftWarning(profile)
    }
  }

  return {
    // State
    profiles,
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
