/**
 * Unit tests for app-version.cache.ts
 * Uses fake-indexeddb to exercise the IndexedDB code paths without a browser.
 *
 * Covers REQ-SYS-006 / H-019 — the offline-enforcement substrate from issue
 * #271 (CS-011 / TECH-023). The store relies on these primitives being
 * (a) total — they never throw, even when the storage backend is broken,
 * and (b) shape-strict — a corrupt record is treated as absent so a bad
 * write from an older bundle cannot demote the floor.
 */

// @UT-SYS-STORE-046@ (FROM: @IMP-SYS-STORE-013@)
// @UT-SYS-STORE-047@ (FROM: @IMP-SYS-STORE-014@)
// @UT-SYS-STORE-048@ (FROM: @IMP-SYS-STORE-014@)
// @UT-SYS-STORE-049@ (FROM: @IMP-SYS-STORE-014@)
// @UT-SYS-STORE-050@ (FROM: @IMP-SYS-STORE-015@)
// @UT-SYS-STORE-051@ (FROM: @IMP-SYS-STORE-015@)
// @UT-SYS-STORE-052@ (FROM: @IMP-SYS-STORE-015@)
// @UT-SYS-STORE-053@ (FROM: @IMP-SYS-STORE-016@)
// @UT-SYS-STORE-054@ (FROM: @IMP-SYS-STORE-014@)

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import {
  loadCachedMinSafeVersion,
  persistCachedMinSafeVersion,
  clearCachedMinSafeVersion,
  MIN_SAFE_VERSION_KEY,
} from '../app-version.cache'

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
})

describe('app-version.cache — load / persist round-trip', () => {
  // @UT-SYS-STORE-046@ (FROM: @IMP-SYS-STORE-013@)
  it('returns null when the store has never been written', async () => {
    const out = await loadCachedMinSafeVersion()
    expect(out).toBeNull()
  })

  // @UT-SYS-STORE-047@ (FROM: @IMP-SYS-STORE-014@)
  it('persists and loads a SemVer value', async () => {
    const ok = await persistCachedMinSafeVersion('0.4.0', () => 1_700_000_000_000)
    expect(ok).toBe(true)

    const loaded = await loadCachedMinSafeVersion()
    expect(loaded).not.toBeNull()
    expect(loaded?.id).toBe(MIN_SAFE_VERSION_KEY)
    expect(loaded?.value).toBe('0.4.0')
    expect(loaded?.fetchedAt).toBe(1_700_000_000_000)
  })

  // @UT-SYS-STORE-048@ (FROM: @IMP-SYS-STORE-014@)
  it('overwrites a prior record on second persist (highest floor wins via caller)', async () => {
    await persistCachedMinSafeVersion('0.4.0', () => 1_000)
    await persistCachedMinSafeVersion('0.5.0', () => 2_000)
    const loaded = await loadCachedMinSafeVersion()
    expect(loaded?.value).toBe('0.5.0')
    expect(loaded?.fetchedAt).toBe(2_000)
  })
})

describe('app-version.cache — input validation', () => {
  // @UT-SYS-STORE-049@ (FROM: @IMP-SYS-STORE-015@)
  it('rejects non-SemVer input', async () => {
    expect(await persistCachedMinSafeVersion('not-a-version')).toBe(false)
    expect(await persistCachedMinSafeVersion('0.1')).toBe(false)
    // Use `as unknown as string` to bypass TS for the bad-shape branch.
    expect(await persistCachedMinSafeVersion(123 as unknown as string)).toBe(false)
    expect(await persistCachedMinSafeVersion('' as string)).toBe(false)
    const loaded = await loadCachedMinSafeVersion()
    expect(loaded).toBeNull()
  })

  // @UT-SYS-STORE-050@ (FROM: @IMP-SYS-STORE-015@)
  it('accepts a pre-release SemVer suffix (0.4.0-alpha)', async () => {
    expect(await persistCachedMinSafeVersion('0.4.0-alpha')).toBe(true)
    const loaded = await loadCachedMinSafeVersion()
    expect(loaded?.value).toBe('0.4.0-alpha')
  })
})

describe('app-version.cache — corrupt-record defence', () => {
  // @UT-SYS-STORE-051@ (FROM: @IMP-SYS-STORE-014@)
  it('returns null when the stored record fails the shape guard', async () => {
    // Write a structurally invalid record directly (bypassing persist).
    const req = indexedDB.open('aerodash-app-version', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('version_policy', { keyPath: 'id' })
    }
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    const db = req.result
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('version_policy', 'readwrite')
      tx.objectStore('version_policy').put({
        id: MIN_SAFE_VERSION_KEY,
        // intentionally wrong shape — value is a number, fetchedAt missing
        value: 99,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()

    const loaded = await loadCachedMinSafeVersion()
    expect(loaded).toBeNull()
  })
})

describe('app-version.cache — IndexedDB unavailable', () => {
  // @UT-SYS-STORE-052@ (FROM: @IMP-SYS-STORE-014@, @IMP-SYS-STORE-015@)
  it('falls back to null / false instead of throwing when storage is unreachable', async () => {
    // Replace indexedDB with an object whose `open()` throws synchronously
    // — simulates Safari private mode or a locked-down sandboxed iframe.
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open() {
          throw new Error('DOMException: storage disabled')
        },
      },
      writable: true,
      configurable: true,
    })
    const loaded = await loadCachedMinSafeVersion()
    expect(loaded).toBeNull()
    const persisted = await persistCachedMinSafeVersion('0.4.0')
    expect(persisted).toBe(false)
  })
})

describe('app-version.cache — clear', () => {
  // @UT-SYS-STORE-053@ (FROM: @IMP-SYS-STORE-016@)
  it('clears the cached record', async () => {
    await persistCachedMinSafeVersion('0.4.0')
    expect(await loadCachedMinSafeVersion()).not.toBeNull()
    await clearCachedMinSafeVersion()
    expect(await loadCachedMinSafeVersion()).toBeNull()
  })

  // @UT-SYS-STORE-054@ (FROM: @IMP-SYS-STORE-014@)
  it('clear is idempotent on an empty store', async () => {
    await clearCachedMinSafeVersion()
    await clearCachedMinSafeVersion()
    expect(await loadCachedMinSafeVersion()).toBeNull()
  })
})
