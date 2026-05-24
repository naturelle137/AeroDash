/**
 * Unit tests for useAppVersionStore.
 * Covers version comparison, blocking logic, offline skip, and
 * minimum safe version gate (REQ-SYS-006, INFO-SYS-001).
 */

// @UT-SYS-STORE-021@ (FROM: @IMP-SYS-STORE-006@)
// @UT-SYS-STORE-022@ (FROM: @IMP-SYS-STORE-007@)
// @UT-SYS-STORE-023@ (FROM: @IMP-SYS-STORE-007@)
// @UT-SYS-STORE-024@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-025@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-028@ (FROM: @IMP-SYS-STORE-007@)
// @UT-SYS-STORE-029@ (FROM: @IMP-SYS-STORE-008@)
// @UT-SYS-STORE-030@ (FROM: @IMP-SYS-STORE-006@)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppVersionStore } from '../app-version.store'

describe('useAppVersionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @UT-SYS-STORE-021@ (FROM: @IMP-SYS-STORE-006@)
  it('exposes currentVersion and buildDate', () => {
    const store = useAppVersionStore()
    expect(typeof store.currentVersion).toBe('string')
    expect(store.currentVersion.length).toBeGreaterThan(0)
    expect(typeof store.buildDate).toBe('string')
    expect(store.buildDate.length).toBeGreaterThan(0)
  })

  // @UT-SYS-STORE-022@ (FROM: @IMP-SYS-STORE-007@)
  it('isVersionBelow returns true when 0.2.0 < 0.3.0', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.2.0', '0.3.0')).toBe(true)
  })

  // @UT-SYS-STORE-023@ (FROM: @IMP-SYS-STORE-007@)
  it('isVersionBelow returns false when 0.3.0 >= 0.3.0', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.3.0', '0.3.0')).toBe(false)
  })

  // @UT-SYS-STORE-024@ (FROM: @IMP-SYS-STORE-008@)
  it('checkMinSafeVersion sets versionBlocked when below minimum', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const store = useAppVersionStore()
    store.currentVersion = '0.1.0'
    store.minSafeVersion = '0.3.0'
    await store.checkMinSafeVersion()
    expect(store.versionBlocked).toBe(true)
    vi.unstubAllGlobals()
  })

  // @UT-SYS-STORE-025@ (FROM: @IMP-SYS-STORE-008@)
  it('checkMinSafeVersion skips when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const store = useAppVersionStore()
    store.currentVersion = '0.1.0'
    store.minSafeVersion = '0.3.0'
    await store.checkMinSafeVersion()
    expect(store.versionBlocked).toBe(false)
    vi.unstubAllGlobals()
  })

  // @UT-SYS-STORE-028@ (FROM: @IMP-SYS-STORE-007@)
  it('isVersionBelow returns false when version is above minimum (major bump)', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('1.0.0', '0.3.0')).toBe(false)
  })

  // @UT-SYS-STORE-029@ (FROM: @IMP-SYS-STORE-008@)
  it('checkMinSafeVersion does NOT set versionBlocked when version meets minimum', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const store = useAppVersionStore()
    store.currentVersion = '0.3.0'
    store.minSafeVersion = '0.3.0'
    await store.checkMinSafeVersion()
    expect(store.versionBlocked).toBe(false)
    vi.unstubAllGlobals()
  })

  // @UT-SYS-STORE-030@ (FROM: @IMP-SYS-STORE-006@)
  it('exposes minSafeVersion as a non-empty string', () => {
    const store = useAppVersionStore()
    expect(typeof store.minSafeVersion).toBe('string')
    expect(store.minSafeVersion.length).toBeGreaterThan(0)
  })
})
