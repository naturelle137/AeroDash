import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import PerformanceView from './PerformanceView.vue'

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

/** Control inside the label whose own text starts with the given caption. */
function field(view: VueWrapper, caption: string) {
  const label = view.findAll('label').find((item) => item.text().startsWith(caption))
  if (!label) throw new Error(`No field ${caption}`)
  const target = label.attributes('for')
  return target ? view.get(`#${target}`) : label.find('input, select')
}
async function fillLookup(view: VueWrapper, mass: string, pressureAltitude: string, temperature: string) {
  await field(view, 'Enter pressure altitude directly').setValue(true)
  await field(view, 'Mass (kg)').setValue(mass)
  await field(view, 'Pressure altitude (ft)').setValue(pressureAltitude)
  await field(view, 'Temperature (°C)').setValue(temperature)
}
const results = (view: VueWrapper) => view.find('[aria-label="Base performance distances"]')

it('uses persisted profiles and immediately clears results on numeric, selection and profile changes', async () => {
  const fleet = useFleetStore()
  fleet.profiles = [testPohAircraft(), { ...testPohAircraft(), id: '00000000-0000-4000-a000-000000000429', status: 'draft' }]
  fleet.fleetLoadState = 'READY'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  await view.get('select').setValue(fleet.profiles[0]!.id)
  await fillLookup(view, '900', '1000', '10')
  expect(view.get('[aria-label="Base performance distances"]').text()).toContain('220.0 m')
  expect(results(view).text()).toContain('1000 ft, entered directly')
  await field(view, 'Mass (kg)').setValue('')
  expect(view.find('[aria-label="Base performance distances"]').exists()).toBe(false)
  expect(view.text()).toContain('finite mass')
  await field(view, 'Mass (kg)').setValue('900')
  fleet.profiles[0]!.performanceProfiles = []
  await flushPromises()
  expect(results(view).exists()).toBe(false)
  await view.get('select').setValue(fleet.profiles[1]!.id)
  expect(view.get('[role="alert"]').text()).toContain('Draft')
  expect(view.find('[aria-label="Base performance distances"]').exists()).toBe(false)
})

it('reports storage error with retry and blocks computation', async () => {
  const fleet = useFleetStore()
  fleet.fleetLoadState = 'ERROR'
  fleet.fleetLoadError = 'Test read failure'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  expect(view.get('[role="alert"]').text()).toContain('Test read failure')
  expect(view.find('form[aria-label="Performance lookup conditions"] button[type="submit"]').exists()).toBe(false)
  await view.get('[role="alert"] button').trigger('click')
  expect(fleet.loadAll).toHaveBeenCalledTimes(2)
})

it('clears results on source-unit and provenance edits and visibly blocks invalid declarations', async () => {
  const fleet = useFleetStore()
  fleet.profiles = [testPohAircraft()]
  fleet.fleetLoadState = 'READY'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  await view.get('select').setValue(fleet.profiles[0]!.id)
  await fillLookup(view, '900', '1000', '10')
  expect(view.find('[aria-label="Base performance distances"]').exists()).toBe(true)
  fleet.profiles[0]!.performanceProfiles![0]!.sourceUnits = { mass: 'kg', pressureAltitude: 'ft', temperature: '°C', distance: 'm' }
  await flushPromises()
  expect(results(view).text()).toContain('220.0 m')
  fleet.profiles[0]!.performanceProfiles![0]!.sourceReference = 'Changed manual reference'
  await flushPromises()
  expect(results(view).exists()).toBe(true)
  Object.assign(fleet.profiles[0]!.performanceProfiles![0]!.sourceUnits!, { distance: 'yd' })
  await flushPromises()
  expect(view.findAll('[role="alert"]')[0]!.text()).toContain('source-unit declarations')
  expect(view.find('[aria-label="Base performance distances"]').exists()).toBe(false)
})

