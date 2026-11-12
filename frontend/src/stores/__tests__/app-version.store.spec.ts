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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import type { CachedMinSafeVersionResult } from '@/stores/app-version.cache'

// Mock the cache and remote modules so each test can stage IndexedDB / fetch
// behaviour without standing up fake-indexeddb here. The dedicated cache spec
// covers the IndexedDB code paths end-to-end.
vi.mock('@/stores/app-version.cache', () => ({
  loadCachedMinSafeVersion: vi.fn<() => Promise<unknown>>(),
  inspectCachedMinSafeVersion: vi.fn<() => Promise<CachedMinSafeVersionResult>>(),
  persistCachedMinSafeVersion: vi.fn<() => Promise<boolean>>(),
  clearCachedMinSafeVersion: vi.fn<() => Promise<void>>(),
}))
vi.mock('@/stores/app-version.remote', () => ({
  fetchRemoteMinSafeVersion: vi.fn<() => Promise<string | null>>(),
}))

import {
  inspectCachedMinSafeVersion,
  persistCachedMinSafeVersion,
} from '@/stores/app-version.cache'
import { fetchRemoteMinSafeVersion } from '@/stores/app-version.remote'
import {
  useAppVersionStore,
  attachConnectivityRefresh,
  resolveBuildTimeMinSafeVersion,
  FAIL_CLOSED_MIN_SAFE_VERSION,
  CACHE_TTL_MS,
} from '../app-version.store'
import { pickHigherVersion } from '@/stores/app-version.semver'

const mockedInspect = vi.mocked(inspectCachedMinSafeVersion)
const mockedPersist = vi.mocked(persistCachedMinSafeVersion)
const mockedRemote = vi.mocked(fetchRemoteMinSafeVersion)

beforeEach(() => {
  setActivePinia(createPinia())
  mockedInspect.mockReset()
  mockedPersist.mockReset()
  mockedRemote.mockReset()
  // Default — no cache, no remote, online. Individual tests override.
  mockedInspect.mockResolvedValue({ kind: 'absent' })
  mockedPersist.mockResolvedValue(true)
  mockedRemote.mockResolvedValue(null)
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAppVersionStore — exposes state', () => {
  it('exposes currentVersion and buildDate', () => {
    const store = useAppVersionStore()
    expect(typeof store.currentVersion).toBe('string')
    expect(store.currentVersion.length).toBeGreaterThan(0)
    expect(typeof store.buildDate).toBe('string')
    expect(store.buildDate.length).toBeGreaterThan(0)
  })

  it('exposes minSafeVersion as a non-empty string', () => {
    const store = useAppVersionStore()
    expect(typeof store.minSafeVersion).toBe('string')
    expect(store.minSafeVersion.length).toBeGreaterThan(0)
  })
})

describe('useAppVersionStore — isVersionBelow', () => {
  it('returns true when 0.2.0 < 0.3.0', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.2.0', '0.3.0')).toBe(true)
  })

  it('returns false when 0.3.0 >= 0.3.0', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.3.0', '0.3.0')).toBe(false)
  })

  it('returns false when version is above minimum (major bump)', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('1.0.0', '0.3.0')).toBe(false)
  })

  // build metadata must not NaN-collapse the comparator. Without the fix
  // `parse('0.5.0+build.7')` produced `[0, 5, NaN]` and `0 < NaN` resolved
  // to `false`, silently failing to block.
  it('correctly orders versions with +build metadata', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.5.0', '0.5.0+build.7')).toBe(false) // same
    expect(store.isVersionBelow('0.4.0+build.1', '0.5.0+build.7')).toBe(true)
    expect(store.isVersionBelow('0.5.0+build.7', '0.4.0')).toBe(false)
  })

  // pre-release ordering per SemVer §11: `0.4.0-alpha < 0.4.0` must hold so
  // an alpha bundle below its stable kill-switch floor is actually blocked.
  it('orders pre-release suffixes per SemVer §11', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.4.0-alpha', '0.4.0')).toBe(true)
    expect(store.isVersionBelow('0.4.0', '0.4.0-alpha')).toBe(false)
    expect(store.isVersionBelow('0.4.0-alpha', '0.4.0-beta')).toBe(true)
    expect(store.isVersionBelow('0.4.0-alpha.1', '0.4.0-alpha.2')).toBe(true)
    expect(store.isVersionBelow('0.4.0-alpha', '0.4.0-alpha.1')).toBe(true) // longer wins
    // Numeric < alphanumeric per SemVer §11.4.3
    expect(store.isVersionBelow('0.4.0-1', '0.4.0-alpha')).toBe(true)
  })

  // Review-iteration: numeric pre-release identifiers beyond 2^53 must order by
  // value, not collapse to the same double via Number().
  it('orders very long numeric pre-release identifiers without float precision loss', () => {
    const store = useAppVersionStore()
    expect(store.isVersionBelow('0.0.0-99999999999999999998', '0.0.0-99999999999999999999')).toBe(true)
    expect(store.isVersionBelow('0.0.0-99999999999999999999', '0.0.0-99999999999999999998')).toBe(false)
    expect(store.isVersionBelow('0.0.0-9', '0.0.0-10')).toBe(true) // 9 < 10 (longer decimal wins)
    expect(store.isVersionBelow('0.0.0-10', '0.0.0-9')).toBe(false)
  })
})

