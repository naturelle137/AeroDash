/**
 * Unit tests for fleet.store.ts
 * Mocks IndexedDB via fake-indexeddb.
 *
 * @see frontend/src/modules/aircraft/stores/fleet.store.ts
 */


import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  useFleetStore,
  VerifiedMutationError,
  InvalidRegistrationError,
  IncompleteSignoffError,
  InvalidVerificationDateError,
} from '../stores/fleet.store'
import { useActiveAircraftStore } from '../stores/active-aircraft.store'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { fleetRepository } from '../services/fleet.repository'

/** A complete verification sign-off for tests that just need to reach Verified. */
const SIGNOFF = { verifiedBy: 'JS', pohRevision: 'Rev 7', verifiedOn: '2026-01-10' } as const

// Mock the fleet repository so we don't need real IndexedDB in unit tests
vi.mock('../services/fleet.repository', () => ({
  fleetRepository: {
    findAll: vi.fn<() => Promise<AircraftProfile[]>>().mockResolvedValue([]),
    findAllWithDiagnostics: vi
      .fn<() => Promise<{ profiles: AircraftProfile[]; diagnostics: readonly unknown[] }>>()
      .mockResolvedValue({ profiles: [], diagnostics: [] }),
    create: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    update: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteById: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    findById: vi.fn<() => Promise<AircraftProfile | undefined>>().mockResolvedValue(undefined),
    findByIdWithDiagnostics: vi
      .fn<
        () => Promise<{ profile: AircraftProfile | undefined; diagnostics: readonly unknown[] }>
      >()
      .mockResolvedValue({ profile: undefined, diagnostics: [] }),
    openDB: vi.fn<() => Promise<IDBDatabase>>().mockResolvedValue({} as IDBDatabase),
  },
}))

/** Minimal valid profile data (omitting id/status/schemaVersion). */
function minimalProfileData(): Omit<AircraftProfile, 'id' | 'status' | 'schemaVersion'> {
  return {
    ownerId: 'user-test',
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 110,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 650,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.841, mass: 432 },
          { armOrMoment: 1.841, mass: 650 },
          { armOrMoment: 1.978, mass: 650 },
          { armOrMoment: 1.978, mass: 432 },
        ],
      },
    ],
  }
}