it('composes the manual runway panel without letting runway entry create raw distances or an assessment', async () => {
  const fleet = useFleetStore()
  fleet.profiles = [testPohAircraft()]
  fleet.fleetLoadState = 'READY'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  const panel = view.get('form[aria-labelledby="manual-runway-heading"]')
  for (const [selector, value] of [
    ['#manual-runway-aerodrome', 'TEST'], ['#manual-runway-designator', '27'], ['#manual-runway-tora', '800'],
    ['#manual-runway-tora-unit', 'm'], ['#manual-runway-lda', '700'], ['#manual-runway-lda-unit', 'm'],
    ['#manual-runway-elevation', '1000'], ['#manual-runway-elevation-unit', 'ft'],
    ['#manual-runway-surface-type', 'paved'], ['#manual-runway-surface-condition', 'dry'],
  ] as const) await view.get(selector).setValue(value)
  await panel.trigger('submit')
  expect(view.get('[aria-label="Saved manual runway"]').text()).toContain('1000 ft (304.8 m)')
  expect(view.find('[aria-label="Base performance distances"]').exists()).toBe(false)
  expect(view.text()).toContain('Runway assessment unavailable')
  // Field elevation is never copied into pressure altitude, and no method is preselected.
  expect(view.text()).toContain('No method selected')
  await field(view, 'Enter pressure altitude directly').setValue(true)
  expect((field(view, 'Pressure altitude (ft)').element as HTMLInputElement).value).toBe('')
})

async function mountReady() {
  const fleet = useFleetStore()
  fleet.profiles = [testPohAircraft()]
  fleet.fleetLoadState = 'READY'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  await view.get('select').setValue(fleet.profiles[0]!.id)
  await field(view, 'Mass (kg)').setValue('900')
  await field(view, 'Temperature (°C)').setValue('10')
  return view
}
async function fillDerived(view: VueWrapper, qnh: string, qnhUnit: string, elevation: string, elevationUnit: string) {
  await field(view, 'Derive from QNH and field elevation').setValue(true)
  await field(view, 'QNH unit').setValue(qnhUnit)
  await field(view, 'QNH').setValue(qnh)
  await field(view, 'Pressure-altitude field elevation unit').setValue(elevationUnit)
  await field(view, 'Pressure-altitude field elevation').setValue(elevation)
}

it('blocks computation until a pressure-altitude method is chosen', async () => {
  const view = await mountReady()
  expect(view.get('[role="alert"]').text()).toContain('Choose how pressure altitude is provided')
  expect(results(view).exists()).toBe(false)
})

it('derives pressure altitude from QNH and elevation and uses the unrounded value', async () => {
  const view = await mountReady()
  await fillDerived(view, '1000', 'hPa', '457.2', 'm')
  // Independent reference: 1863.794043 ft (Python decimal); TOR = 200 + 100 + PA/100 + 10.
  expect(view.get('[aria-label="Derived pressure altitude"]').text()).toContain('1864 ft')
  expect(view.text()).not.toContain('The lookup uses the unrounded value.')
  expect(view.text()).toContain('Field elevation source: Entered by you.')
  expect(results(view).text()).toContain('228.6 m')
  expect(results(view).text()).toContain('1864 ft, derived from QNH and field elevation')
  // Raw PA 1854.494043 ft gives 228.544940 m; using displayed 1855 ft would give 228.6 m.
  await field(view, 'Pressure-altitude field elevation').setValue('454.36536')
  expect(view.get('[aria-label="Derived pressure altitude"]').text()).toContain('1855 ft')
  expect(results(view).text()).toContain('228.5 m')

})

