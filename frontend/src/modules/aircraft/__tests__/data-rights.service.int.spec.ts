/**
 * Integration tests for data-rights.service.ts using fake-indexeddb.
 * Covers REQ-SYS-014 (wipe) and REQ-SYS-015 (bulk export).
 *
 * @see frontend/src/modules/aircraft/services/data-rights.service.ts
 */

// @IT-SYS-STORE-001@ (FROM: @IMP-SYS-STORE-013@, @REQ-SYS-014@, @REQ-SYS-015@)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import {
  exportAllProfiles,
  serializeBulkExport,
  wipeAllLocalData,
} from '../services/data-rights.service'
import { create, findAll, fleetRepository } from '../services/fleet.repository'
import { CURRENT_PROFILE_SCHEMA_VERSION } from '@/core/logic/profile-migrations'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
  // Reset Web Storage between tests so leftover keys do not contaminate
  // a Delete-All-Data assertion in the next case.
  try {
    localStorage.clear()
  } catch {
    /* not available — handled inside the service */
  }
  try {
    sessionStorage.clear()
  } catch {
    /* not available — handled inside the service */
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Write a raw document directly into the fleet store, bypassing the
 * repository's `create()` Zod gate — the only way to seed a future-version /
 * corrupt row that the production write path forbids.
 */
async function seedRaw(doc: Record<string, unknown>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('aerodash-fleet', 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('aircraft_profiles')) {
        const store = db.createObjectStore('aircraft_profiles', { keyPath: 'id' })
        store.createIndex('ownerId', 'ownerId', { unique: false })
        store.createIndex('registration', 'registration', { unique: false })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('aircraft_profiles', 'readwrite')
      tx.objectStore('aircraft_profiles').put(doc)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

function buildProfile(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    ownerId: 'user-test',
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'draft',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 110,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 650,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.841, mass: 432 },
          { armOrMoment: 1.841, mass: 650 },
          { armOrMoment: 1.978, mass: 650 },
          { armOrMoment: 1.978, mass: 432 },
        ],
      },
    ],
    ...overrides,
  }
}

// ─── REQ-SYS-014 — Delete-All-Data ────────────────────────────────────────
describe('wipeAllLocalData — Repository-Wide Wipe (REQ-SYS-014)', () => {
  it('clears IndexedDB profiles and reports the deleted count', async () => {
    await create(buildProfile({ id: '00000000-0000-4000-a000-000000000001' }))
    await create(
      buildProfile({ id: '00000000-0000-4000-a000-000000000002', registration: 'D-ECSM' }),
    )

    const report = await wipeAllLocalData()

    expect(report.profilesDeleted).toBe(2)
    expect(report.indexedDbCleared).toBe(true)
    expect(report.complete).toBe(true)
    expect(report.failures).toEqual([])
    expect(await findAll()).toEqual([])
    expect(typeof report.clearedAt).toBe('string')
    // ISO-8601 with Z suffix
    expect(report.clearedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('counts dropped/corrupt rows in profilesDeleted (clear() removes them too)', async () => {
    await create(buildProfile({ id: '00000000-0000-4000-a000-000000000001' }))
    // A future-version row is unreadable but still occupies the store, and
    // store.clear() erases it — so it must be counted as deleted.
    await seedRaw({
      ...buildProfile({ id: '00000000-0000-4000-a000-0000000000f0', registration: 'D-FUTR' }),
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION + 1,
    } as unknown as Record<string, unknown>)

    const report = await wipeAllLocalData()

    expect(report.profilesDeleted).toBe(2)
    expect(report.indexedDbCleared).toBe(true)
    expect(report.complete).toBe(true)
  })

  it('reports failure (not complete) when the IndexedDB clear rejects', async () => {
    await create(buildProfile())
    vi.spyOn(fleetRepository, 'deleteAll').mockRejectedValueOnce(new Error('IDB unavailable'))

    const report = await wipeAllLocalData()

    expect(report.indexedDbCleared).toBe(false)
    expect(report.complete).toBe(false)
    expect(report.failures).toHaveLength(1)
    expect(report.failures[0]!.store).toBe('indexeddb')
    expect(report.failures[0]!.key).toBeNull()
    expect(report.failures[0]!.detail).toContain('IDB unavailable')
  })

  it('reports profilesDeleted=null (not a false 0) when the pre-count read fails but the clear succeeds', async () => {
    await create(buildProfile())
    vi.spyOn(fleetRepository, 'findAllWithDiagnostics').mockRejectedValueOnce(
      new Error('transient read failure'),
    )

    const report = await wipeAllLocalData()

    expect(report.profilesDeleted).toBeNull()
    expect(report.indexedDbCleared).toBe(true)
    expect(report.complete).toBe(true)
    expect(await findAll()).toEqual([])
  })

  it('reports failure (not complete) when a Web Storage key cannot be removed', async () => {
    localStorage.setItem('aerodash:session:payload', '{"version":1}')
    localStorage.setItem('aerodash-theme', 'dark')
    // Make removeItem throw for one specific key only.
    const realRemove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === 'aerodash-theme') throw new Error('quota / access error')
      realRemove.call(this, key)
    })

    const report = await wipeAllLocalData()

    expect(report.indexedDbCleared).toBe(true)
    expect(report.complete).toBe(false)
    expect(report.localStorageKeysCleared).toEqual(['aerodash:session:payload'])
    const localFailure = report.failures.find((f) => f.store === 'localStorage')
    expect(localFailure).toBeDefined()
    expect(localFailure!.key).toBe('aerodash-theme')
  })

  it('removes every aerodash-prefixed key from localStorage and sessionStorage', async () => {
    localStorage.setItem('aerodash:session:payload', '{"version":1}')
    localStorage.setItem('aerodash-theme', 'dark')
    localStorage.setItem('aerodash.last-airport', 'EDDF')
    // Unrelated keys must survive — only aerodash-prefixed keys are cleared.
    localStorage.setItem('other-app-key', 'keep me')
    // A separator-less key is a different namespace and is intentionally out of
    // scope: the matcher requires `aerodash` to be bare or followed by a
    // separator, so `aerodashboard` must NOT be swept.
    localStorage.setItem('aerodashboard', 'keep me too')
    sessionStorage.setItem('aerodash.session.active', '1')
    sessionStorage.setItem('aerodash:diagnostic', 'ok')
    sessionStorage.setItem('untouched-key', 'keep me too')

    const report = await wipeAllLocalData()

    expect(report.localStorageKeysCleared).toEqual([
      'aerodash-theme',
      'aerodash.last-airport',
      'aerodash:session:payload',
    ])
    expect(report.sessionStorageKeysCleared).toEqual([
      'aerodash.session.active',
      'aerodash:diagnostic',
    ])

    expect(localStorage.getItem('aerodash:session:payload')).toBeNull()
    expect(localStorage.getItem('aerodash-theme')).toBeNull()
    expect(localStorage.getItem('aerodash.last-airport')).toBeNull()
    expect(localStorage.getItem('other-app-key')).toBe('keep me')
    expect(localStorage.getItem('aerodashboard')).toBe('keep me too')
    expect(sessionStorage.getItem('aerodash.session.active')).toBeNull()
    expect(sessionStorage.getItem('aerodash:diagnostic')).toBeNull()
    expect(sessionStorage.getItem('untouched-key')).toBe('keep me too')
    expect(report.complete).toBe(true)
    expect(report.failures).toEqual([])
  })

  it('completes cleanly when the fleet is already empty and no storage keys are present', async () => {
    const report = await wipeAllLocalData()
    expect(report.profilesDeleted).toBe(0)
    expect(report.localStorageKeysCleared).toEqual([])
    expect(report.sessionStorageKeysCleared).toEqual([])
    expect(report.indexedDbCleared).toBe(true)
    expect(report.complete).toBe(true)
    expect(report.failures).toEqual([])
  })
})

