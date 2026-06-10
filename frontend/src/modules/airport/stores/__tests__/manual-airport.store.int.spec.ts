// @IT-AP-STORE-002@ (FROM: @IMP-AP-STORE-004@)
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { setActivePinia, createPinia } from 'pinia'
import { useManualAirportStore } from '../manual-airport.store'
import { _resetAirportDbHandleForTest } from '../../services/airport.repository'

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
  _resetAirportDbHandleForTest()
  setActivePinia(createPinia())
})

describe('manual airport store ↔ repository integration', () => {
  it('persists overrides to IndexedDB and rehydrates them on reload (REQ-AP-006)', async () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    store.updateAirport({ name: 'Family Strip', elevationFt: 350 })
    store.updateRunway({ designator: '27', toraM: 600 })
    store.selectSurfaceCondition('paved-dry')
    await store.saveEntry()

    // Fresh store + fresh pinia, same IndexedDB factory → simulates a reload.
    setActivePinia(createPinia())
    const reloaded = useManualAirportStore()
    await reloaded.loadAll()

    expect(reloaded.loadState).toBe('READY')
    expect(reloaded.savedEntries).toHaveLength(1)
    const persisted = reloaded.savedEntries[0]!
    expect(persisted.icao).toBe('ZZZZ')
    expect(persisted.name).toBe('Family Strip')
    expect(persisted.runway.toraM).toBe(600)
    expect(persisted.runway.surfaceConditionId).toBe('paved-dry')
  })

  it('the manual-runway journey reaches a computable gate end to end (UJ-C-002)', async () => {
    const store = useManualAirportStore()
    store.searchByIcao('ZZZZ')
    expect(store.requestCompute().allowed).toBe(false)

    store.updateRunway({ baseSurfaceType: 'grass', toraM: 600 })
    store.selectSurfaceCondition('grass-dry')
    expect(store.requestCompute().allowed).toBe(true)

    await store.saveEntry()
    expect(store.savedEntries).toHaveLength(1)
  })
})
