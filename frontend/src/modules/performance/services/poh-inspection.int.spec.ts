import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { importProfileFromJson, exportProfileToJson } from '@/modules/aircraft/services/profile.import'
import { _resetFleetDbHandleForTest } from '@/modules/aircraft/services/fleet.repository'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import { inspectPohDistances } from './poh-inspection'

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true })
  _resetFleetDbHandleForTest()
  setActivePinia(createPinia())
})

it('preserves four tables through exchange, Draft creation, signoff, IndexedDB reload and re-export', async () => {
  const original = testPohAircraft()
  const imported = importProfileFromJson(exportProfileToJson(original))
  const fleet = useFleetStore()
  const draft = await fleet.createProfile(imported)
  const inputs = { mass: '900', pressureAltitude: '1000', temperature: '10' }
  expect(draft.status).toBe('draft')
  expect(draft.performanceProfiles).toEqual(original.performanceProfiles)
  expect(inspectPohDistances(draft, inputs, new Date()).status).toBe('blocked')
  const verified = await fleet.verifyProfile(draft.id, { verifiedBy: 'TS', pohRevision: 'Test synthetic wiring only' })
  await fleet.loadAll()
  expect(fleet.profiles).toHaveLength(1)
  const persisted = fleet.profiles[0]!
  expect(persisted.id).toBe(verified.id)
  expect(persisted.performanceProfiles).toEqual(original.performanceProfiles)
  expect(inspectPohDistances(persisted, inputs, new Date())).toMatchObject({ status: 'success', distances: { takeoffRoll: 220, landingDistance50ft: 520 } })
  expect(importProfileFromJson(exportProfileToJson(persisted))).toMatchObject({ status: 'draft', performanceProfiles: original.performanceProfiles })
  expect(persisted.certificationCategories).toEqual(original.certificationCategories)
})
