/**
 * Integration tests for data-rights.service.ts using fake-indexeddb.
 * Covers REQ-SYS-014 (wipe) and REQ-SYS-015 (bulk export).
 *
 * @see frontend/src/modules/aircraft/services/data-rights.service.ts
 */

// @IT-SYS-STORE-001@ (FROM: @IMP-SYS-STORE-013@, @REQ-SYS-014@, @REQ-SYS-015@)

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import {
  exportAllProfiles,
  serializeBulkExport,
  wipeAllLocalData,
  type BulkExportEnvelope,
} from '../services/data-rights.service'
import { create, findAll } from '../services/fleet.repository'
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
    expect(await findAll()).toEqual([])
    expect(typeof report.clearedAt).toBe('string')
    // ISO-8601 with Z suffix
    expect(report.clearedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('removes every aerodash-prefixed key from localStorage and sessionStorage', async () => {
    localStorage.setItem('aerodash:session:payload', '{"version":1}')
    localStorage.setItem('aerodash-theme', 'dark')
    localStorage.setItem('aerodash.last-airport', 'EDDF')
    // Unrelated keys must survive — only aerodash-prefixed keys are cleared.
    localStorage.setItem('other-app-key', 'keep me')
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
    expect(sessionStorage.getItem('aerodash.session.active')).toBeNull()
    expect(sessionStorage.getItem('aerodash:diagnostic')).toBeNull()
    expect(sessionStorage.getItem('untouched-key')).toBe('keep me too')
  })

  it('completes cleanly when the fleet is already empty and no storage keys are present', async () => {
    const report = await wipeAllLocalData()
    expect(report.profilesDeleted).toBe(0)
    expect(report.localStorageKeysCleared).toEqual([])
    expect(report.sessionStorageKeysCleared).toEqual([])
    expect(report.indexedDbCleared).toBe(true)
  })
})

// ─── REQ-SYS-015 — Bulk JSON export ───────────────────────────────────────
describe('exportAllProfiles — Bulk JSON Export (REQ-SYS-015)', () => {
  it('produces a schema-versioned envelope with every profile sorted by registration', async () => {
    await create(buildProfile({ id: '00000000-0000-4000-a000-0000000000b1', registration: 'D-Z' }))
    await create(buildProfile({ id: '00000000-0000-4000-a000-0000000000b2', registration: 'D-A' }))
    await create(buildProfile({ id: '00000000-0000-4000-a000-0000000000b3', registration: 'D-M' }))

    const envelope: BulkExportEnvelope = await exportAllProfiles(new Date('2026-05-27T12:00:00Z'))

    expect(envelope.exportSchemaVersion).toBe(1)
    expect(envelope.exportedAt).toBe('2026-05-27T12:00:00.000Z')
    expect(envelope.profileCount).toBe(3)
    expect(envelope.profiles.map((p) => p.registration)).toEqual(['D-A', 'D-M', 'D-Z'])
  })

  it('serializes to a parseable JSON string', async () => {
    await create(buildProfile())
    const envelope = await exportAllProfiles()
    const text = serializeBulkExport(envelope)
    const round = JSON.parse(text) as BulkExportEnvelope
    expect(round.profileCount).toBe(1)
    expect(round.profiles[0]!.registration).toBe('D-EBPN')
  })

  it('returns an empty envelope when no profiles exist', async () => {
    const envelope = await exportAllProfiles(new Date('2026-05-27T00:00:00Z'))
    expect(envelope.profileCount).toBe(0)
    expect(envelope.profiles).toEqual([])
  })
})