it('keeps the direct entry untouched across method changes and clears results on every change', async () => {
  const view = await mountReady()
  await fillLookup(view, '900', '1000', '10')
  // Exact standard QNH at 100 ft gives 100 ft, TOR 211.0 m.
  await fillDerived(view, '1013.25', 'hPa', '100', 'ft')
  expect(results(view).text()).toContain('211.0 m')
  for (const [caption, value] of [['QNH', '1013'], ['QNH unit', ''], ['Pressure-altitude field elevation', '1'], ['Pressure-altitude field elevation unit', 'm']] as const) {
      await field(view, caption).setValue(value)
    expect(results(view).exists()).toBe(caption === 'QNH')
  }
  await fillDerived(view, '1013.25', 'hPa', '100', 'ft')
  await field(view, 'Enter pressure altitude directly').setValue(true)
  expect(results(view).exists()).toBe(true)
  expect((field(view, 'Pressure altitude (ft)').element as HTMLInputElement).value).toBe('1000')
  expect(results(view).text()).toContain('220.0 m')
})

it.each([
  ['', 'hPa', '0', 'ft', 'finite decimal'],
  ['1013', '', '0', 'ft', 'Select the QNH unit'],
  ['849', 'hPa', '0', 'ft', 'outside the supported 850–1100 hPa'],
  ['1013', 'hPa', 'Infinity', 'ft', 'finite decimal'],
  ['1013', 'hPa', '0', '', 'ft or m'],
  ['1013', 'hPa', '-1501', 'ft', 'outside the supported'],
])('blocks invalid derived input QNH %j %s elevation %j %s', async (qnh, qnhUnit, elevation, elevationUnit, message) => {
  const view = await mountReady()
  await fillDerived(view, qnh, qnhUnit, elevation, elevationUnit)
  expect(view.text()).toContain(message)
  expect(view.get('[role="alert"]').text()).toContain('Derived pressure altitude is unavailable')
  expect(view.find('[aria-label="Derived pressure altitude"]').exists()).toBe(false)
  expect(results(view).exists()).toBe(false)
})

it('warns outside the standard QNH band without blocking inside the model range', async () => {
  const view = await mountReady()
  await fillDerived(view, '940', 'hPa', '-30.48', 'm')
  expect(view.text()).toContain('WARN-UI-001')
  expect(results(view).exists()).toBe(true)
})

it('copies the saved runway elevation only on request and drops it when the runway changes', async () => {
  const view = await mountReady()
  const runwayFields = [
    ['#manual-runway-aerodrome', 'TEST'], ['#manual-runway-designator', '27'], ['#manual-runway-tora', '800'],
    ['#manual-runway-tora-unit', 'm'], ['#manual-runway-lda', '700'], ['#manual-runway-lda-unit', 'm'],
    ['#manual-runway-elevation-unit', 'm'], ['#manual-runway-elevation', '304.8'],
    ['#manual-runway-surface-type', 'paved'], ['#manual-runway-surface-condition', 'dry'],
  ] as const
  for (const [selector, value] of runwayFields) await view.get(selector).setValue(value)
  await view.get('form[aria-labelledby="manual-runway-heading"]').trigger('submit')
  await field(view, 'Derive from QNH and field elevation').setValue(true)
  expect((field(view, 'Pressure-altitude field elevation').element as HTMLInputElement).value).toBe('')
  await field(view, 'QNH unit').setValue('hPa')
  await field(view, 'QNH').setValue('1013.25')
  const copy = view.findAll('button').find((button) => button.text().includes('Use saved manual runway elevation'))!
  await copy.trigger('click')
  expect((field(view, 'Pressure-altitude field elevation').element as HTMLInputElement).value).toBe('304.8')
  expect((field(view, 'Pressure-altitude field elevation unit').element as HTMLSelectElement).value).toBe('m')
  expect(view.text()).toContain('Copied by you from the saved manual runway TEST 27')
  // Exact standard QNH at 1000 ft gives 1000 ft, TOR 220.0 m.
  expect(view.get('[aria-label="Derived pressure altitude"]').text()).toContain('1000 ft')
  expect(results(view).text()).toContain('220.0 m')
  // Editing the runway invalidates the copied elevation, its derived PA and the distances.
  await view.get('#manual-runway-elevation').setValue('0')
  expect(results(view).exists()).toBe(false)
  expect((field(view, 'Pressure-altitude field elevation').element as HTMLInputElement).value).toBe('')
  expect(view.text()).toContain('copied field elevation was removed')
  expect(view.find('[aria-label="Derived pressure altitude"]').exists()).toBe(false)
  // A pilot edit after copying becomes pilot-entered and survives runway clearing.
  await view.get('#manual-runway-elevation').setValue('304.8')
  await copy.trigger('click')
  await field(view, 'Pressure-altitude field elevation').setValue('304.9')
  expect(view.text()).toContain('Field elevation source: Entered by you.')
  const clear = view.findAll('button').find((button) => button.text().startsWith('Clear'))
  await clear!.trigger('click')
  expect((field(view, 'Pressure-altitude field elevation').element as HTMLInputElement).value).toBe('304.9')
})

