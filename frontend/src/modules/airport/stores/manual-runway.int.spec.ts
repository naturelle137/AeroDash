import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it } from 'vitest'
import { _resetFleetDbHandleForTest } from '@/modules/aircraft/services/fleet.repository'
import { wipeAllLocalData } from '@/modules/aircraft/services/data-rights.service'
import { MANUAL_RUNWAY_STORAGE_KEY } from '../services/manual-runway.repository'
import { useManualRunwayStore } from './manual-runway.store'

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true })
  _resetFleetDbHandleForTest()
  localStorage.clear()
  setActivePinia(createPinia())
})

// Synthetic values only; no published aerodrome declaration.
function enter(store: ReturnType<typeof useManualRunwayStore>) {
  Object.assign(store.draft, {
    aerodrome: 'TEST', designator: '18', tora: '3280', toraUnit: 'ft', lda: '1000', ldaUnit: 'm',
    fieldElevation: '-100', fieldElevationUnit: 'ft', surfaceType: 'unpaved', surfaceCondition: 'damaged-turf',
  })
}

it('restores the exact original values and units in a fresh session', () => {
  const store = useManualRunwayStore()
  store.load()
  enter(store)
  expect(store.save(new Date('2026-11-12T08:00:00.000Z'))).toBe(true)
  expect(store.current?.display).toEqual({ toraM: '999.7', ldaM: '1000.0', fieldElevationM: '-30.5', fieldElevationFt: '-100.0' })

  setActivePinia(createPinia())
  const reloaded = useManualRunwayStore()
  reloaded.load()
  expect(reloaded.saved?.savedAt).toBe('2026-11-12T08:00:00.000Z')
  expect(reloaded.draft).toMatchObject({ tora: '3280', toraUnit: 'ft', lda: '1000', ldaUnit: 'm', fieldElevation: '-100', fieldElevationUnit: 'ft' })
  expect(reloaded.current).not.toBeNull()
  reloaded.draft.fieldElevationUnit = 'm'
  expect(reloaded.current).toBeNull()
  expect(reloaded.hasUnsavedChanges).toBe(true)
})

it('is erased by the local data wipe', async () => {
  const store = useManualRunwayStore()
  store.load()
  enter(store)
  store.save()
  const report = await wipeAllLocalData()
  expect(report.localStorageKeysCleared).toContain(MANUAL_RUNWAY_STORAGE_KEY)
  setActivePinia(createPinia())
  const reloaded = useManualRunwayStore()
  reloaded.load()
  expect(reloaded.saved).toBeNull()
  expect(reloaded.storageError).toBeNull()
})
