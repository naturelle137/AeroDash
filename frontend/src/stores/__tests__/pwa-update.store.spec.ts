/**
 * Unit tests for usePwaUpdateStore and the main.ts update-handler factory.
 * Covers update detection, offline-ready, update application,
 * silent-update-absent guarantee (REQ-SYS-005), cold-start silent update
 * (ADR-007 §Cold-start silent update exception), the sessionStorage
 * classifier (H-019 fail-safe), and the sessionStorage-advisory state
 * raised on storage failure (issue #263 — DP-004 / CS-012).
 */

// @UT-SYS-STORE-017@ (FROM: @IMP-SYS-STORE-002@)
// @UT-SYS-STORE-018@ (FROM: @IMP-SYS-STORE-004@)
// @UT-SYS-STORE-019@ (FROM: @IMP-SYS-STORE-003@)
// @UT-SYS-STORE-020@ (FROM: @IMP-SYS-STORE-009@)
// @UT-SYS-STORE-026@ (FROM: @IMP-SYS-STORE-009@)
// @UT-SYS-STORE-027@ (FROM: @IMP-SYS-STORE-004@)
// @UT-SYS-STORE-028@ (FROM: @IMP-SYS-STORE-010@)
// @UT-SYS-STORE-029@ (FROM: @IMP-SYS-STORE-010@)
// @UT-SYS-STORE-030@ (FROM: @IMP-SYS-STORE-010@)
// @UT-SYS-STORE-031@ (FROM: @IMP-SYS-STORE-010@)
// @UT-SYS-STORE-032@ (FROM: @IMP-SYS-STORE-010@)
// @UT-SYS-STORE-039@ (FROM: @IMP-SYS-STORE-011@)
// @UT-SYS-STORE-040@ (FROM: @IMP-SYS-STORE-011@)
// @UT-SYS-STORE-041@ (FROM: @IMP-SYS-STORE-011@)
// @UT-SYS-STORE-042@ (FROM: @IMP-SYS-STORE-012@)
// @UT-SYS-STORE-043@ (FROM: @IMP-SYS-STORE-010@)
// @UT-SYS-STORE-044@ (FROM: @IMP-SYS-STORE-010@)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePwaUpdateStore } from '../pwa-update.store'
import { captureAndMarkSession, createUpdateHandler } from '../../main'

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn<() => () => void>(),
}))

// ---------------------------------------------------------------------------
// Store tests
// ---------------------------------------------------------------------------

