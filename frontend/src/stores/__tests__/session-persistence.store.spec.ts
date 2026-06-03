/**
 * Unit tests for the session-persistence Pinia store.
 *
 * localStorage is available via jsdom (the vitest environment for P3 tests).
 * The M&B store is real (backed by a fresh Pinia) but its math adapter is
 * mocked so no actual calculations run.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionPersistenceStore } from '../session-persistence.store'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import type { MathCoreResult } from '@/core/domain/mass-balance.math-types'
import type { AircraftContext } from '@/core/domain/aircraft.types'

// ── Mock the math adapter so no real calculations run ─────────────────────────

vi.mock('@/core/adapters/mass-balance.adapter', () => ({
  calculateMassBalance: vi.fn<() => MathCoreResult>(() => ({
    success: true,
    violations: [],
    zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    takeoffCenterOfGravityPoint: { arm: 1.91, mass: 530, moment: 1012.3 },
    landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    migrationPath: [],
  })),
}))

// ── Fixture data ──────────────────────────────────────────────────────────────

const MOCK_PROFILE_A: AircraftContext = {
  id: 'aircraft-uuid-A',
  registration: 'D-AAAA',
  manufacturer: 'Tecnam',
  model: 'P2008 JC',
  sourceUnit: 'kg',
  weighingReports: [
    { basicEmptyMass: 433, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
  ],
  loadPoints: [
    {
      name: 'Pilot',
      arm: 1.8,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      maxTakeoffMass: 630,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.6, mass: 300 },
        { armOrMoment: 2.2, mass: 300 },
        { armOrMoment: 2.2, mass: 700 },
        { armOrMoment: 1.6, mass: 700 },
      ],
    },
  ],
}

const MOCK_PROFILE_B: AircraftContext = {
  ...MOCK_PROFILE_A,
  id: 'aircraft-uuid-B',
  registration: 'D-BBBB',
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

// ── Helper ────────────────────────────────────────────────────────────────────

function loadProfile(profile: AircraftContext): void {
  const mbStore = useMassBalanceStore()
  mbStore.loadProfile(profile)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSessionPersistenceStore — restoreSession()', () => {
  // @UT-SYS-STORE-001@ (FROM: @IMP-SYS-STORE-001@)
  it('returns null when localStorage is empty', () => {
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
  })

  // @UT-SYS-STORE-002@ (FROM: @IMP-SYS-STORE-001@)
  it('returns null and clears storage when JSON is malformed', () => {
    localStorage.setItem('aerodash:session:payload', '{invalid json}')
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

  // @UT-SYS-STORE-003@ (FROM: @IMP-SYS-STORE-001@, @IMP-SYS-CORE-012@)
  it('drops payload, clears storage, and emits INFO notification when version is from a future build', () => {
    localStorage.setItem(
      'aerodash:session:payload',
      JSON.stringify({ version: 99, aircraftId: 'x', activeCategory: 'Normal', stations: [], savedAt: new Date().toISOString() }),
    )
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()

    const dropped = store.consumeDropNotification()
    expect(dropped).not.toBeNull()
    expect(dropped!.severity).toBe('INFO')
    expect(dropped!.code).toBe('INFO-SYS-001')
    expect(dropped!.reason).toBe('unsupported-future-version')
    expect(dropped!.storedVersion).toBe(99)
    // consume is idempotent — second drain returns null
    expect(store.consumeDropNotification()).toBeNull()
  })

  // @UT-SYS-STORE-004@ (FROM: @IMP-SYS-STORE-001@, @IMP-SYS-CORE-012@)
  it('drops payload, clears storage, and emits INFO notification when schema is missing required fields', () => {
    localStorage.setItem(
      'aerodash:session:payload',
      JSON.stringify({ version: 1, aircraftId: 'x' }), // missing required fields
    )
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()

    const dropped = store.consumeDropNotification()
    expect(dropped).not.toBeNull()
    expect(dropped!.severity).toBe('INFO')
    expect(dropped!.reason).toBe('corrupt')
  })

  // @UT-SYS-STORE-037@ (FROM: @IMP-SYS-STORE-001@, @IMP-SYS-CORE-012@)
  it('clears any prior drop notification when restoring a valid payload', () => {
    // Seed a corrupt payload first so a drop is emitted.
    localStorage.setItem('aerodash:session:payload', '{not json')
    const store = useSessionPersistenceStore()
    store.restoreSession()
    expect(store.lastDropNotification).not.toBeNull()

    // Now seed a valid payload; restore must clear the prior drop.
    const validPayload = {
      version: 1,
      aircraftId: 'aircraft-uuid-A',
      activeCategory: 'Normal',
      stations: [],
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('aerodash:session:payload', JSON.stringify(validPayload))
    const restored = store.restoreSession()
    expect(restored).not.toBeNull()
    expect(store.lastDropNotification).toBeNull()
  })

  // @UT-SYS-STORE-038@ (FROM: @IMP-SYS-STORE-001@, @IMP-SYS-CORE-012@)
  it('emits no notification when localStorage is empty (clean session is not a drop)', () => {
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
    expect(store.lastDropNotification).toBeNull()
  })

  // @UT-SYS-STORE-005@ (FROM: @IMP-SYS-STORE-001@)
  it('returns parsed payload when valid JSON with correct schema is stored', () => {
    const payload = {
      version: 1 as const,
      aircraftId: 'aircraft-uuid-A',
      activeCategory: 'Normal',
      stations: [{ index: 0, weight: 80, touched: true, verified: false }],
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('aerodash:session:payload', JSON.stringify(payload))

    const store = useSessionPersistenceStore()
    const restored = store.restoreSession()

    expect(restored).not.toBeNull()
    expect(restored!.aircraftId).toBe('aircraft-uuid-A')
    expect(restored!.activeCategory).toBe('Normal')
    expect(restored!.stations).toHaveLength(1)
    expect(restored!.stations[0]!.weight).toBe(80)
    expect(restored!.version).toBe(1)
  })

  // @UT-SYS-STORE-006@ (FROM: @IMP-SYS-STORE-001@)
  it('does not remove valid payload from storage after restore', () => {
    const payload = {
      version: 1 as const,
      aircraftId: 'aircraft-uuid-A',
      activeCategory: 'Normal',
      stations: [],
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('aerodash:session:payload', JSON.stringify(payload))

    const store = useSessionPersistenceStore()
    store.restoreSession()

    expect(localStorage.getItem('aerodash:session:payload')).not.toBeNull()
  })
})

describe('useSessionPersistenceStore — saveSession()', () => {
  // @UT-SYS-STORE-007@ (FROM: @IMP-SYS-STORE-001@)
  it('does nothing when no aircraft is loaded', () => {
    const store = useSessionPersistenceStore()
    store.saveSession()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

  // @UT-SYS-STORE-008@ (FROM: @IMP-SYS-STORE-001@)
  it('writes a valid payload to localStorage after profile load', () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.saveSession()

    const raw = localStorage.getItem('aerodash:session:payload')
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw!)
    expect(parsed.version).toBe(1)
    expect(parsed.aircraftId).toBe('aircraft-uuid-A')
    expect(parsed.activeCategory).toBe('Normal')
    expect(Array.isArray(parsed.stations)).toBe(true)
  })

  // @UT-SYS-STORE-009@ (FROM: @IMP-SYS-STORE-001@)
  it('payload saved by saveSession() passes restoreSession() validation', () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.saveSession()

    const restored = store.restoreSession()
    expect(restored).not.toBeNull()
    expect(restored!.aircraftId).toBe('aircraft-uuid-A')
  })

  // @UT-SYS-STORE-010@ (FROM: @IMP-SYS-STORE-001@)
  it('serialises station weights correctly', () => {
    loadProfile(MOCK_PROFILE_A)
    const mbStore = useMassBalanceStore()
    mbStore.updateStationWeight(0, 75)

    const store = useSessionPersistenceStore()
    store.saveSession()

    const restored = store.restoreSession()
    expect(restored!.stations[0]!.weight).toBe(75)
    expect(restored!.stations[0]!.touched).toBe(true)
  })
})

describe('useSessionPersistenceStore — clearSession()', () => {
  // @UT-SYS-STORE-011@ (FROM: @IMP-SYS-STORE-001@)
  it('removes the payload from localStorage', () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.saveSession()

    expect(localStorage.getItem('aerodash:session:payload')).not.toBeNull()

    store.clearSession()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

  // @UT-SYS-STORE-012@ (FROM: @IMP-SYS-STORE-001@)
  it('is idempotent — no error when storage is already empty', () => {
    const store = useSessionPersistenceStore()
    expect(() => store.clearSession()).not.toThrow()
  })
})

describe('useSessionPersistenceStore — cancelPendingSave()', () => {
  // @UT-SYS-STORE-098@ (FROM: @IMP-SYS-STORE-001@)
  it('cancels a pending debounced save but leaves the persisted payload in place', async () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.startWatching()

    const mbStore = useMassBalanceStore()
    // First edit → persist a baseline (weight 90) via the debounced save.
    mbStore.updateStationWeight(0, 90)
    await nextTick()
    vi.runAllTimers()
    expect(store.restoreSession()!.stations[0]!.weight).toBe(90)

    // Second edit schedules another save; cancel it before the timer fires.
    mbStore.updateStationWeight(0, 55)
    await nextTick()
    store.cancelPendingSave()
    vi.runAllTimers()

    // The cancelled save did not run (weight 55 not persisted) ...
    const restored = store.restoreSession()
    expect(restored).not.toBeNull()
    expect(restored!.stations[0]!.weight).toBe(90)
    // ... and the key is still present for a Delete-All-Data sweep to clear.
    expect(localStorage.getItem('aerodash:session:payload')).not.toBeNull()
  })

  // @UT-SYS-STORE-099@ (FROM: @IMP-SYS-STORE-001@)
  it('is a no-op when no save is pending', () => {
    const store = useSessionPersistenceStore()
    expect(() => store.cancelPendingSave()).not.toThrow()
  })
})

describe('useSessionPersistenceStore — startWatching() debounced auto-save', () => {
  // @UT-SYS-STORE-013@ (FROM: @IMP-SYS-STORE-001@)
  it('does not save immediately on startWatching — waits for debounce', () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.startWatching()

    const mbStore = useMassBalanceStore()
    mbStore.updateStationWeight(0, 80)

    // Nothing saved yet (debounce pending)
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

  // @UT-SYS-STORE-014@ (FROM: @IMP-SYS-STORE-001@)
  it('saves after debounce timeout elapses', async () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.startWatching()

    const mbStore = useMassBalanceStore()
    mbStore.updateStationWeight(0, 90)

    // Flush Vue reactivity queue so watchers schedule the debounced save,
    // then advance fake timers past the debounce window.
    await nextTick()
    vi.runAllTimers()

    const restored = store.restoreSession()
    expect(restored).not.toBeNull()
    expect(restored!.stations[0]!.weight).toBe(90)
  })

  // @UT-SYS-STORE-015@ (FROM: @IMP-SYS-STORE-001@)
  it('clears prior aircraft session when aircraft is switched', async () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.startWatching()
    store.saveSession() // persist aircraft A session

    const rawBefore = localStorage.getItem('aerodash:session:payload')
    expect(rawBefore).not.toBeNull()
    expect(JSON.parse(rawBefore!).aircraftId).toBe('aircraft-uuid-A')

    // Switch aircraft — watcher should clear the prior (aircraft A) session.
    const mbStore = useMassBalanceStore()
    mbStore.loadProfile(MOCK_PROFILE_B)

    // Flush Vue reactivity queue so the id-change watcher fires before the
    // debounced save watcher. At this point prior session must be cleared.
    await nextTick()

    // Aircraft A session is no longer in storage.
    const rawAfterSwitch = localStorage.getItem('aerodash:session:payload')
    expect(rawAfterSwitch === null || JSON.parse(rawAfterSwitch!).aircraftId !== 'aircraft-uuid-A').toBe(true)
  })

  // @UT-SYS-STORE-017@ (FROM: @IMP-SYS-STORE-001@, @IMP-MB-STORE-018@)
  it('clearProfile on mass-balance store evicts the persisted session payload', async () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.startWatching()
    store.saveSession()

    expect(localStorage.getItem('aerodash:session:payload')).not.toBeNull()

    // Aircraft hot-swap path — active-aircraft.store.setActiveProfile calls
    // clearProfile when the airframe changes; the watcher on aircraft.id must
    // treat `undefined` as a swap and evict the saved payload.
    useMassBalanceStore().clearProfile()
    await nextTick()

    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })
})

describe('useSessionPersistenceStore — startWatching() idempotency', () => {
  // @UT-SYS-STORE-018@ (FROM: @IMP-SYS-STORE-001@)
  it('does not stack watchers when called multiple times', async () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()

    // Simulate a view remount that calls startWatching again.
    store.startWatching()
    store.startWatching()
    store.startWatching()

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const mbStore = useMassBalanceStore()
    mbStore.updateStationWeight(0, 77)

    await nextTick()
    vi.runAllTimers()

    // A single mutation must produce a single persisted write, not three.
    const aerodashWrites = setItemSpy.mock.calls.filter(
      ([key]) => key === 'aerodash:session:payload',
    )
    expect(aerodashWrites).toHaveLength(1)

    setItemSpy.mockRestore()
  })
})

describe('useSessionPersistenceStore — round-trip save → restore', () => {
  // @UT-SYS-STORE-016@ (FROM: @IMP-SYS-STORE-001@)
  it('restores all station fields correctly after a full save/restore cycle', () => {
    loadProfile(MOCK_PROFILE_A)
    const mbStore = useMassBalanceStore()
    mbStore.updateStationWeight(0, 85)

    const store = useSessionPersistenceStore()
    store.saveSession()

    // Simulate a fresh page load: read from localStorage
    const restored = store.restoreSession()

    expect(restored).not.toBeNull()
    expect(restored!.version).toBe(1)
    expect(restored!.aircraftId).toBe('aircraft-uuid-A')
    expect(restored!.activeCategory).toBe('Normal')
    expect(restored!.stations).toHaveLength(1)
    expect(restored!.stations[0]).toMatchObject({
      index: 0,
      weight: 85,
      touched: true,
      verified: false,
    })
  })
})
