/**
 * Unit tests for useAppVersionStore.
 *
 * Covers REQ-SYS-006 / H-019 — version comparison, blocking logic, and the
 * issue-#271 offline-enforcement behaviour: a kill-switched bundle that
 * subsequently starts offline must STILL be blocked because the previous
 * online run persisted the higher minSafeVersion to IndexedDB.
 *
 * The cache and remote-fetch primitives are unit-tested in their own specs
 * (`app-version.cache.spec.ts`, `app-version.remote.spec.ts`); here we
 * mock them so we can vary the inputs and assert the store's resolution
 * algorithm directly.
 */

// @UT-SYS-STORE-021@ (FROM: @IMP-SYS-STORE-006@)
// @UT-SYS-STORE-022@ (FROM: @IMP-SYS-STORE-007@)
// @UT-SYS-STORE-023@ (FROM: @IMP-SYS-STORE-007@)
// @UT-SYS-STORE-024@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-025@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-028@ (FROM: @IMP-SYS-STORE-007@)
// @UT-SYS-STORE-029@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-030@ (FROM: @IMP-SYS-STORE-006@)
// @UT-SYS-STORE-064@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-065@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-066@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-067@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-068@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-069@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-070@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-071@ (FROM: @IMP-SYS-STORE-018@)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the cache and remote modules so each test can stage IndexedDB / fetch
// behaviour without standing up fake-indexeddb here. The dedicated cache spec
// covers the IndexedDB code paths end-to-end.
vi.mock('@/stores/app-version.cache', () => ({
  loadCachedMinSafeVersion: vi.fn<() => Promise<unknown>>(),
  persistCachedMinSafeVersion: vi.fn<() => Promise<boolean>>(),
  clearCachedMinSafeVersion: vi.fn<() => Promise<void>>(),
}))
vi.mock('@/stores/app-version.remote', () => ({
  fetchRemoteMinSafeVersion: vi.fn<() => Promise<string | null>>(),
}))

import {
  loadCachedMinSafeVersion,
  persistCachedMinSafeVersion,
} from '@/stores/app-version.cache'
import { fetchRemoteMinSafeVersion } from '@/stores/app-version.remote'
import { useAppVersionStore, CACHE_TTL_MS } from '../app-version.store'

const mockedLoad = vi.mocked(loadCachedMinSafeVersion)
const mockedPersist = vi.mocked(persistCachedMinSafeVersion)
const mockedRemote = vi.mocked(fetchRemoteMinSafeVersion)

beforeEach(() => {
  setActivePinia(createPinia())
  mockedLoad.mockReset()
  mockedPersist.mockReset()
  mockedRemote.mockReset()
  // Default — no cache, no remote, online. Individual tests override.
  mockedLoad.mockResolvedValue(null)
  mockedPersist.mockResolvedValue(true)
  mockedRemote.mockResolvedValue(null)
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAppVersionStore — exposes state', () => {
  // @UT-SYS-STORE-021@ (FROM: @IMP-SYS-STORE-006@)
  it('exposes currentVersion and buildDate', () => {
    const store = useAppVersionStore()
    expect(typeof store.currentVersion).toBe('string')
    expect(store.currentVersion.length).toBeGreaterThan(0)
    expect(typeof store.buildDate).toBe('string')
    expect(store.buildDate.length).toBeGreaterThan(0)
  })

  // @UT-SYS-STORE-030@ (FROM: @IMP-SYS-STORE-006@)
  it('exposes minSafeVersion as a non-empty string', () => {
    const store = useAppVersionStore()
    expect(typeof store.minSafeVersion).toBe('string')
    expect(store.minSafeVersion.length).toBeGreaterThan(0)
  })
})

describe('useAppVersionStore — isVersionBelow', () => {
  // @UT-SYS-STORE-022@ (FROM: @IMP-SYS-STORE-007@)
  it('returns true when 0.2.0 < 0.3.0', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.2.0', '0.3.0')).toBe(true)
  })

  // @UT-SYS-STORE-023@ (FROM: @IMP-SYS-STORE-007@)
  it('returns false when 0.3.0 >= 0.3.0', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.3.0', '0.3.0')).toBe(false)
  })

  // @UT-SYS-STORE-028@ (FROM: @IMP-SYS-STORE-007@)
  it('returns false when version is above minimum (major bump)', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('1.0.0', '0.3.0')).toBe(false)
  })
})

describe('useAppVersionStore.checkMinSafeVersion — online, cache empty (first install)', () => {
  // @UT-SYS-STORE-024@ (FROM: @IMP-SYS-STORE-008@)
  it('blocks when current < build-time constant', async () => {
    const store = useAppVersionStore()
    store.currentVersion = '0.1.0'
    // minSafeVersion left at build-time default which is >= 0.3.0
    await store.checkMinSafeVersion()
    expect(store.versionBlocked).toBe(true)
  })

  // @UT-SYS-STORE-029@ (FROM: @IMP-SYS-STORE-008@)
  it('does not block when current meets the build-time constant', async () => {
    const store = useAppVersionStore()
    store.currentVersion = '0.3.0'
    await store.checkMinSafeVersion()
    expect(store.versionBlocked).toBe(false)
  })

  // @UT-SYS-STORE-064@ (FROM: @IMP-SYS-STORE-008@)
  it('records that the check completed and flags the cache as absent', async () => {
    const store = useAppVersionStore()
    await store.checkMinSafeVersion()
    expect(store.lastCheckCompleted).toBe(true)
    expect(store.cacheFetchedAt).not.toBeNull() // we persisted to cache after the online run
  })
})

