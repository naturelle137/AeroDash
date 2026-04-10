/**
 * Unit tests for usePwaUpdateStore.
 * Covers update detection, offline-ready, update application, and
 * silent-update-absent guarantee (REQ-SYS-005).
 */

// @UT-SYS-STORE-017@ (FROM: @IMP-SYS-STORE-002@)
// @UT-SYS-STORE-018@ (FROM: @IMP-SYS-STORE-004@)
// @UT-SYS-STORE-019@ (FROM: @IMP-SYS-STORE-003@)
// @UT-SYS-STORE-020@ (FROM: @IMP-SYS-STORE-009@)
// @UT-SYS-STORE-026@ (FROM: @IMP-SYS-STORE-009@)
// @UT-SYS-STORE-027@ (FROM: @IMP-SYS-STORE-004@)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePwaUpdateStore } from '../pwa-update.store'

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn<() => () => void>(),
}))

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
    const reloadMock = vi.fn()
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
})
