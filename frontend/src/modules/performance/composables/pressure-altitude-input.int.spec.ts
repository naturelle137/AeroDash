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
    fieldElevationUnit: unit, fieldElevation: elevation, surfaceType: 'paved', surfaceCondition: 'dry',
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
  const storedBefore = { ...localStorage }
  const { input, stop } = withInput()
  input.method.value = 'qnh-elevation'
  Object.assign(input.draft, { qnh: '1013.25', qnhUnit: 'hPa' })
  expect(input.resolution.value.status).toBe('blocked')
  expect(input.useRunwayElevation()).toBe(true)
  // Exact standard QNH preserves field elevation, including negative elevations.
  expect(input.resolution.value).toMatchObject({ status: 'ready', method: 'qnh-elevation', displayFt: -100 })
  const resolution = input.resolution.value
  if (resolution.status !== 'ready') throw new Error('expected ready')
  expect(resolution.value).toBe(-100)
  // The stored declaration keeps its original value; nothing about PA is written.
  expect(JSON.parse(localStorage.getItem(MANUAL_RUNWAY_STORAGE_KEY)!).runway.fieldElevation).toEqual({ value: -100, unit: 'ft' })
  expect({ ...localStorage }).toEqual(storedBefore)
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
  // A cleared copy falls back to the fresh unit preference (ft), never to a stale unit.
  expect(input.draft.elevationUnit).toBe('ft')
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

it('starts with preferred hPa/ft units and converts the elevation on a unit change', () => {
  const { input, stop } = withInput()
  expect(input.draft.qnhUnit).toBe('hPa')
  expect(input.draft.elevationUnit).toBe('ft')
  input.method.value = 'qnh-elevation'
  Object.assign(input.draft, { qnh: '1013.25', elevation: '1000' })
  const ft = input.resolution.value
  input.draft.elevationUnit = 'm'
  expect(input.draft.elevation).toBe('304.8')
  const m = input.resolution.value
  if (ft.status !== 'ready' || m.status !== 'ready') throw new Error('expected ready')
  expect(m.value).toBeCloseTo(ft.value as number, 9)
  input.draft.elevationUnit = 'ft'
  expect(input.draft.elevation).toBe('1000')
  // Only units are preferences; no numeric PA or QNH input is written.
  expect(Object.keys(localStorage).some((key) => key.includes('preferences'))).toBe(false)
  stop()
})

it('keeps runway provenance when a copied elevation is converted', () => {
  saveRunway('304.8', 'm')
  const { input, stop } = withInput()
  input.method.value = 'qnh-elevation'
  input.useRunwayElevation()
  expect(input.draft.elevationUnit).toBe('m')
  input.draft.elevationUnit = 'ft'
  expect(input.draft.elevation).toBe('1000')
  expect(input.copiedFromRunway.value).toBe(true)
  stop()
})

it('converts accepted scientific-notation elevations instead of relabelling them', () => {
  const { input, stop } = withInput()
  input.method.value = 'qnh-elevation'
  input.draft.qnh = '1013.25'
  input.draft.elevation = '1e3'
  const before = input.resolution.value
  input.draft.elevationUnit = 'm'
  expect(input.draft.elevation).toBe('304.8')
  expect(input.resolution.value).toEqual(before)
  stop()
})
