import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { importProfileFromJson, exportProfileToJson } from '@/modules/aircraft/services/profile.import'
import { _resetFleetDbHandleForTest } from '@/modules/aircraft/services/fleet.repository'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import { assessPerformance, massSourceFromText } from './poh-inspection'

function inspectPohDistances(profile: unknown, values: { mass: string; pressureAltitude: string; temperature: string }, at: Date) {
  const mass = massSourceFromText(values.mass, 'entered lookup mass')
  const result = assessPerformance(profile, { takeoff: mass, landing: mass, pressureAltitude: values.pressureAltitude, temperature: values.temperature }, at)
  if (result.status === 'blocked') return result
  if (result.takeoff.status !== 'success' || result.landing.status !== 'success') return { status: 'blocked' }
  const [tor, tod] = result.takeoff.distances
  const [lr, ld] = result.landing.distances
  return { status: 'success', distances: { takeoffRoll: tor!.distance, takeoffDistance50ft: tod!.distance, landingRoll: lr!.distance, landingDistance50ft: ld!.distance } }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true })
  _resetFleetDbHandleForTest()
  setActivePinia(createPinia())
})

it('imports legacy kg/ft/°C/m tables independently of imperial M&B units', async () => {
  const original = testPohAircraft()
  original.sourceUnit = 'lb'
  const imported = importProfileFromJson(exportProfileToJson(original))
  expect(imported.sourceUnit).toBe('lb')
  expect(imported.performanceProfiles).toEqual(original.performanceProfiles)
  expect(imported.performanceProfiles!.every((table) => table.sourceUnits === undefined)).toBe(true)

  const fleet = useFleetStore()
  const draft = await fleet.createProfile(imported)
  await fleet.verifyProfile(draft.id, { verifiedBy: 'TS', pohRevision: 'Synthetic wiring only' })
  await fleet.loadAll()
  const persisted = fleet.profiles[0]!
  expect(inspectPohDistances(persisted, { mass: '850', pressureAltitude: '500', temperature: '5' }, new Date()))
    .toEqual({ status: 'success', distances: { takeoffRoll: 160, takeoffDistance50ft: 260, landingRoll: 360, landingDistance50ft: 460 } })
  expect(inspectPohDistances(persisted, { mass: '950', pressureAltitude: '1500', temperature: '15' }, new Date()))
    .toEqual({ status: 'success', distances: { takeoffRoll: 280, takeoffDistance50ft: 380, landingRoll: 480, landingDistance50ft: 580 } })
  expect(persisted.performanceProfiles).toEqual(original.performanceProfiles)
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

it.each([
  { mass: 'kg', pressureAltitude: 'ft', temperature: '°C', distance: 'm' },
  { mass: 'lb', pressureAltitude: 'm', temperature: '°F', distance: 'ft' },
  { mass: 'kg', pressureAltitude: 'm', temperature: '°F', distance: 'm' },
] as const)('preserves declared source %j through review, edits and persistence', async (sourceUnits) => {
  const original = testPohAircraft()
  original.sourceUnit = 'lb'
  original.performanceProfiles!.forEach((table) => {
    table.sourceUnits = sourceUnits
    table.sourceReference = '  Synthetic wiring only; no aircraft manual  '
    table.dataPoints = [{ mass: sourceUnits.mass === 'lb' ? 2000 : 907.18474,
      pressureAltitude: sourceUnits.pressureAltitude === 'm' ? 304.8 : 1000,
      temperature: sourceUnits.temperature === '°F' ? 50 : 10,
      distance: sourceUnits.distance === 'ft' ? 1000 : 304.8 }]
  })
  const inputs = { mass: '907.18474', pressureAltitude: '1000', temperature: '10' }
  const imported = importProfileFromJson(exportProfileToJson(original))
  expect(imported.verification).toBeUndefined()
  const fleet = useFleetStore()
  const draft = await fleet.createProfile(imported)
  const verified = await fleet.verifyProfile(draft.id, { verifiedBy: 'TS', pohRevision: 'Synthetic only' })
  await fleet.loadAll()
  const persisted = fleet.profiles[0]!
  expect(persisted.performanceProfiles).toEqual(original.performanceProfiles)
  expect(JSON.parse(exportProfileToJson(persisted)).profile.performanceProfiles).toEqual(original.performanceProfiles)
  for (let i = 0; i < 2; i++) {
    expect(inspectPohDistances(persisted, inputs, new Date())).toMatchObject({
      status: 'success', distances: { takeoffRoll: 304.8, landingDistance50ft: 304.8 },
    })
  }
  const tables = structuredClone(original.performanceProfiles!)
  tables[0]!.sourceUnits = { ...sourceUnits, distance: sourceUnits.distance === 'm' ? 'ft' : 'm' }
  const edited = await fleet.editVerifiedProfile(verified.id, { performanceProfiles: tables })
  expect(edited.status).toBe('draft')
  expect(edited.verification).toBeUndefined()
  expect(inspectPohDistances(edited, inputs, new Date())).toMatchObject({ status: 'blocked', reason: 'draft' })
  const reimported = importProfileFromJson(exportProfileToJson(persisted))
  expect(reimported).toMatchObject({ status: 'draft', performanceProfiles: original.performanceProfiles })
  expect(reimported.verification).toBeUndefined()
})