describe('useAppVersionStore.checkMinSafeVersion — OFFLINE enforcement (issue #271 / CS-011)', () => {
  // @UT-SYS-STORE-025@ (FROM: @IMP-SYS-STORE-008@)
  it('blocks a stale build OFFLINE when the cached minSafeVersion is higher than the running version', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    mockedLoad.mockResolvedValue({
      id: 'minSafeVersion',
      value: '0.5.0',
      fetchedAt: Date.now() - 60_000, // 1 min ago — fresh cache
    })

    const store = useAppVersionStore()
    store.currentVersion = '0.4.0'

    await store.checkMinSafeVersion()

    expect(store.versionBlocked).toBe(true)
    expect(store.minSafeVersion).toBe('0.5.0')
    // Confirms the pre-fix bug — we did NOT short-circuit on !onLine.
    expect(mockedLoad).toHaveBeenCalledOnce()
    // Offline path never attempts the remote fetch (no point) and never
    // writes the cache (avoids spurious touches on every cold start).
    expect(mockedRemote).not.toHaveBeenCalled()
    expect(mockedPersist).not.toHaveBeenCalled()
  })

  // @UT-SYS-STORE-065@ (FROM: @IMP-SYS-STORE-008@)
  it('first-install OFFLINE bypass — no cache, no remote → falls back to build-time only', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    mockedLoad.mockResolvedValue(null)

    const store = useAppVersionStore()
    store.currentVersion = '0.3.0'

    await store.checkMinSafeVersion()

    // Build-time constant is >= 0.3.0, so a fresh install is NOT blocked.
    expect(store.versionBlocked).toBe(false)
    expect(store.cacheFetchedAt).toBeNull()
  })

  // @UT-SYS-STORE-066@ (FROM: @IMP-SYS-STORE-008@)
  it('warns when the cached record is older than the TTL but still enforces it', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fixedNow = 10_000_000_000
    mockedLoad.mockResolvedValue({
      id: 'minSafeVersion',
      value: '0.6.0',
      fetchedAt: fixedNow - CACHE_TTL_MS - 1, // just past the TTL
    })

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const store = useAppVersionStore()
    store.currentVersion = '0.5.0'

    await store.checkMinSafeVersion(() => fixedNow)

    expect(store.versionBlocked).toBe(true)
    expect(store.minSafeVersion).toBe('0.6.0')
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })
})

describe('useAppVersionStore.checkMinSafeVersion — online refresh', () => {
  // @UT-SYS-STORE-067@ (FROM: @IMP-SYS-STORE-008@)
  it('uses the higher of (build-time, cached, remote)', async () => {
    mockedLoad.mockResolvedValue({
      id: 'minSafeVersion',
      value: '0.4.0',
      fetchedAt: Date.now(),
    })
    mockedRemote.mockResolvedValue('0.5.0')

    const store = useAppVersionStore()
    store.currentVersion = '0.4.5'

    await store.checkMinSafeVersion()

    expect(store.minSafeVersion).toBe('0.5.0')
    expect(store.versionBlocked).toBe(true)
    expect(mockedPersist).toHaveBeenCalledWith('0.5.0', expect.any(Function))
  })

  // @UT-SYS-STORE-068@ (FROM: @IMP-SYS-STORE-008@)
  it('does not regress to a lower remote value', async () => {
    mockedLoad.mockResolvedValue({
      id: 'minSafeVersion',
      value: '0.6.0',
      fetchedAt: Date.now(),
    })
    mockedRemote.mockResolvedValue('0.3.0') // older — should be ignored

    const store = useAppVersionStore()
    store.currentVersion = '0.5.0'

    await store.checkMinSafeVersion()

    expect(store.minSafeVersion).toBe('0.6.0')
    expect(store.versionBlocked).toBe(true)
    // We still persist — refreshes the fetchedAt to keep the cache out of the stale path.
    expect(mockedPersist).toHaveBeenCalledWith('0.6.0', expect.any(Function))
  })

  // @UT-SYS-STORE-069@ (FROM: @IMP-SYS-STORE-008@)
  it('logs a warning when the remote refresh fails but keeps the existing floor', async () => {
    mockedLoad.mockResolvedValue({
      id: 'minSafeVersion',
      value: '0.5.0',
      fetchedAt: Date.now(),
    })
    mockedRemote.mockResolvedValue(null)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const store = useAppVersionStore()
    store.currentVersion = '0.4.0'

    await store.checkMinSafeVersion()

    expect(store.versionBlocked).toBe(true)
    expect(store.minSafeVersion).toBe('0.5.0')
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  // @UT-SYS-STORE-070@ (FROM: @IMP-SYS-STORE-008@)
  it('persists the cached / build-time floor on every successful online check (refreshes fetchedAt)', async () => {
    mockedRemote.mockResolvedValue(null)
    const store = useAppVersionStore()
    await store.checkMinSafeVersion()
    expect(mockedPersist).toHaveBeenCalledOnce()
  })
})

describe('useAppVersionStore.attachConnectivityRefresh', () => {
  // @UT-SYS-STORE-071@ (FROM: @IMP-SYS-STORE-018@)
  it('re-runs checkMinSafeVersion when the window fires `online`', async () => {
    const store = useAppVersionStore()
    const detach = store.attachConnectivityRefresh()

    // The handler calls the SETUP-scope `checkMinSafeVersion`, not the
    // store-instance method — so observe a downstream side effect (the
    // cache load) instead of trying to spy on the wrapped action.
    expect(mockedLoad).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('online'))
    // Give the microtask a tick to resolve the awaited mocks.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockedLoad).toHaveBeenCalledOnce()

    detach()
    window.dispatchEvent(new Event('online'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockedLoad).toHaveBeenCalledOnce() // detached — no further calls
  })
})