describe('useFleetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fleetRepository.findAll).mockResolvedValue([])
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockResolvedValue({
      profiles: [],
      diagnostics: [],
    })
  })

  it('creates Draft profile by default', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    expect(profile.status).toBe('draft')
    expect(profile.schemaVersion).toBe(1)
    expect(store.profiles).toHaveLength(1)
    expect(store.profiles[0]!.status).toBe('draft')
  })

  it('verifyProfile creates new immutable snapshot with Verified status', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const draftId = draft.id

    const verified = await store.verifyProfile(draftId, SIGNOFF)

    expect(verified.status).toBe('verified')
    // New UUID must have been assigned
    expect(verified.id).not.toBe(draftId)
    // Original Draft is removed
    expect(store.profiles.find((p) => p.id === draftId)).toBeUndefined()
    // Verified snapshot is in the fleet
    expect(store.profiles.find((p) => p.id === verified.id)).toBeDefined()
  })

  it('editVerifiedProfile replaces the Verified record in place with a Draft', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id, SIGNOFF)
    const verifiedId = verified.id

    const edited = await store.editVerifiedProfile(verifiedId, { registration: 'D-ECSM' })

    // Same id — no duplicate row in the fleet
    expect(edited.id).toBe(verifiedId)
    expect(store.profiles.filter((p) => p.id === verifiedId)).toHaveLength(1)

    // The record at that id is now the edited Draft
    const inFleet = store.profiles.find((p) => p.id === verifiedId)
    expect(inFleet!.status).toBe('draft')
    expect(inFleet!.registration).toBe('D-ECSM')
  })

  it('editVerifiedProfile converts status Verified → Draft and applies changes', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id, SIGNOFF)

    const edited = await store.editVerifiedProfile(verified.id, { model: 'P2010' })

    expect(edited.status).toBe('draft')
    expect(edited.id).toBe(verified.id)
    expect(edited.model).toBe('P2010')

    // Fleet has exactly one row at that id, now Draft with the new model
    const rows = store.profiles.filter((p) => p.id === verified.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe('draft')
    expect(rows[0]!.model).toBe('P2010')
  })

  it('blocks direct in-place mutation of Verified profile via updateProfile', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id, SIGNOFF)

    await expect(store.updateProfile(verified.id, { registration: 'D-MUTATED' })).rejects.toThrow(
      VerifiedMutationError,
    )

    // Verified profile is unchanged
    const stillVerified = store.profiles.find((p) => p.id === verified.id)
    expect(stillVerified!.registration).toBe('D-EBPN')
  })

  it('emits a duplicate warning when creating profile with existing registration', async () => {
    const store = useFleetStore()
    await store.createProfile(minimalProfileData())
    // Add a second with the same registration
    await store.createProfile({ ...minimalProfileData(), registration: 'D-EBPN' })

    expect(store.notifications.some((n) => n.code === 'WARN-AC-001')).toBe(true)
  })

  it('emits draft warning when checkDraftWarning is called with Draft profile', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    store.checkDraftWarning(profile)
    expect(store.notifications.some((n) => n.code === 'WARN-AC-002')).toBe(true)
  })

  it('does not emit draft warning when profile is Verified', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id, SIGNOFF)
    store.clearNotifications()
    store.checkDraftWarning(verified)
    expect(store.notifications.some((n) => n.code === 'WARN-AC-002')).toBe(false)
  })

  it('deleteProfile removes the profile from the store', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    await store.deleteProfile(profile.id)
    expect(store.profiles).toHaveLength(0)
  })

  it('starts with fleetLoadState LOADING until the first successful loadAll', async () => {
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockResolvedValueOnce({
      profiles: [],
      diagnostics: [],
    })

    const store = useFleetStore()
    expect(store.fleetLoadState).toBe('LOADING')

    await store.loadAll()
    expect(store.fleetLoadState).toBe('READY')
    expect(store.profiles).toHaveLength(0)
  })

  it('loadAll sets isLoading=true during fetch and false after completion (LOADING→READY)', async () => {
    const store = useFleetStore()
    let capturedDuringLoad: boolean | undefined

    const { fleetRepository } = await import('../services/fleet.repository')
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockImplementationOnce(async () => {
      capturedDuringLoad = store.isLoading
      return { profiles: [], diagnostics: [] }
    })

    await store.loadAll()

    expect(capturedDuringLoad).toBe(true)
    expect(store.isLoading).toBe(false)
  })

  it('loadAll sets isLoading=false even when IndexedDB throws (LOADING→ERROR)', async () => {
    const store = useFleetStore()
    const { fleetRepository } = await import('../services/fleet.repository')
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockRejectedValueOnce(
      new Error('IndexedDB unavailable'),
    )

    await store.loadAll()
    expect(store.fleetLoadState).toBe('ERROR')
    expect(store.fleetLoadError).toBe('IndexedDB unavailable')
    expect(store.isLoading).toBe(false)
  })

  it('loadAll clears a stale unreadableProfileCount when a later load throws (LOADING→ERROR)', async () => {
    const store = useFleetStore()
    const { fleetRepository } = await import('../services/fleet.repository')

    // First load succeeds with unreadable rows present.
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockResolvedValueOnce({
      profiles: [],
      diagnostics: [
        {
          id: 'p-future',
          reason: 'unsupported-future-version',
          storedVersion: 7,
          detail: 'newer build',
        },
      ],
    })
    await store.loadAll()
    expect(store.unreadableProfileCount).toBe(1)

    // A subsequent load (e.g. a post-wipe reload) fails — the prior count is now
    // unknowable and must not linger as a stale "1 unreadable profile" warning.
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockRejectedValueOnce(
      new Error('IndexedDB unavailable'),
    )
    await store.loadAll()
    expect(store.fleetLoadState).toBe('ERROR')
    expect(store.unreadableProfileCount).toBe(0)
  })

  it('loadAll populates profiles from IndexedDB (READY state)', async () => {
    const store = useFleetStore()
    const { fleetRepository } = await import('../services/fleet.repository')
    const mockProfile: AircraftProfile = {
      id: '00000000-0000-4000-a000-000000000042',
      ownerId: 'user-test',
      registration: 'G-ABCD',
      manufacturer: 'Cessna',
      model: 'C172S Skyhawk SP',
      icaoTypeDesignator: 'C172',
      sourceUnit: 'kg',
      referenceDatumDescription: 'Firewall',
      referenceDatumLocation: 'Station 0',
      shareCode: null,
      status: 'verified',
      schemaVersion: 1,
      powertrain: 'combustion',
      passengerProfiles: [],
      weighingReports: [
        { bem: 780, emptyCg: 2.1, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
      ],
      loadPoints: [
        {
          name: 'Pilot',
          arm: 2.0,
          armLookup: [],
          operationalLimit: 110,
          defaultQuantity: 0,
          unit: 'kg',
          allowableCategories: null,
          fuelTank: null,
        },
      ],
      certificationCategories: [
        {
          category: 'Normal',
          mtom: 1157,
          maxZeroFuelMass: null,
          graphType: 'arm',
          envelope: [
            { armOrMoment: 2.0, mass: 780 },
            { armOrMoment: 2.0, mass: 1157 },
            { armOrMoment: 2.45, mass: 1157 },
            { armOrMoment: 2.45, mass: 780 },
          ],
        },
      ],
    }
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockResolvedValueOnce({
      profiles: [mockProfile],
      diagnostics: [],
    })

    await store.loadAll()

    expect(store.profiles).toHaveLength(1)
    expect(store.profiles[0]!.registration).toBe('G-ABCD')
    expect(store.isLoading).toBe(false)
  })

  // ── Migration diagnostics surfaced as INFO notifications ──────────────────

  it('loadAll emits one INFO-AC-001 notification per dropped profile (future version)', async () => {
    // Without this, profiles dropped by the migration registry would silently
    // disappear from the fleet UI — the pilot would think the aircraft was
    // deleted. We surface one INFO toast per dropped record so they know the
    // load was partial and what to do about it.
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockResolvedValueOnce({
      profiles: [],
      diagnostics: [
        {
          id: 'aircraft-from-future',
          reason: 'unsupported-future-version',
          storedVersion: 7,
          detail:
            'Aircraft profile dropped: stored schemaVersion 7 is newer than this build can read.',
        },
      ],
    })

    const store = useFleetStore()
    await store.loadAll()

    const infos = store.notifications.filter((n) => n.code === 'INFO-AC-001')
    expect(infos).toHaveLength(1)
    expect(infos[0]!.type).toBe('INFO')
    expect(infos[0]!.message).toContain('aircraft-from-future')
    expect(infos[0]!.message).toContain('newer than this build')
  })

  it('loadAll emits one INFO-AC-001 notification per dropped profile (corrupt)', async () => {
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockResolvedValueOnce({
      profiles: [],
      diagnostics: [
        {
          id: 'corrupt-a',
          reason: 'corrupt',
          storedVersion: 1,
          detail:
            'Aircraft profile dropped: corrupt at storage layer — schema validation failed: root: missing',
        },
        {
          id: 'corrupt-b',
          reason: 'corrupt',
          storedVersion: 1,
          detail:
            'Aircraft profile dropped: corrupt at storage layer — schema validation failed: root: missing',
        },
      ],
    })

    const store = useFleetStore()
    await store.loadAll()

    const infos = store.notifications.filter((n) => n.code === 'INFO-AC-001')
    expect(infos).toHaveLength(2)
    expect(infos.every((n) => n.type === 'INFO')).toBe(true)
    // The dropped-row count is retained so the data-rights view can warn that
    // these rows are excluded from an export yet erased by a wipe (DES-ARCH-011).
    expect(store.unreadableProfileCount).toBe(2)
  })

  it('loadAll emits no INFO notification when no profile is dropped', async () => {
    vi.mocked(fleetRepository.findAllWithDiagnostics).mockResolvedValueOnce({
      profiles: [],
      diagnostics: [],
    })

    const store = useFleetStore()
    await store.loadAll()

    expect(store.notifications.some((n) => n.code === 'INFO-AC-001')).toBe(false)
  })

  // ── ICAO registration validation ──

  it('createProfile rejects invalid ICAO registration format', async () => {
    const store = useFleetStore()
    await expect(
      store.createProfile({ ...minimalProfileData(), registration: '123INVALID' }),
    ).rejects.toThrow(InvalidRegistrationError)
  })

  it('updateProfile rejects invalid ICAO registration on edit', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    await expect(store.updateProfile(profile.id, { registration: '!!!BAD' })).rejects.toThrow(
      InvalidRegistrationError,
    )
  })

  it('updateProfile emits duplicate warning when registration conflicts with another profile', async () => {
    const store = useFleetStore()
    await store.createProfile(minimalProfileData())
    const second = await store.createProfile({ ...minimalProfileData(), registration: 'D-ECSM' })
    store.clearNotifications()

    await store.updateProfile(second.id, { registration: 'D-EBPN' })
    expect(store.notifications.some((n) => n.code === 'WARN-AC-001')).toBe(true)
  })

  it('updateProfile throws when profile not found', async () => {
    const store = useFleetStore()
    await expect(
      store.updateProfile('non-existent-id', { registration: 'D-NONE' }),
    ).rejects.toThrow('Profile not found: non-existent-id')
  })

  // ── Draft → computation → WARNING notification ──────────────────────────

  it('WARNING WARN-AC-002 is visible after checkDraftWarning on Draft profile used for computation', async () => {
    const store = useFleetStore()
    const draftProfile = await store.createProfile(minimalProfileData())
    store.clearNotifications()

    store.checkDraftWarning(draftProfile)

    const warning = store.notifications.find((n) => n.code === 'WARN-AC-002')
    expect(warning).toBeDefined()
    expect(warning!.type).toBe('WARNING')
    expect(warning!.message).toContain(draftProfile.registration)
  })

  // ── editVerifiedProfile in-place replacement ──

  it('editVerifiedProfile preserves untouched fields when converting Verified to Draft', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id, SIGNOFF)

    const edited = await store.editVerifiedProfile(verified.id, {
      registration: 'D-ECSM',
      model: 'P2010',
    })

    expect(edited.id).toBe(verified.id)
    expect(edited.status).toBe('draft')
    expect(edited.registration).toBe('D-ECSM')
    expect(edited.model).toBe('P2010')
    // Fields that were not in the changes payload carry over unchanged
    expect(edited.manufacturer).toBe(verified.manufacturer)
    expect(edited.ownerId).toBe(verified.ownerId)
    expect(edited.weighingReports).toEqual(verified.weighingReports)
  })

  it('verifyProfile throws if profile is already Verified', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id, SIGNOFF)
    await expect(store.verifyProfile(verified.id, SIGNOFF)).rejects.toThrow(
      `Profile "${verified.id}" is already verified.`,
    )
  })

  it('verifyProfile throws if profile not found', async () => {
    const store = useFleetStore()
    await expect(store.verifyProfile('no-such-id', SIGNOFF)).rejects.toThrow(
      'Profile not found: no-such-id',
    )
  })

  it('editVerifiedProfile throws if profile not found', async () => {
    const store = useFleetStore()
    await expect(store.editVerifiedProfile('no-such-id', {})).rejects.toThrow(
      'Profile not found: no-such-id',
    )
  })

  it('editVerifiedProfile throws if called on a Draft profile', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    await expect(store.editVerifiedProfile(draft.id, {})).rejects.toThrow(
      `Profile "${draft.id}" is not verified`,
    )
  })

  // ── verifyProfile updates active aircraft context ───────────────────────

  it('verifyProfile updates activeAircraftStore when the Draft was the active profile', async () => {
    const store = useFleetStore()
    const activeStore = useActiveAircraftStore()
    const draft = await store.createProfile(minimalProfileData())
    activeStore.setActiveProfile(draft)

    const verified = await store.verifyProfile(draft.id, SIGNOFF)

    expect(activeStore.activeProfile?.id).toBe(verified.id)
    expect(activeStore.activeProfile?.status).toBe('verified')
  })

  it('verifyProfile does not change activeAircraftStore when a different profile is active', async () => {
    const store = useFleetStore()
    const activeStore = useActiveAircraftStore()
    const draft = await store.createProfile(minimalProfileData())
    const other = await store.createProfile({ ...minimalProfileData(), registration: 'D-OTHR' })
    activeStore.setActiveProfile(other)

    await store.verifyProfile(draft.id, SIGNOFF)

    expect(activeStore.activeProfile?.id).toBe(other.id)
  })

  // ── passengerProfiles round-trip persistence ─────────────────────────

  it('passengerProfiles are persisted in store state after createProfile', async () => {
    const store = useFleetStore()
    const data = {
      ...minimalProfileData(),
      passengerProfiles: [
        { name: 'Standard Adult', standardWeight: 86, unit: 'kg' as const },
        { name: 'Child', standardWeight: 35, unit: 'kg' as const },
      ],
    }
    const profile = await store.createProfile(data)
    expect(profile.passengerProfiles).toHaveLength(2)
    expect(profile.passengerProfiles[0]!.name).toBe('Standard Adult')
    expect(profile.passengerProfiles[0]!.standardWeight).toBe(86)
    expect(profile.passengerProfiles[1]!.name).toBe('Child')

    const inFleet = store.profiles.find((p) => p.id === profile.id)
    expect(inFleet!.passengerProfiles).toEqual(profile.passengerProfiles)
  })

  it('passengerProfiles survive verify → editVerified cycle unmodified', async () => {
    const store = useFleetStore()
    const passengerProfiles = [{ name: 'Standard Adult', standardWeight: 86, unit: 'kg' as const }]
    const draft = await store.createProfile({ ...minimalProfileData(), passengerProfiles })
    const verified = await store.verifyProfile(draft.id, SIGNOFF)

    expect(verified.passengerProfiles).toEqual(passengerProfiles)

    const editedDraft = await store.editVerifiedProfile(verified.id, { model: 'P2010' })
    expect(editedDraft.passengerProfiles).toEqual(passengerProfiles)

    // Record at that id is now the edited Draft (Verified was replaced in place)
    const inFleet = store.profiles.find((p) => p.id === verified.id)
    expect(inFleet!.passengerProfiles).toEqual(passengerProfiles)
    expect(inFleet!.status).toBe('draft')
  })

  it('passenger standard weight application: profile weight matches schema value', async () => {
    const store = useFleetStore()
    const data = {
      ...minimalProfileData(),
      passengerProfiles: [
        { name: 'Standard Adult', standardWeight: 86, unit: 'kg' as const },
        { name: 'Heavy Adult', standardWeight: 100, unit: 'kg' as const },
      ],
    }
    const profile = await store.createProfile(data)

    // Verify correct standard weight applied per profile entry
    expect(profile.passengerProfiles[0]!.standardWeight).toBe(86)
    expect(profile.passengerProfiles[1]!.standardWeight).toBe(100)
    expect(profile.passengerProfiles[0]!.unit).toBe('kg')
  })

  it('passengerProfiles default to empty array when not provided', async () => {
    const store = useFleetStore()
    const data = { ...minimalProfileData(), passengerProfiles: [] }
    const profile = await store.createProfile(data)
    expect(profile.passengerProfiles).toEqual([])
  })

  it('clearNotifications empties the notifications array', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    store.checkDraftWarning(profile)
    expect(store.notifications.length).toBeGreaterThan(0)
    store.clearNotifications()
    expect(store.notifications).toHaveLength(0)
  })

  // ── Branch coverage: updateProfile registration-change guard ──

  it('updateProfile succeeds when no registration field is included in changes', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    store.clearNotifications()

    const updated = await store.updateProfile(profile.id, { model: 'P2010' })

    expect(updated.model).toBe('P2010')
    expect(updated.registration).toBe('D-EBPN')
    expect(store.notifications).toHaveLength(0)
  })

  it('updateProfile succeeds with a valid new registration that is not a duplicate', async () => {
    const store = useFleetStore()
    const profile = await store.createProfile(minimalProfileData())
    store.clearNotifications()

    const updated = await store.updateProfile(profile.id, { registration: 'D-NEW' })

    expect(updated.registration).toBe('D-NEW')
    expect(store.notifications).toHaveLength(0)
  })

  // ── notifications cleared on aircraft context switch ────────────────────

  it('notifications are cleared after calling clearNotifications on aircraft switch', async () => {
    // "Prior aircraft load data, results, and notifications cleared on switch."
    // The fleet store provides clearNotifications() for callers (e.g. the aircraft management
    // view or a watcher on activeAircraftStore) to reset notification state when switching aircraft.
    const store = useFleetStore()
    const activeStore = useActiveAircraftStore()
    const draft1 = await store.createProfile(minimalProfileData())
    const draft2 = await store.createProfile({ ...minimalProfileData(), registration: 'D-ECSM' })

    // Generate a notification (duplicate warning)
    await store.createProfile({ ...minimalProfileData(), registration: 'D-EBPN' })
    expect(store.notifications.some((n) => n.code === 'WARN-AC-001')).toBe(true)

    // Switch active aircraft and explicitly clear notifications (simulates context switch handler)
    activeStore.setActiveProfile(draft2)
    store.clearNotifications()

    expect(store.notifications).toHaveLength(0)
    expect(activeStore.activeProfile?.id).toBe(draft2.id)

    void draft1
  })

  // ── REQ-AC-007: verification provenance + expiry-on-source-edit ──

  it('verifyProfile records the full sign-off provenance bound to the active weighing report', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile({
      ...minimalProfileData(),
      weighingReports: [
        { bem: 432, emptyCg: 1.882, weighingDate: '2024-06-01', validFrom: '2024-06-01' },
        { bem: 430, emptyCg: 1.88, weighingDate: '2025-03-01', validFrom: '2025-03-01' },
      ],
    })

    const verified = await store.verifyProfile(draft.id, {
      verifiedBy: 'AB',
      pohRevision: 'Rev 3',
      verifiedOn: '2026-02-15',
    })

    expect(verified.verification).toEqual({
      verifiedOn: '2026-02-15',
      verifiedBy: 'AB',
      pohRevision: 'Rev 3',
      // Bound to the LATEST weighing report, not insertion order.
      sourceWeighingDate: '2025-03-01',
    })
  })

  it('verifyProfile defaults verifiedOn to today when the sign-off omits a date', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const today = new Date().toISOString().slice(0, 10)

    const verified = await store.verifyProfile(draft.id, { verifiedBy: 'JS', pohRevision: 'Rev 1' })

    expect(verified.verification?.verifiedOn).toBe(today)
  })

  it('verifyProfile rejects a sign-off with blank initials or POH revision', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())

    await expect(
      store.verifyProfile(draft.id, { verifiedBy: '   ', pohRevision: 'Rev 1' }),
    ).rejects.toThrow(IncompleteSignoffError)

    const draft2 = await store.createProfile({ ...minimalProfileData(), registration: 'D-ECSM' })
    await expect(
      store.verifyProfile(draft2.id, { verifiedBy: 'JS', pohRevision: '' }),
    ).rejects.toThrow(IncompleteSignoffError)
  })

  it('editVerifiedProfile strips the verification provenance when reverting to Draft', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id, SIGNOFF)
    expect(verified.verification).toBeDefined()

    const edited = await store.editVerifiedProfile(verified.id, { model: 'P2010' })

    expect(edited.status).toBe('draft')
    expect(edited.verification).toBeUndefined()
  })

  it('updateProfile never leaves verification provenance on a Draft', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())

    const updated = await store.updateProfile(draft.id, { model: 'P2010' })

    expect(updated.status).toBe('draft')
    expect(updated.verification).toBeUndefined()
  })

  it('reverifyProfile re-stamps provenance in place on an already-verified profile', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())
    const verified = await store.verifyProfile(draft.id, {
      verifiedBy: 'AA',
      pohRevision: 'Rev 1',
      verifiedOn: '2025-01-01',
    })

    const reattested = await store.reverifyProfile(verified.id, {
      verifiedBy: 'BB',
      pohRevision: 'Rev 2',
      verifiedOn: '2026-05-01',
    })

    expect(reattested.id).toBe(verified.id)
    expect(reattested.status).toBe('verified')
    expect(reattested.verification).toEqual({
      verifiedOn: '2026-05-01',
      verifiedBy: 'BB',
      pohRevision: 'Rev 2',
      sourceWeighingDate: '2025-01-01',
    })
    expect(store.profiles.filter((p) => p.id === verified.id)).toHaveLength(1)
  })

  it('reverifyProfile throws on a Draft profile and on a missing id', async () => {
    const store = useFleetStore()
    const draft = await store.createProfile(minimalProfileData())

    await expect(store.reverifyProfile(draft.id, SIGNOFF)).rejects.toThrow('is not verified')
    await expect(store.reverifyProfile('no-such-id', SIGNOFF)).rejects.toThrow(
      'Profile not found: no-such-id',
    )
  })
})

