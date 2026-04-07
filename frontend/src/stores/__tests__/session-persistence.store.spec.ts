/**
 * Unit tests for the session-persistence Pinia store.
 *
 * localStorage is available via jsdom (the vitest environment for P3 tests).
 * The M&B store is real (backed by a fresh Pinia) but its math adapter is
 * mocked so no actual calculations run.
 */

// @UT-SYS-STORE-001@ (FROM: @IMP-SYS-STORE-001@)

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
  it('returns null when localStorage is empty', () => {
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
  })

  it('returns null and clears storage when JSON is malformed', () => {
    localStorage.setItem('aerodash:session:payload', '{invalid json}')
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

  it('returns null and clears storage when Zod validation fails (wrong version)', () => {
    localStorage.setItem(
      'aerodash:session:payload',
      JSON.stringify({ version: 99, aircraftId: 'x', activeCategory: 'Normal', stations: [], savedAt: new Date().toISOString() }),
    )
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

  it('returns null and clears storage when schema is missing required fields', () => {
    localStorage.setItem(
      'aerodash:session:payload',
      JSON.stringify({ version: 1, aircraftId: 'x' }), // missing required fields
    )
    const store = useSessionPersistenceStore()
    expect(store.restoreSession()).toBeNull()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

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
  it('does nothing when no aircraft is loaded', () => {
    const store = useSessionPersistenceStore()
    store.saveSession()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

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

  it('payload saved by saveSession() passes restoreSession() validation', () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.saveSession()

    const restored = store.restoreSession()
    expect(restored).not.toBeNull()
    expect(restored!.aircraftId).toBe('aircraft-uuid-A')
  })

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
  it('removes the payload from localStorage', () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.saveSession()

    expect(localStorage.getItem('aerodash:session:payload')).not.toBeNull()

    store.clearSession()
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

  it('is idempotent — no error when storage is already empty', () => {
    const store = useSessionPersistenceStore()
    expect(() => store.clearSession()).not.toThrow()
  })
})

describe('useSessionPersistenceStore — startWatching() debounced auto-save', () => {
  it('does not save immediately on startWatching — waits for debounce', () => {
    loadProfile(MOCK_PROFILE_A)
    const store = useSessionPersistenceStore()
    store.startWatching()

    const mbStore = useMassBalanceStore()
    mbStore.updateStationWeight(0, 80)

    // Nothing saved yet (debounce pending)
    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
  })

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
})

describe('useSessionPersistenceStore — round-trip save → restore', () => {
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
