import 'fake-indexeddb/auto'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { exportAllProfiles, serializeBulkExport } from '../services/data-rights.service'
import { previewFleetRestore } from '../services/fleet.import'
import { fleetRepository as repo, _resetFleetDbHandleForTest } from '../services/fleet.repository'
import { useFleetStore } from '../stores/fleet.store'
import { useActiveAircraftStore } from '../stores/active-aircraft.store'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetFleetDbHandleForTest()
  setActivePinia(createPinia())
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

async function batch() {
  const first = testPohAircraft()
  const second = { ...testPohAircraft(), id: '00000000-0000-4000-a000-000000000429', registration: 'D-NEXT' }
  await repo.create(first)
  await repo.create(second)
  const { envelope } = await exportAllProfiles()
  await repo.deleteAll() // Explicit synthetic-fixture-only deletion.
  return previewFleetRestore(serializeBulkExport(envelope))
}

describe('atomic fleet restore', () => {
  it('restores the real Privacy envelope with reactive drafts that survive hydration', async () => {
    const profiles = await batch()
    const fleet = useFleetStore()
    await fleet.loadAll()
    await fleet.restoreProfiles(profiles)
    expect(fleet.profiles).toEqual(profiles)
    expect(await repo.findAll()).toEqual(expect.arrayContaining(profiles))
    await fleet.loadAll()
    expect(fleet.profiles).toEqual(expect.arrayContaining(profiles))
  })

  it('rejects conflicts added after preview, preserving fleet and active preparation', async () => {
    const profiles = await batch()
    const existing = { ...testPohAircraft(), schemaVersion: 2, registration: 'd-next' }
    await repo.create(existing)
    const fleet = useFleetStore()
    await fleet.loadAll()
    const active = useActiveAircraftStore()
    active.setActiveProfile(existing)
    localStorage.setItem('aerodash:session:payload', 'existing preparation')
    await expect(fleet.restoreProfiles(profiles)).rejects.toThrow('conflict')
    expect(await repo.findAll()).toEqual([existing])
    expect(fleet.profiles).toEqual([existing])
    expect(active.activeProfile).toEqual(existing)
    expect(localStorage.getItem('aerodash:session:payload')).toBe('existing preparation')
  })

  it('rolls back an earlier successful add when a later add fails, and supports retry', async () => {
    const profiles = await batch()
    const existing = { ...testPohAircraft(), schemaVersion: 2, registration: 'D-KEEP' }
    await repo.create(existing)
    const fleet = useFleetStore()
    await fleet.loadAll()
    useActiveAircraftStore().setActiveProfile(existing)
    const original = IDBObjectStore.prototype.add
    let adds = 0
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (++adds === 2) throw new DOMException('Synthetic quota failure', 'QuotaExceededError')
      return original.apply(this, args)
    })
    await expect(fleet.restoreProfiles(profiles)).rejects.toThrow('Synthetic quota failure')
    expect(await repo.findAll()).toEqual([existing])
    expect(fleet.profiles).toEqual([existing])
    expect(useActiveAircraftStore().activeProfile).toEqual(existing)
    vi.restoreAllMocks()
    await fleet.restoreProfiles(profiles)
    expect(await repo.findAll()).toHaveLength(3)
  })

  it('waits for transaction abort after successful requests instead of reporting success', async () => {
    const profiles = await batch()
    const fleet = useFleetStore()
    const db = await repo.openDB()
    const transaction = db.transaction.bind(db)
    vi.spyOn(db, 'transaction').mockImplementation((...args) => {
      const tx = transaction(...args)
      tx.addEventListener('error', () => undefined)
      const store = tx.objectStore('aircraft_profiles')
      const add = store.add.bind(store)
      vi.spyOn(store, 'add').mockImplementation((...values) => {
        const request = add(...values)
        request.addEventListener('success', () => tx.abort())
        return request
      })
      return tx
    })
    await expect(fleet.restoreProfiles(profiles)).rejects.toThrow('aborted')
    expect(fleet.profiles).toEqual([])
    vi.restoreAllMocks()
    expect(await repo.findAll()).toEqual([])
  })

  it('rejects a key collision on the second record without committing the first', async () => {
    const profiles = await batch()
    const existing = { ...testPohAircraft(), schemaVersion: 2, id: profiles[1]!.id, registration: 'D-KEEP' }
    await repo.create(existing)
    await expect(repo.restoreBatch(profiles)).rejects.toThrow('ConstraintError')
    expect(await repo.findAll()).toEqual([existing])
  })

  it('includes unreadable persisted rows in the conflict check', async () => {
    const profiles = await batch()
    const db = await repo.openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction('aircraft_profiles', 'readwrite')
      tx.objectStore('aircraft_profiles').add({ id: 'future', registration: 'd-next', schemaVersion: 999 })
      tx.oncomplete = () => resolve()
    })
    await expect(repo.restoreBatch(profiles)).rejects.toThrow('conflict')
    expect((await repo.findAllWithDiagnostics()).diagnostics).toHaveLength(1)
    expect(await repo.findAll()).toEqual([])
  })
})
