import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { _resetFleetDbHandleForTest } from '@/modules/aircraft/services/fleet.repository'
import PrivacyView from '@/views/PrivacyView.vue'
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
    aerodrome: 'TEST', designator: '18', toraUnit: 'ft', tora: '3280', lda: '1000', ldaUnit: 'm',
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
  expect(reloaded.draft).toMatchObject({ toraUnit: 'ft', tora: '3280', lda: '1000', ldaUnit: 'm', fieldElevation: '-100', fieldElevationUnit: 'ft' })
  expect(reloaded.current).not.toBeNull()
  reloaded.draft.fieldElevationUnit = 'm'
  expect(reloaded.current).toBeNull()
  expect(reloaded.hasUnsavedChanges).toBe(true)
})

it('is erased by the real Privacy wipe in the same Pinia instance, not only in a fresh session', async () => {
  const store = useManualRunwayStore()
  store.load()
  enter(store)
  expect(store.save()).toBe(true)
  expect(store.current).not.toBeNull()

  // No new Pinia between wipe and revisit: the live store must not keep the erased record.
  const wrapper = mount(PrivacyView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  await wrapper.find('[data-testid="wipe-request-btn"]').trigger('click')
  await wrapper.find('[data-testid="wipe-confirm-input"]').setValue('DELETE ALL DATA')
  await wrapper.find('[data-testid="wipe-confirm-btn"]').trigger('click')
  await vi.waitFor(() => expect(wrapper.find('[data-testid="privacy-wipe-notice"]').exists()).toBe(true))

  expect(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)).toBeNull()
  expect(useManualRunwayStore()).toBe(store)
  expect(store.saved).toBeNull()
  expect(store.current).toBeNull()
  expect(store.draft.aerodrome).toBe('')
  expect(store.storageError).toBeNull()
  wrapper.unmount()

  setActivePinia(createPinia())
  const reloaded = useManualRunwayStore()
  reloaded.load()
  expect(reloaded.saved).toBeNull()
})

it('keeps the saved runway untouched by save/clear attempts during a demo and drops scratch edits', async () => {
  const { useMassBalanceStore } = await import('@/modules/mass-balance/stores/mass-balance.store')
  const mb = useMassBalanceStore()
  mb.$patch({ aircraft: { id: 'demo-test' } as never })
  const store = useManualRunwayStore()
  store.load()
  enter(store)
  expect(store.save(new Date('2026-11-12T08:00:00.000Z'))).toBe(true)
  const stored = localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)

  mb.enterDemo()
  store.draft.tora = '1'
  expect(store.save()).toBe(false)
  expect(store.clear()).toBe(false)
  expect(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)).toBe(stored)
  mb.exitDemo()

  expect(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)).toBe(stored)
  expect(store.draft.tora).toBe('3280')
  expect(store.saved?.savedAt).toBe('2026-11-12T08:00:00.000Z')
})

it('defaults only an empty matching runway and preserves a pilot override', () => {
  const store = useManualRunwayStore()
  store.load()
  store.draft.aerodrome = 'EDDF'
  store.draft.surfaceType = 'paved'
  const report = { station: 'EDDF', time: '2026-11-21T16:30:00Z', liquid: true }
  store.updateWeather(report)
  expect(store.draft.surfaceCondition).toBe('wet')
  expect(store.weatherSurface).toContain('EDDF')
  store.draft.surfaceCondition = 'dry'
  store.updateWeather(null)
  store.updateWeather(report)
  expect(store.draft.surfaceCondition).toBe('dry')
  expect(store.weatherSurface).toBeNull()
  store.draft.surfaceCondition = ''
  store.updateWeather(null)
  store.updateWeather(report)
  expect(store.draft.surfaceCondition).toBe('')
  store.load()
  store.draft.aerodrome = 'EDDF'
  store.draft.surfaceType = 'paved'
  store.updateWeather(null)
  store.updateWeather(report)
  store.updateWeather(null)
  expect(store.draft.surfaceCondition).toBe('')
  store.draft.aerodrome = 'EDDM'
  store.updateWeather(report)
  expect(store.draft.surfaceCondition).toBe('')
})
