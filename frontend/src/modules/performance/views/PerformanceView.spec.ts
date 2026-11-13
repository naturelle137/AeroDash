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
const results = (view: VueWrapper) => view.find('[aria-label="Raw POH table distances"]')

it('uses persisted profiles and immediately clears results on numeric, selection and profile changes', async () => {
  const fleet = useFleetStore()
  fleet.profiles = [testPohAircraft(), { ...testPohAircraft(), id: '00000000-0000-4000-a000-000000000429', status: 'draft' }]
  fleet.fleetLoadState = 'READY'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  await view.get('select').setValue(fleet.profiles[0]!.id)
  await fillLookup(view, '900', '1000', '10')
  await view.get('form').trigger('submit')
  expect(view.get('[aria-label="Raw POH table distances"]').text()).toContain('220.0 m')
  expect(results(view).text()).toContain('1000 ft, entered directly')
  await field(view, 'Mass (kg)').setValue('')
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(false)
  await view.get('form').trigger('submit')
  expect(view.get('[role="alert"]').text()).toContain('required')
  await field(view, 'Mass (kg)').setValue('900')
  await view.get('form').trigger('submit')
  fleet.profiles[0]!.performanceProfiles = []
  await flushPromises()
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(false)
  await view.get('select').setValue(fleet.profiles[1]!.id)
  await view.get('form').trigger('submit')
  expect(view.get('[role="alert"]').text()).toContain('Draft')
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(false)
})

it('reports storage error with retry and blocks computation', async () => {
  const fleet = useFleetStore()
  fleet.fleetLoadState = 'ERROR'
  fleet.fleetLoadError = 'Test read failure'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  expect(view.get('[role="alert"]').text()).toContain('Test read failure')
  expect(view.get('button[type="submit"]').attributes('disabled')).toBeDefined()
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
  await view.get('form').trigger('submit')
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(true)
  fleet.profiles[0]!.performanceProfiles![0]!.sourceUnits = { mass: 'kg', pressureAltitude: 'ft', temperature: '°C', distance: 'm' }
  await flushPromises()
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(false)
  await view.get('form').trigger('submit')
  fleet.profiles[0]!.performanceProfiles![0]!.sourceReference = 'Changed manual reference'
  await flushPromises()
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(false)
  Object.assign(fleet.profiles[0]!.performanceProfiles![0]!.sourceUnits!, { distance: 'yd' })
  await view.get('form').trigger('submit')
  expect(view.findAll('[role="alert"]')[0]!.text()).toContain('source-unit declarations')
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(false)
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
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(false)
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
  await view.get('form').trigger('submit')
  expect(view.get('[role="alert"]').text()).toContain('Choose how pressure altitude is provided')
  expect(results(view).exists()).toBe(false)
})

it('derives pressure altitude from QNH and elevation and uses the unrounded value', async () => {
  const view = await mountReady()
  await fillDerived(view, '1000', 'hPa', '457.2', 'm')
  // Independent reference: 1854.993736 ft (Python decimal); TOR = 200 + 100 + PA/100 + 10.
  expect(view.get('[aria-label="Derived pressure altitude"]').text()).toContain('1855 ft')
  expect(view.text()).toContain('1500.0 ft')
  expect(view.text()).toContain('Field elevation source: Entered by you.')
  await view.get('form').trigger('submit')
  expect(results(view).text()).toContain('228.5 m')
  expect(results(view).text()).toContain('1855 ft, derived from QNH and field elevation')
})

it('keeps the direct entry untouched across method changes and clears results on every change', async () => {
  const view = await mountReady()
  await fillLookup(view, '900', '1000', '10')
  // QNH 1013.25 hPa at 100 ft gives 91.787216 ft (Python decimal), TOR 210.9 m.
  await fillDerived(view, '1013.25', 'hPa', '100', 'ft')
  await view.get('form').trigger('submit')
  expect(results(view).text()).toContain('210.9 m')
  for (const [caption, value] of [['QNH', '1013'], ['QNH unit', ''], ['Pressure-altitude field elevation', '1'], ['Pressure-altitude field elevation unit', 'm']] as const) {
    await view.get('form').trigger('submit')
    await field(view, caption).setValue(value)
    expect(results(view).exists()).toBe(false)
  }
  await fillDerived(view, '1013.25', 'hPa', '100', 'ft')
  await view.get('form').trigger('submit')
  await field(view, 'Enter pressure altitude directly').setValue(true)
  expect(results(view).exists()).toBe(false)
  expect((field(view, 'Pressure altitude (ft)').element as HTMLInputElement).value).toBe('1000')
  await view.get('form').trigger('submit')
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
  await view.get('form').trigger('submit')
  expect(view.text()).toContain(message)
  expect(view.get('[role="alert"]').text()).toContain('Derived pressure altitude is unavailable')
  expect(view.find('[aria-label="Derived pressure altitude"]').exists()).toBe(false)
  expect(results(view).exists()).toBe(false)
})

it('warns outside the standard QNH band without blocking inside the model range', async () => {
  const view = await mountReady()
  await fillDerived(view, '940', 'hPa', '-30.48', 'm')
  expect(view.text()).toContain('WARN-UI-001')
  await view.get('form').trigger('submit')
  expect(results(view).exists()).toBe(true)
})

it('copies the saved runway elevation only on request and drops it when the runway changes', async () => {
  const view = await mountReady()
  const runwayFields = [
    ['#manual-runway-aerodrome', 'TEST'], ['#manual-runway-designator', '27'], ['#manual-runway-tora', '800'],
    ['#manual-runway-tora-unit', 'm'], ['#manual-runway-lda', '700'], ['#manual-runway-lda-unit', 'm'],
    ['#manual-runway-elevation', '304.8'], ['#manual-runway-elevation-unit', 'm'],
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
  // QNH 1013.25 hPa at 1000 ft gives 991.567192 ft (Python decimal), TOR 219.9 m.
  expect(view.get('[aria-label="Derived pressure altitude"]').text()).toContain('992 ft')
  await view.get('form').trigger('submit')
  expect(results(view).text()).toContain('219.9 m')
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
