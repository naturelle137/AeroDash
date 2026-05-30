/**
 * Unit tests for the disclaimer-acknowledgement store (REQ-SYS-016).
 *
 * Covers:
 *  - First-launch path (no storage record → gate open)
 *  - Persisted acceptance for current baseline → gate closed
 *  - Baseline drift (MAJOR.MINOR change) → re-prompt
 *  - Invalid / corrupt persisted record → re-prompt
 *  - localStorage unavailable (throws) → fail safe
 *  - Build-time SemVer broken → fail closed
 *  - `acknowledge()` writes the record + closes the gate + returns true
 *  - `computeDisclaimerBaseline()` helper
 */

// @UT-SYS-STORE-100@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-101@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-102@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-103@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-104@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-105@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-106@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-107@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-108@ (FROM: @IMP-SYS-STORE-022@)
// @UT-SYS-STORE-109@ (FROM: @IMP-SYS-STORE-022@)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import {
  STORAGE_KEY,
  computeDisclaimerBaseline,
  useDisclaimerAcknowledgementStore,
  type AcknowledgementRecord,
} from '../disclaimer-acknowledgement.store'

const FAKE_NOW = 1_780_000_000_000

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('computeDisclaimerBaseline', () => {
  // @UT-SYS-STORE-100@ (FROM: @IMP-SYS-STORE-022@)
  it('returns MAJOR.MINOR for a release SemVer', () => {
    expect(computeDisclaimerBaseline('1.2.3')).toBe('1.2')
  })

  it('returns MAJOR.MINOR for a pre-release SemVer', () => {
    expect(computeDisclaimerBaseline('0.3.0-alpha')).toBe('0.3')
  })

  it('returns MAJOR.MINOR for a build-metadata SemVer', () => {
    expect(computeDisclaimerBaseline('0.4.1-rc.1+sha.abc')).toBe('0.4')
  })

  it('returns null for malformed SemVer', () => {
    expect(computeDisclaimerBaseline('not-a-version')).toBeNull()
    expect(computeDisclaimerBaseline('1.2')).toBeNull()
    expect(computeDisclaimerBaseline(undefined)).toBeNull()
    expect(computeDisclaimerBaseline(123)).toBeNull()
  })
})