describe('usePwaUpdateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @UT-SYS-STORE-017@ (FROM: @IMP-SYS-STORE-002@)
  it('needsUpdate is false initially', () => {
    const store = usePwaUpdateStore()
    expect(store.needsUpdate).toBe(false)
  })

  // @UT-SYS-STORE-018@ (FROM: @IMP-SYS-STORE-004@)
  it('onNeedsRefresh sets needsUpdate to true', () => {
    const store = usePwaUpdateStore()
    store.onNeedsRefresh()
    expect(store.needsUpdate).toBe(true)
  })

  // @UT-SYS-STORE-019@ (FROM: @IMP-SYS-STORE-003@)
  it('offlineReady set by onOfflineReady', () => {
    const store = usePwaUpdateStore()
    expect(store.offlineReady).toBe(false)
    store.onOfflineReady()
    expect(store.offlineReady).toBe(true)
  })

  // @UT-SYS-STORE-020@ (FROM: @IMP-SYS-STORE-009@)
  it('applyUpdate calls updateSW when set', async () => {
    const store = usePwaUpdateStore()
    const mockUpdateSW = vi.fn<(reloadPage?: boolean) => Promise<void>>().mockResolvedValue(undefined)
    store.setUpdateSW(mockUpdateSW)
    store.onNeedsRefresh()
    await store.applyUpdate()
    expect(mockUpdateSW).toHaveBeenCalledWith(true)
  })

  // @UT-SYS-STORE-026@ (FROM: @IMP-SYS-STORE-009@)
  it('applyUpdate falls back to window.location.reload when no updateSW is set', async () => {
    const reloadMock = vi.fn<() => void>()
    vi.stubGlobal('location', { reload: reloadMock })
    const store = usePwaUpdateStore()
    // Do NOT call setUpdateSW — simulate missing SW callback
    await store.applyUpdate()
    expect(reloadMock).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  // @UT-SYS-STORE-027@ (FROM: @IMP-SYS-STORE-004@)
  it('silent auto-update is absent — needsUpdate stays false until onNeedsRefresh is called', () => {
    const store = usePwaUpdateStore()
    // Simulate the store being initialised and SW registered, but no update signal yet.
    const mockUpdateSW = vi.fn<(reloadPage?: boolean) => Promise<void>>().mockResolvedValue(undefined)
    store.setUpdateSW(mockUpdateSW)
    // needsUpdate must remain false — SW must NOT have silently applied an update.
    expect(store.needsUpdate).toBe(false)
    // mockUpdateSW must not have been called automatically.
    expect(mockUpdateSW).not.toHaveBeenCalled()
  })

  // @UT-SYS-STORE-028@ (FROM: @IMP-SYS-STORE-010@)
  it('applyColdStartUpdate calls _updateSW(true) when set', async () => {
    const store = usePwaUpdateStore()
    const mockUpdateSW = vi.fn<(reloadPage?: boolean) => Promise<void>>().mockResolvedValue(undefined)
    store.setUpdateSW(mockUpdateSW)
    await store.applyColdStartUpdate()
    expect(mockUpdateSW).toHaveBeenCalledExactlyOnceWith(true)
  })

  // @UT-SYS-STORE-029@ (FROM: @IMP-SYS-STORE-010@)
  it('applyColdStartUpdate falls back to window.location.reload when _updateSW is unset', async () => {
    const reloadMock = vi.fn<() => void>()
    vi.stubGlobal('location', { reload: reloadMock })
    const store = usePwaUpdateStore()
    // Do NOT call setUpdateSW — simulate timing window where SW callback is absent
    await store.applyColdStartUpdate()
    expect(reloadMock).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  // @UT-SYS-STORE-039@ (FROM: @IMP-SYS-STORE-011@)
  it('sessionStorageAdvisory is false initially (issue #263)', () => {
    const store = usePwaUpdateStore()
    expect(store.sessionStorageAdvisory).toBe(false)
  })

  // @UT-SYS-STORE-040@ (FROM: @IMP-SYS-STORE-011@)
  it('raiseSessionStorageAdvisory sets the advisory flag (issue #263)', () => {
    const store = usePwaUpdateStore()
    store.raiseSessionStorageAdvisory()
    expect(store.sessionStorageAdvisory).toBe(true)
  })

  // @UT-SYS-STORE-041@ (FROM: @IMP-SYS-STORE-011@)
  it('raiseSessionStorageAdvisory is idempotent — repeated calls leave the flag true (issue #263)', () => {
    const store = usePwaUpdateStore()
    store.raiseSessionStorageAdvisory()
    store.raiseSessionStorageAdvisory()
    store.raiseSessionStorageAdvisory()
    expect(store.sessionStorageAdvisory).toBe(true)
  })

  // @UT-SYS-STORE-042@ (FROM: @IMP-SYS-STORE-012@)
  it('dismissSessionStorageAdvisory clears the flag (issue #263)', () => {
    const store = usePwaUpdateStore()
    store.raiseSessionStorageAdvisory()
    store.dismissSessionStorageAdvisory()
    expect(store.sessionStorageAdvisory).toBe(false)
  })

  // @UT-SYS-STORE-045@ (FROM: @IMP-SYS-STORE-011@)
  it('once dismissed, raiseSessionStorageAdvisory is a no-op (one-time-per-tab invariant, NIT-11 PR #361)', () => {
    const store = usePwaUpdateStore()
    store.raiseSessionStorageAdvisory()
    store.dismissSessionStorageAdvisory()
    // Simulate a router-guard retry / SW re-registration that re-invokes the
    // bootstrap path: the banner must not re-surface for the rest of the tab.
    store.raiseSessionStorageAdvisory()
    expect(store.sessionStorageAdvisory).toBe(false)
    expect(store.sessionStorageAdvisoryDismissed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// captureAndMarkSession tests
// ---------------------------------------------------------------------------

describe('captureAndMarkSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  // @UT-SYS-STORE-030@ (FROM: @IMP-SYS-STORE-010@)
  it('returns wasActiveSession=false on first call (cold start) and sets the session key', () => {
    const result = captureAndMarkSession()
    expect(result.wasActiveSession).toBe(false)
    expect(result.sessionStorageAvailable).toBe(true)
    expect(sessionStorage.getItem('aerodash.session.active')).toBe('1')
  })

  // @UT-SYS-STORE-031@ (FROM: @IMP-SYS-STORE-010@)
  it('returns wasActiveSession=true on second call within the same session (in-session path)', () => {
    captureAndMarkSession() // cold start — sets the key
    const result = captureAndMarkSession() // same tab, key already present
    expect(result.wasActiveSession).toBe(true)
    expect(result.sessionStorageAvailable).toBe(true)
  })

  // @UT-SYS-STORE-032@ (FROM: @IMP-SYS-STORE-010@)
  it('fails-safe (wasActiveSession=true) and reports sessionStorageAvailable=false when sessionStorage throws (issue #263)', () => {
    const originalStorage = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new Error('storage disabled')
      },
      configurable: true,
    })
    try {
      const result = captureAndMarkSession()
      expect(result.wasActiveSession).toBe(true)
      expect(result.sessionStorageAvailable).toBe(false)
    } finally {
      // NIT-12 (PR #361). Restore even if the assertions above throw so a
      // regression in this test cannot cascade into UT-SYS-STORE-035 (which
      // calls `sessionStorage.setItem(...)` directly) and mask the real
      // failure with a "storage disabled" stack trace.
      if (originalStorage) {
        Object.defineProperty(window, 'sessionStorage', originalStorage)
      }
    }
  })

  // @UT-SYS-STORE-035@ (FROM: @IMP-SYS-STORE-010@)
  it('returns wasActiveSession=false on a browser reload even though sessionStorage still has the flag', () => {
    sessionStorage.setItem('aerodash.session.active', '1')
    const getEntriesSpy = vi
      .spyOn(performance, 'getEntriesByType')
      .mockReturnValue([
        { type: 'reload' } as unknown as PerformanceNavigationTiming,
      ] as PerformanceEntryList)

    const result = captureAndMarkSession()
    expect(result.wasActiveSession).toBe(false)
    expect(result.sessionStorageAvailable).toBe(true)

    getEntriesSpy.mockRestore()
  })

  // @UT-SYS-STORE-036@ (FROM: @IMP-SYS-STORE-010@)
  it('returns wasActiveSession=true for a non-reload navigation when the session key is already set', () => {
    sessionStorage.setItem('aerodash.session.active', '1')
    const getEntriesSpy = vi
      .spyOn(performance, 'getEntriesByType')
      .mockReturnValue([
        { type: 'navigate' } as unknown as PerformanceNavigationTiming,
      ] as PerformanceEntryList)

    const result = captureAndMarkSession()
    expect(result.wasActiveSession).toBe(true)
    expect(result.sessionStorageAvailable).toBe(true)

    getEntriesSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// createUpdateHandler tests
// ---------------------------------------------------------------------------

describe('createUpdateHandler', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // @UT-SYS-STORE-033@ (FROM: @IMP-SYS-STORE-010@)
  it('calls onNeedsRefresh (banner) when wasActiveSession is true', () => {
    const store = usePwaUpdateStore()
    const onNeedsRefreshSpy = vi.spyOn(store, 'onNeedsRefresh')
    const applyColdStartSpy = vi.spyOn(store, 'applyColdStartUpdate')

    const handler = createUpdateHandler(store, { wasActiveSession: true })
    handler()

    expect(onNeedsRefreshSpy).toHaveBeenCalledOnce()
    expect(applyColdStartSpy).not.toHaveBeenCalled()
    expect(store.needsUpdate).toBe(true)
  })

  // @UT-SYS-STORE-034@ (FROM: @IMP-SYS-STORE-010@)
  it('calls applyColdStartUpdate (silent) when wasActiveSession is false', () => {
    const store = usePwaUpdateStore()
    const onNeedsRefreshSpy = vi.spyOn(store, 'onNeedsRefresh')
    const applyColdStartSpy = vi
      .spyOn(store, 'applyColdStartUpdate')
      .mockResolvedValue(undefined)

    const handler = createUpdateHandler(store, { wasActiveSession: false })
    handler()

    expect(applyColdStartSpy).toHaveBeenCalledOnce()
    expect(onNeedsRefreshSpy).not.toHaveBeenCalled()
    expect(store.needsUpdate).toBe(false)
  })
})
