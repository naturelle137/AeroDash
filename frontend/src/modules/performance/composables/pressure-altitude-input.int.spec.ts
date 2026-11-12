import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { beforeEach, expect, it } from 'vitest'
import { useManualRunwayStore } from '@/modules/airport/stores/manual-runway.store'
import { MANUAL_RUNWAY_STORAGE_KEY } from '@/modules/airport/services/manual-runway.repository'
import { usePressureAltitudeInput } from './pressure-altitude-input'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

// Synthetic runway; not a published aerodrome declaration.
function saveRunway(elevation: string, unit: string): void {
  const runway = useManualRunwayStore()
  runway.load()
  Object.assign(runway.draft, {
    aerodrome: 'TEST', designator: '18', tora: '800', toraUnit: 'm', lda: '700', ldaUnit: 'm',
    fieldElevation: elevation, fieldElevationUnit: unit, surfaceType: 'paved', surfaceCondition: 'dry',
  })
  expect(runway.save(new Date('2026-11-12T08:00:00.000Z'))).toBe(true)
}

function withInput() {
  const scope = effectScope()
  const input = scope.run(() => usePressureAltitudeInput())!
  return { input, stop: () => scope.stop() }
}

it('resolves the persisted runway elevation only after an explicit copy', () => {
  saveRunway('-100', 'ft')
  const { input, stop } = withInput()
  input.method.value = 'qnh-elevation'
  Object.assign(input.draft, { qnh: '1013.25', qnhUnit: 'hPa' })
  expect(input.resolution.value.status).toBe('blocked')
  expect(input.useRunwayElevation()).toBe(true)
  expect(input.resolution.value).toMatchObject({ status: 'ready', method: 'qnh-elevation', value: -100, displayFt: -100 })
  // The stored declaration keeps its original value; nothing about PA is written.
  expect(JSON.parse(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)!).runway.fieldElevation).toEqual({ value: -100, unit: 'ft' })
  expect(Object.keys(localStorage)).toEqual([MANUAL_RUNWAY_STORAGE_KEY])
  stop()
})

it('drops a copied elevation after erasure re-reads an empty runway store', () => {
  saveRunway('304.8', 'm')
  const { input, stop } = withInput()
  input.method.value = 'qnh-elevation'
  Object.assign(input.draft, { qnh: '1000', qnhUnit: 'hPa' })
  input.useRunwayElevation()
  const before = input.revision.value
  expect(input.resolution.value.status).toBe('ready')
  // Same-document erasure path: storage removed, then the live store re-reads it.
  localStorage.removeItem(MANUAL_RUNWAY_STORAGE_KEY)
  useManualRunwayStore().load()
  expect(input.draft.elevation).toBe('')
  expect(input.draft.elevationUnit).toBe('')
  expect(input.revision.value).not.toBe(before)
  expect(input.resolution.value.status).toBe('blocked')
  expect(input.notice.value).toContain('copied field elevation was removed')
  stop()
})

it('starts every mount without a method or derived value', () => {
  const first = withInput()
  first.input.method.value = 'direct'
  first.input.direct.value = '1000'
  first.stop()
  const second = withInput()
  expect(second.input.method.value).toBe('')
  expect(second.input.direct.value).toBe('')
  expect(second.input.resolution.value.status).toBe('blocked')
  second.stop()
})