it('does not persist pressure-altitude inputs', async () => {
  const view = await mountReady()
  await fillDerived(view, '1000', 'hPa', '100', 'ft')
  view.unmount()
  expect(Object.keys(localStorage)).toEqual([])
  const again = await mountReady()
  expect(again.text()).toContain('No method selected')
})

const assessment = (view: VueWrapper) => view.find('[aria-label="Correction source assessment"]')
const assessButton = (view: VueWrapper) => view.findAll('button').find((item) => item.text() === 'Assess correction sources')!

it('assesses correction sources on request and clears the assessment when any basis changes', async () => {
  const fleet = useFleetStore()
  // Synthetic type designator of an inspected manual; the match must never count as applicability.
  const tecnamLike = { ...testPohAircraft(), icaoTypeDesignator: 'P208',
    certificationCategories: [{ ...testPohAircraft().certificationCategories[0]!, mtom: 650 }],
    surfaceConditions: [{ name: 'Grass', takeoffFactor: 1.2, landingFactor: 1.2 }] }
  fleet.profiles = [tecnamLike]
  fleet.fleetLoadState = 'READY'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  expect(assessButton(view).attributes('disabled')).toBeDefined()
  await view.get('#performance-aircraft').setValue(tecnamLike.id)
  await assessButton(view).trigger('click')
  const text = assessment(view).text()
  expect(text).toContain('A source is identified for some corrections')
  expect(text).toContain('stores surface factors without source, target or range evidence. They are not used.')
  expect(text).toContain('Supplement S4 (650 kg)')
  expect(text).toContain('Written for 630 kg; this profile\'s maximum mass is 650 kg.')
  expect(text).toContain('No saved, unchanged manual runway')
  expect(text).not.toMatch(/selected source|approved source|×\s?\d/)
  expect(view.find('[aria-label="Base performance distances"]').exists()).toBe(false)

  await field(view, 'Mass (kg)').setValue('900')
  expect(assessment(view).exists()).toBe(false)
  await assessButton(view).trigger('click')
  await view.get('#manual-runway-aerodrome').setValue('TEST')
  expect(assessment(view).exists()).toBe(false)
  await assessButton(view).trigger('click')
  fleet.profiles = [{ ...tecnamLike, registration: 'D-TESU' }]
  await flushPromises()
  expect(assessment(view).exists()).toBe(false)
})

it('refuses source assessment for a Draft or a profile without complete base tables', async () => {
  const fleet = useFleetStore()
  fleet.profiles = [{ ...testPohAircraft(), performanceProfiles: [] }, { ...testPohAircraft(), id: '00000000-0000-4000-a000-000000000429', status: 'draft' }]
  fleet.fleetLoadState = 'READY'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  await view.get('#performance-aircraft').setValue(fleet.profiles[0]!.id)
  await assessButton(view).trigger('click')
  expect(assessment(view).text()).toContain('No correction source can replace missing aircraft tables')
  await view.get('#performance-aircraft').setValue(fleet.profiles[1]!.id)
  await assessButton(view).trigger('click')
  expect(assessment(view).text()).toContain('This profile is a Draft')
})
