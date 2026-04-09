/**
 * Unit tests for usePwaUpdateStore.
 * Covers update detection, offline-ready, and update application.
 */

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
})