describe('verification calendar-date guard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T23:59:59.999Z'))
  })
  afterEach(() => vi.useRealTimers())

  it.each(['2026-03-02', '2099-01-01', '2026-02-29', '2024-02-30', 'not-a-date'])(
    'rejects %s in both actions without writes or state changes',
    async (verifiedOn) => {
      const store = useFleetStore()
      const draft = await store.createProfile(minimalProfileData())
      const verified = await store.verifyProfile(draft.id, SIGNOFF)
      const other = await store.createProfile({ ...minimalProfileData(), registration: 'D-TEST' })
      const active = useActiveAircraftStore()
      active.setActiveProfile(verified)
      const before = JSON.stringify(store.profiles)
      vi.clearAllMocks()
      await expect(store.verifyProfile(other.id, { ...SIGNOFF, verifiedOn })).rejects.toThrow(
        InvalidVerificationDateError,
      )
      await expect(store.reverifyProfile(verified.id, { ...SIGNOFF, verifiedOn })).rejects.toThrow(
        InvalidVerificationDateError,
      )
      expect(fleetRepository.create).not.toHaveBeenCalled()
      expect(fleetRepository.update).not.toHaveBeenCalled()
      expect(fleetRepository.deleteById).not.toHaveBeenCalled()
      expect(JSON.stringify(store.profiles)).toBe(before)
      expect(active.activeProfile).toEqual(verified)
    },
  )

  it.each([undefined, '   ', '2026-03-01', '2024-02-29'])(
    'preserves accepted date/default semantics for %s in both actions',
    async (verifiedOn) => {
      const store = useFleetStore()
      const draft = await store.createProfile(minimalProfileData())
      const verified = await store.verifyProfile(draft.id, { ...SIGNOFF, verifiedOn })
      const reverified = await store.reverifyProfile(verified.id, { ...SIGNOFF, verifiedOn })
      expect(verified.verification?.verifiedOn).toBe(verifiedOn?.trim() || '2026-03-01')
      expect(reverified.verification).toEqual(verified.verification)
    },
  )
})