// ─── REQ-SYS-015 — Bulk JSON export ───────────────────────────────────────
describe('exportAllProfiles — Bulk JSON Export (REQ-SYS-015)', () => {
  it('produces a schema-versioned envelope with every profile sorted by registration', async () => {
    await create(buildProfile({ id: '00000000-0000-4000-a000-0000000000b1', registration: 'D-Z' }))
    await create(buildProfile({ id: '00000000-0000-4000-a000-0000000000b2', registration: 'D-A' }))
    await create(buildProfile({ id: '00000000-0000-4000-a000-0000000000b3', registration: 'D-M' }))

    const { envelope, omitted } = await exportAllProfiles(new Date('2026-05-27T12:00:00Z'))

    expect(envelope.exportSchemaVersion).toBe(1)
    expect(envelope.exportedAt).toBe('2026-05-27T12:00:00.000Z')
    expect(envelope.profileCount).toBe(3)
    expect(envelope.profiles.map((p) => p.registration)).toEqual(['D-A', 'D-M', 'D-Z'])
    expect(omitted).toEqual([])
  })

  it('serializes to a parseable JSON string', async () => {
    await create(buildProfile())
    const { envelope } = await exportAllProfiles()
    const text = serializeBulkExport(envelope)
    const round = JSON.parse(text) as typeof envelope
    expect(round.profileCount).toBe(1)
    expect(round.profiles[0]!.registration).toBe('D-EBPN')
  })

  it('returns an empty envelope when no profiles exist', async () => {
    const { envelope, omitted } = await exportAllProfiles(new Date('2026-05-27T00:00:00Z'))
    expect(envelope.profileCount).toBe(0)
    expect(envelope.profiles).toEqual([])
    expect(omitted).toEqual([])
  })

  it('omits unreadable profiles from the envelope but reports them so the copy is not silently incomplete', async () => {
    await create(buildProfile({ id: '00000000-0000-4000-a000-0000000000c1', registration: 'D-OK01' }))
    await seedRaw({
      ...buildProfile({ id: '00000000-0000-4000-a000-0000000000c2', registration: 'D-FUTR' }),
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION + 1,
    } as unknown as Record<string, unknown>)

    const { envelope, omitted } = await exportAllProfiles()

    expect(envelope.profileCount).toBe(1)
    expect(envelope.profiles.map((p) => p.registration)).toEqual(['D-OK01'])
    expect(omitted).toHaveLength(1)
    expect(omitted[0]!.reason).toBe('unsupported-future-version')
  })

  it('reports omitted profiles even when NO profile is readable (all-unreadable fleet)', async () => {
    // PWA cache rollback: every row was written by a newer build. The export
    // is empty, but the omitted list must still report the at-risk rows so the
    // caller never silently presents a "complete" copy (DES-ARCH-011 §4.1).
    await seedRaw({
      ...buildProfile({ id: '00000000-0000-4000-a000-0000000000d1', registration: 'D-FT01' }),
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION + 1,
    } as unknown as Record<string, unknown>)
    await seedRaw({
      ...buildProfile({ id: '00000000-0000-4000-a000-0000000000d2', registration: 'D-FT02' }),
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION + 2,
    } as unknown as Record<string, unknown>)

    const { envelope, omitted } = await exportAllProfiles()

    expect(envelope.profileCount).toBe(0)
    expect(envelope.profiles).toEqual([])
    expect(omitted).toHaveLength(2)
  })
})