describe('useAppVersionStore.checkMinSafeVersion — online, cache empty (first install)', () => {
  it('blocks when current < build-time constant', async () => {
    const store = useAppVersionStore()
    store.currentVersion = '0.1.0'
    // minSafeVersion left at build-time default which is >= 0.3.0
    await store.checkMinSafeVersion()
    expect(store.versionBlocked).toBe(true)
  })

  it('does not block when current meets the build-time constant', async () => {
    const store = useAppVersionStore()
    store.currentVersion = '0.3.0'
    await store.checkMinSafeVersion()
    expect(store.versionBlocked).toBe(false)
  })

  it('records that the check completed and refreshes cacheFetchedAt on a successful online persist', async () => {
    const store = useAppVersionStore()
    await store.checkMinSafeVersion(() => 5_000)
    expect(store.lastCheckCompleted).toBe(true)
    expect(store.cacheFetchedAt).toBe(5_000) // online run persisted the floor
  })
})

describe('useAppVersionStore.checkMinSafeVersion — OFFLINE enforcement', () => {
  it('blocks a stale build OFFLINE when the cached minSafeVersion is higher than the running version', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    mockedInspect.mockResolvedValue({
      kind: 'hit',
      value: '0.5.0',
      fetchedAt: Date.now() - 60_000, // 1 min ago — fresh cache
    })

    const store = useAppVersionStore()
    store.currentVersion = '0.4.0'

    await store.checkMinSafeVersion()

    expect(store.versionBlocked).toBe(true)
    expect(store.minSafeVersion).toBe('0.5.0')
    // Confirms the pre-fix bug — we did NOT short-circuit on !onLine.
    expect(mockedInspect).toHaveBeenCalledOnce()
    // Offline path never attempts the remote fetch (no point) and never
    // writes the cache (avoids spurious touches on every cold start).
    expect(mockedRemote).not.toHaveBeenCalled()
    expect(mockedPersist).not.toHaveBeenCalled()
  })

  it('first-install OFFLINE bypass — no cache, no remote → falls back to build-time only', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    mockedInspect.mockResolvedValue({ kind: 'absent' })

    const store = useAppVersionStore()
    store.currentVersion = '0.3.0'

    await store.checkMinSafeVersion()

    // Build-time constant is >= 0.3.0, so a fresh install is NOT blocked.
    expect(store.versionBlocked).toBe(false)
    expect(store.cacheFetchedAt).toBeNull()
  })

  it('warns when the cached record is older than the TTL but still enforces it', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fixedNow = 10_000_000_000
    mockedInspect.mockResolvedValue({
      kind: 'hit',
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

describe('useAppVersionStore.checkMinSafeVersion — differentiated logging (review Minor #10)', () => {
  it('logs INFO on absent cache (first install) and WARN on corrupt / unavailable', async () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // Absent → INFO
    mockedInspect.mockResolvedValueOnce({ kind: 'absent' })
    const s1 = useAppVersionStore()
    await s1.checkMinSafeVersion()
    expect(consoleInfo).toHaveBeenCalled()
    const absentCalls = consoleInfo.mock.calls.flat().join(' ')
    expect(absentCalls).toMatch(/MIN_SAFE_VERSION_CACHE_ABSENT/)

    // Corrupt → WARN with distinct code
    consoleInfo.mockClear()
    consoleWarn.mockClear()
    setActivePinia(createPinia())
    mockedInspect.mockResolvedValueOnce({ kind: 'corrupt' })
    const s2 = useAppVersionStore()
    await s2.checkMinSafeVersion()
    const corruptCalls = consoleWarn.mock.calls.flat().join(' ')
    expect(corruptCalls).toMatch(/MIN_SAFE_VERSION_CACHE_CORRUPT/)

    // Unavailable → WARN with distinct code
    consoleWarn.mockClear()
    setActivePinia(createPinia())
    mockedInspect.mockResolvedValueOnce({ kind: 'unavailable' })
    const s3 = useAppVersionStore()
    await s3.checkMinSafeVersion()
    const unavailableCalls = consoleWarn.mock.calls.flat().join(' ')
    expect(unavailableCalls).toMatch(/MIN_SAFE_VERSION_CACHE_UNAVAILABLE/)

    consoleInfo.mockRestore()
    consoleWarn.mockRestore()
  })
})

describe('useAppVersionStore.checkMinSafeVersion — online refresh', () => {
  it('uses the higher of (build-time, cached, remote)', async () => {
    mockedInspect.mockResolvedValue({
      kind: 'hit',
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

  it('does not regress to a lower remote value', async () => {
    mockedInspect.mockResolvedValue({
      kind: 'hit',
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

  it('logs a warning when the remote refresh fails but keeps the existing floor', async () => {
    mockedInspect.mockResolvedValue({
      kind: 'hit',
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

  it('persists the cached / build-time floor on every successful online check (refreshes fetchedAt)', async () => {
    mockedRemote.mockResolvedValue(null)
    const store = useAppVersionStore()
    await store.checkMinSafeVersion()
    expect(mockedPersist).toHaveBeenCalledOnce()
  })

  // timestamp parity + persist-failure consistency.
  it('passes a frozen clock to persist so on-disk and in-memory timestamps match', async () => {
    mockedRemote.mockResolvedValue(null)
    const store = useAppVersionStore()
    let ticks = 0
    // Each call to `now` would otherwise return a fresh, incrementing value.
    await store.checkMinSafeVersion(() => ++ticks)
    expect(mockedPersist).toHaveBeenCalledOnce()
    const firstCall = mockedPersist.mock.calls[0]
    expect(firstCall).toBeDefined()
    const clockArg = firstCall![1] as () => number
    // The clock the persist call sees must be a stable constant — calling it
    // multiple times yields the same value as the in-memory store ref.
    const ts1 = clockArg()
    const ts2 = clockArg()
    expect(ts1).toBe(ts2)
    expect(store.cacheFetchedAt).toBe(ts1)
  })

  // on persist-failure cacheFetchedAt must reflect the record ACTUALLY on
  // disk — keep a prior hit's fetchedAt (the failed write left it untouched),
  // null only when nothing is on disk.
  it('on persist failure keeps the on-disk record fetchedAt for a hit, null otherwise', async () => {
    mockedRemote.mockResolvedValue(null)
    mockedPersist.mockResolvedValue(false) // simulate storage hiccup

    // Cache hit: the disk record is untouched by a failed write, so the
    // diagnostic must keep reflecting it — NOT report a fresh-install null.
    mockedInspect.mockResolvedValue({ kind: 'hit', value: '0.4.0', fetchedAt: 1_000 })
    const hitStore = useAppVersionStore()
    await hitStore.checkMinSafeVersion(() => 9_000)
    expect(hitStore.cacheFetchedAt).toBe(1_000)

    // No prior record (absent): nothing on disk, so null is correct.
    setActivePinia(createPinia())
    mockedInspect.mockResolvedValue({ kind: 'absent' })
    const absentStore = useAppVersionStore()
    await absentStore.checkMinSafeVersion(() => 9_000)
    expect(absentStore.cacheFetchedAt).toBeNull()
  })
})

describe('useAppVersionStore.checkMinSafeVersion — single-flight (review Minor #8)', () => {
  it('coalesces concurrent invocations onto one in-flight promise', async () => {
    // Hold the inspect call open so the second invocation arrives before
    // the first resolves.
    let releaseInspect!: (v: CachedMinSafeVersionResult) => void
    mockedInspect.mockReturnValueOnce(
      new Promise<CachedMinSafeVersionResult>((resolve) => {
        releaseInspect = resolve
      }),
    )

    const store = useAppVersionStore()
    const p1 = store.checkMinSafeVersion()
    const p2 = store.checkMinSafeVersion()

    releaseInspect({ kind: 'absent' })
    await Promise.all([p1, p2])

    // Only one inspect call (and one persist) — the second invocation
    // returned the first promise.
    expect(mockedInspect).toHaveBeenCalledOnce()
    expect(mockedPersist).toHaveBeenCalledOnce()
  })
})

describe('resolveBuildTimeMinSafeVersion — fail-closed on a misbuilt bundle (review Major #2)', () => {
  it('returns the value unchanged when the build-time constant is a valid SemVer', () => {
    expect(resolveBuildTimeMinSafeVersion('0.3.0-alpha')).toBe('0.3.0-alpha')
    expect(resolveBuildTimeMinSafeVersion('1.2.3')).toBe('1.2.3')
  })

  it('substitutes a fail-closed sentinel for an invalid build-time constant', () => {
    expect(resolveBuildTimeMinSafeVersion('not-a-version')).toBe(FAIL_CLOSED_MIN_SAFE_VERSION)
    expect(resolveBuildTimeMinSafeVersion('0.3')).toBe(FAIL_CLOSED_MIN_SAFE_VERSION)
    expect(resolveBuildTimeMinSafeVersion(undefined)).toBe(FAIL_CLOSED_MIN_SAFE_VERSION)
    // The sentinel blocks: any real build version is below it (fail closed,
    // not fail open — a structurally-broken build shows the blocked screen).
    const store = useAppVersionStore()
    expect(store.isVersionBelow('99.0.0', FAIL_CLOSED_MIN_SAFE_VERSION)).toBe(true)
  })
})

describe('checkMinSafeVersion — never persists the fail-closed sentinel (review iteration)', () => {
  it('does not write the fail-closed sentinel to the cache', async () => {
    // If the effective floor resolves to the sentinel, persisting it would
    // launder the ephemeral fail-closed marker into a durable cache entry that
    // even a later correctly-built bundle reads back and stays blocked on.
    // Stage a (hypothetical) cached sentinel so effectiveMin === sentinel.
    mockedInspect.mockResolvedValue({
      kind: 'hit',
      value: FAIL_CLOSED_MIN_SAFE_VERSION,
      fetchedAt: 1_000,
    })
    mockedRemote.mockResolvedValue(null)

    const store = useAppVersionStore()
    store.currentVersion = '0.5.0'
    await store.checkMinSafeVersion(() => 9_000)

    // Still fail closed in memory…
    expect(store.versionBlocked).toBe(true)
    expect(store.minSafeVersion).toBe(FAIL_CLOSED_MIN_SAFE_VERSION)
    // …but the sentinel must never reach disk (no new write).
    expect(mockedPersist).not.toHaveBeenCalled()
  })
})

describe('pickHigherVersion — double-invalid defence (review Nit #4)', () => {
  it('returns the first operand and logs an ERROR when both operands are invalid', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(pickHigherVersion('garbage', 'also-bad')).toBe('garbage')
    expect(consoleError).toHaveBeenCalled()
    const logged = consoleError.mock.calls.flat().join(' ')
    expect(logged).toMatch(/MIN_SAFE_VERSION_PICK_BOTH_INVALID/)
    consoleError.mockRestore()
  })
})

describe('attachConnectivityRefresh', () => {
  // the handler must go through the Pinia action wrapper so spies,
  // $onAction subscribers, and devtools see the call.
  it('re-runs the wrapped store action when the window fires `online`', async () => {
    const store = useAppVersionStore()
    const spy = vi.spyOn(store, 'checkMinSafeVersion')
    const detach = attachConnectivityRefresh()

    expect(spy).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('online'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(spy).toHaveBeenCalledTimes(1)

    detach()
    window.dispatchEvent(new Event('online'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(spy).toHaveBeenCalledTimes(1) // detached — no further calls

    spy.mockRestore()
  })
})
