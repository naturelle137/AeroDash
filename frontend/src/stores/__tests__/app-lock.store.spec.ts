import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { STORAGE_KEY, CHANNEL_NAME, useAppLockStore } from '../app-lock.store'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('app lock store', () => {
  it('stays unlocked and disabled when no lock is configured', () => {
    const s = useAppLockStore()
    expect(s.locked).toBe(true) // until loaded
    s.load()
    expect(s.enabled).toBe(false)
    expect(s.locked).toBe(false)
    s.closeChannel()
  })

  it('rejects short passcodes without storing anything', async () => {
    const s = useAppLockStore()
    s.load()
    expect(await s.enable('12345')).toBe('invalid-length')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    s.closeChannel()
  })

  it('stores a salted verifier, never the passcode, and locks on a fresh load', async () => {
    const s = useAppLockStore()
    s.load()
    expect(await s.enable('correct horse')).toBe('ok')
    const raw = localStorage.getItem(STORAGE_KEY)!
    expect(raw).not.toContain('correct horse')
    expect(s.locked).toBe(false)
    s.closeChannel()

    setActivePinia(createPinia())
    const fresh = useAppLockStore()
    fresh.load()
    expect(fresh.enabled).toBe(true)
    expect(fresh.locked).toBe(true)
    expect(await fresh.unlock('wrong passcode')).toBe('wrong')
    expect(fresh.locked).toBe(true)
    expect(await fresh.unlock('correct horse')).toBe('ok')
    expect(fresh.locked).toBe(false)
    fresh.closeChannel()
  })

  it('removes the lock only with the right passcode', async () => {
    const s = useAppLockStore()
    s.load()
    await s.enable('correct horse')
    expect(await s.disable('nope nope')).toBe('wrong')
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(await s.disable('correct horse')).toBe('ok')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(s.enabled).toBe(false)
    s.closeChannel()
  })

  it('fails closed on a corrupt record and recovers after erasure', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    const s = useAppLockStore()
    s.load()
    expect(s.enabled).toBe(true)
    expect(s.locked).toBe(true)
    expect(s.recordCorrupt).toBe(true)
    localStorage.removeItem(STORAGE_KEY)
    s.reload()
    expect(s.enabled).toBe(false)
    expect(s.locked).toBe(false)
    s.closeChannel()
  })

  it('treats unreadable storage as nothing to protect', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const s = useAppLockStore()
    s.load()
    expect(s.storageUnavailable).toBe(true)
    expect(s.locked).toBe(false)
    s.closeChannel()
  })

  it('reports a refused write and does not enable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    const s = useAppLockStore()
    s.load()
    expect(await s.enable('correct horse')).toBe('storage-failed')
    expect(s.enabled).toBe(false)
    s.closeChannel()
  })

  it('locks every tab on lock and follows configuration changes from other tabs', async () => {
    const a = useAppLockStore()
    a.load()
    await a.enable('correct horse')

    setActivePinia(createPinia())
    const b = useAppLockStore()
    b.load()
    await b.unlock('correct horse')
    expect(b.locked).toBe(false)

    a.lock()
    await vi.waitFor(() => expect(b.locked).toBe(true))

    await b.unlock('correct horse')
    // Removal in another tab opens this one; its record is gone.
    localStorage.removeItem(STORAGE_KEY)
    const other = new BroadcastChannel(CHANNEL_NAME)
    other.postMessage('config')
    await vi.waitFor(() => expect(b.enabled).toBe(false))
    expect(b.locked).toBe(false)
    other.close()
    a.closeChannel()
    b.closeChannel()
  })
})