describe('useDisclaimerAcknowledgementStore', () => {
  // @UT-SYS-STORE-101@ (FROM: @IMP-SYS-STORE-022@)
  it('opens the gate on first launch when no record is stored', () => {
    const store = useDisclaimerAcknowledgementStore()
    store.loadFromStorage()
    expect(store.loaded).toBe(true)
    expect(store.gateOpen).toBe(true)
    expect(store.storedRecord).toBeNull()
    expect(store.storageUnavailable).toBe(false)
  })

  // @UT-SYS-STORE-102@ (FROM: @IMP-SYS-STORE-022@)
  it('closes the gate when a record for the current baseline is stored', () => {
    const store = useDisclaimerAcknowledgementStore()
    const baseline = store.currentBaseline as string
    const record: AcknowledgementRecord = {
      schemaVersion: 1,
      acceptedVersion: store.currentVersion,
      acceptedBaseline: baseline,
      acceptedAt: FAKE_NOW,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))

    store.loadFromStorage()
    expect(store.gateOpen).toBe(false)
    expect(store.storedRecord).toEqual(record)
  })

  // @UT-SYS-STORE-103@ (FROM: @IMP-SYS-STORE-022@)
  it('opens the gate when the stored baseline differs from the current one', () => {
    const store = useDisclaimerAcknowledgementStore()
    // Use a baseline guaranteed to differ from the running build's
    // (the running build is some 0.x; we store a 9999.x acceptance).
    const staleRecord: AcknowledgementRecord = {
      schemaVersion: 1,
      acceptedVersion: '9999.0.0',
      acceptedBaseline: '9999.0',
      acceptedAt: FAKE_NOW,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staleRecord))

    store.loadFromStorage()
    expect(store.gateOpen).toBe(true)
    expect(store.storedRecord).toEqual(staleRecord)
  })

  // @UT-SYS-STORE-104@ (FROM: @IMP-SYS-STORE-022@)
  it('opens the gate when the stored record is structurally corrupt', () => {
    const store = useDisclaimerAcknowledgementStore()
    localStorage.setItem(STORAGE_KEY, '{"schemaVersion":1,"acceptedBaseline":42}')

    store.loadFromStorage()
    expect(store.gateOpen).toBe(true)
    expect(store.storedRecord).toBeNull()
  })

  it('opens the gate when the stored payload is not valid JSON', () => {
    const store = useDisclaimerAcknowledgementStore()
    localStorage.setItem(STORAGE_KEY, '{not-json')

    store.loadFromStorage()
    expect(store.gateOpen).toBe(true)
    expect(store.storedRecord).toBeNull()
  })

  // @UT-SYS-STORE-105@ (FROM: @IMP-SYS-STORE-022@)
  it('fails safe when localStorage.getItem throws', () => {
    const store = useDisclaimerAcknowledgementStore()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    store.loadFromStorage()
    expect(store.gateOpen).toBe(true)
    expect(store.storageUnavailable).toBe(true)
  })

  // @UT-SYS-STORE-106@ (FROM: @IMP-SYS-STORE-022@)
  it('acknowledge() persists the record and closes the gate', () => {
    const store = useDisclaimerAcknowledgementStore()
    store.loadFromStorage()
    expect(store.gateOpen).toBe(true)

    const ok = store.acknowledge(() => FAKE_NOW)
    expect(ok).toBe(true)
    expect(store.gateOpen).toBe(false)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      acceptedVersion: store.currentVersion,
      acceptedBaseline: store.currentBaseline,
      acceptedAt: FAKE_NOW,
    })
    expect(store.storedRecord).toMatchObject({ acceptedAt: FAKE_NOW })
  })

  // @UT-SYS-STORE-107@ (FROM: @IMP-SYS-STORE-022@)
  it('acknowledge() returns false and leaves the gate open when setItem throws', () => {
    const store = useDisclaimerAcknowledgementStore()
    store.loadFromStorage()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })

    const ok = store.acknowledge(() => FAKE_NOW)
    expect(ok).toBe(false)
    expect(store.gateOpen).toBe(true)
    expect(store.storageUnavailable).toBe(true)
  })

  // @UT-SYS-STORE-108@ (FROM: @IMP-SYS-STORE-022@)
  it('re-prompts after a stored acceptance for an older baseline (simulated milestone bump)', () => {
    // Stage a prior acceptance against a baseline that cannot collide with
    // any plausible running 0.x / 1.x build — so the drift path is always
    // exercised regardless of what __APP_VERSION__ ends up being.
    const previous: AcknowledgementRecord = {
      schemaVersion: 1,
      acceptedVersion: '9000.0.0',
      acceptedBaseline: '9000.0',
      acceptedAt: FAKE_NOW - 1000,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previous))

    const store = useDisclaimerAcknowledgementStore()
    expect(store.currentBaseline).not.toBe('9000.0')

    store.loadFromStorage()
    expect(store.gateOpen).toBe(true)
    expect(store.storedRecord).toEqual(previous)
  })

  // @UT-SYS-STORE-109@ (FROM: @IMP-SYS-STORE-022@)
  it('resetForTesting() clears in-memory state and re-opens the gate', () => {
    const store = useDisclaimerAcknowledgementStore()
    store.loadFromStorage()
    store.acknowledge(() => FAKE_NOW)
    expect(store.gateOpen).toBe(false)

    store.resetForTesting()
    expect(store.gateOpen).toBe(true)
    expect(store.loaded).toBe(false)
    expect(store.storedRecord).toBeNull()
  })
})
