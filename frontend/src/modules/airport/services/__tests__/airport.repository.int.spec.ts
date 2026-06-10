// @IT-AP-STORE-001@ (FROM: @IMP-AP-STORE-003@)
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import {
  _resetAirportDbHandleForTest,
  create,
  update,
  findById,
  findAll,
  deleteById,
  deleteAll,
  MANUAL_AIRPORT_SCHEMA_VERSION,
} from '../airport.repository'
import type { ManualAirportEntry } from '../../domain/airport.types'

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
  _resetAirportDbHandleForTest()
})

function buildEntry(overrides: Partial<ManualAirportEntry> = {}): ManualAirportEntry {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    icao: 'ZZZZ',
    name: 'Family Strip',
    elevationFt: 350,
    schemaVersion: MANUAL_AIRPORT_SCHEMA_VERSION,
    runway: {
      designator: '27',
      magneticHeadingDeg: 270,
      baseSurfaceType: 'grass',
      slopePercent: 1.5,
      toraM: 600,
      todaM: 600,
      asdaM: 600,
      ldaM: 600,
      surfaceConditionId: 'grass-dry',
    },
    ...overrides,
  }
}

describe('airport.repository', () => {
  it('persists a manual airport entry and reads it back unchanged', async () => {
    const entry = buildEntry()
    await create(entry)
    expect(await findById(entry.id)).toEqual(entry)
  })

  it('persists override edits across a write/read cycle (REQ-AP-006)', async () => {
    const entry = buildEntry()
    await create(entry)
    const edited = { ...entry, runway: { ...entry.runway, toraM: 720, surfaceConditionId: 'grass-long' } }
    await update(edited)
    const reread = await findById(entry.id)
    expect(reread?.runway.toraM).toBe(720)
    expect(reread?.runway.surfaceConditionId).toBe('grass-long')
  })

  it('lists all stored entries', async () => {
    await create(buildEntry({ id: 'a' }))
    await create(buildEntry({ id: 'b' }))
    const all = await findAll()
    expect(all.map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('deletes a single entry by id', async () => {
    await create(buildEntry({ id: 'a' }))
    await deleteById('a')
    expect(await findById('a')).toBeUndefined()
  })

  it('clears every entry', async () => {
    await create(buildEntry({ id: 'a' }))
    await create(buildEntry({ id: 'b' }))
    await deleteAll()
    expect(await findAll()).toEqual([])
  })

  it('rejects a structurally invalid write rather than corrupting storage', async () => {
    const bad = { ...buildEntry(), runway: { ...buildEntry().runway, baseSurfaceType: 'gravel' } }
    await expect(create(bad as unknown as ManualAirportEntry)).rejects.toThrow(/structural/i)
  })

  it('returns undefined for an absent key', async () => {
    expect(await findById('missing')).toBeUndefined()
  })
})
