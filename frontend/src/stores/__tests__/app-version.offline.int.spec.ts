/**
 * Integration tests — REQ-SYS-006 / H-019 offline-enforcement (issue #271).
 *
 * Wires the real `app-version.cache.ts` (against fake-indexeddb) and a stub
 * `fetchRemoteMinSafeVersion` to assert the multi-run behaviour that the
 * unit specs only cover in pieces:
 *
 * 1. Online run with a newer remote minSafeVersion writes IndexedDB.
 * 2. Subsequent OFFLINE start of the same bundle (cache present, no fetch)
 *    keeps the higher floor and blocks the user — proving the CS-011 /
 *    TECH-023 short-circuit no longer exists.
 * 3. A truly fresh install OFFLINE (cache absent) bypasses with only the
 *    build-time constant — preserving the documented first-install
 *    bypass.
 *
 * This is the test the issue's DoD calls out explicitly:
 *   "Test: stale build blocked while offline"
 */

// @IT-SYS-STORE-001@ (FROM: @IMP-SYS-STORE-008@, @IMP-SYS-STORE-013@, @IMP-SYS-STORE-014@, @IMP-SYS-STORE-015@)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { setActivePinia, createPinia } from 'pinia'

// The remote module is the only piece we mock — IndexedDB is real (via
// fake-indexeddb) so the cache code path is exercised end-to-end.
vi.mock('@/stores/app-version.remote', () => ({
  fetchRemoteMinSafeVersion: vi.fn<() => Promise<string | null>>(),
}))

import { fetchRemoteMinSafeVersion } from '@/stores/app-version.remote'
import { loadCachedMinSafeVersion } from '@/stores/app-version.cache'
import { useAppVersionStore } from '@/stores/app-version.store'

const mockedRemote = vi.mocked(fetchRemoteMinSafeVersion)

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
  setActivePinia(createPinia())
  mockedRemote.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('REQ-SYS-006 / H-019 — offline enforcement (issue #271, CS-011/TECH-023)', () => {
  // @IT-SYS-STORE-001@ (FROM: @IMP-SYS-STORE-008@, @IMP-SYS-STORE-013@)
  it('a stale bundle that previously ran online is BLOCKED on the next offline start', async () => {
    // --- Online run #1 — newer remote floor learned and persisted -----------
    vi.stubGlobal('navigator', { onLine: true })
    mockedRemote.mockResolvedValueOnce('0.7.0') // operator-pushed kill-switch

    const onlineStore = useAppVersionStore()
    onlineStore.currentVersion = '0.7.0' // matches the newer floor — not blocked
    await onlineStore.checkMinSafeVersion()
    expect(onlineStore.versionBlocked).toBe(false)
    expect(onlineStore.minSafeVersion).toBe('0.7.0')

    // The cache must now hold the higher floor.
    const cached = await loadCachedMinSafeVersion()
    expect(cached?.value).toBe('0.7.0')

    // --- Offline run #2 — older bundle resurrected via SW rollback ---------
    // Mimic the cockpit-tablet scenario: connectivity lost, user reloads a
    // cached, older bundle. The store should still block.
    vi.unstubAllGlobals()
    vi.stubGlobal('navigator', { onLine: false })
    setActivePinia(createPinia()) // simulate a fresh app start
    mockedRemote.mockReset() // offline path must not call fetch

    const offlineStore = useAppVersionStore()
    offlineStore.currentVersion = '0.5.0' // older bundle below cached floor
    await offlineStore.checkMinSafeVersion()

    expect(offlineStore.versionBlocked).toBe(true)
    expect(offlineStore.minSafeVersion).toBe('0.7.0')
    expect(mockedRemote).not.toHaveBeenCalled()
  })

  it('a truly fresh install OFFLINE bypasses with the build-time constant', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    const store = useAppVersionStore()
    // Release 0.3.0 is at/above the build-time floor 0.3.0-alpha (SemVer §11.3:
    // a release outranks the matching pre-release), so a fresh install is not blocked.
    store.currentVersion = '0.3.0'
    await store.checkMinSafeVersion()

    expect(store.cacheFetchedAt).toBeNull()
    expect(store.versionBlocked).toBe(false)
  })

  it('cache TTL — a 30-day-old record still enforces (we never auto-bypass an expired cache)', async () => {
    // Seed the cache with an old timestamp.
    vi.stubGlobal('navigator', { onLine: true })
    mockedRemote.mockResolvedValueOnce('0.6.0')
    const seedStore = useAppVersionStore()
    seedStore.currentVersion = '0.6.0'
    await seedStore.checkMinSafeVersion(() => 0) // fetchedAt = 0

    // Restart offline, simulating a long offline trip.
    vi.unstubAllGlobals()
    vi.stubGlobal('navigator', { onLine: false })
    setActivePinia(createPinia())
    mockedRemote.mockReset()

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const store = useAppVersionStore()
    store.currentVersion = '0.4.0'
    await store.checkMinSafeVersion(() => 30 * 24 * 60 * 60 * 1000)

    expect(store.versionBlocked).toBe(true)
    expect(store.minSafeVersion).toBe('0.6.0')
    expect(consoleWarn).toHaveBeenCalled() // stale-cache warning surfaced
    consoleWarn.mockRestore()
  })
})
