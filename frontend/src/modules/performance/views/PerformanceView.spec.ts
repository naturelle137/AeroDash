import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import PerformanceView from './PerformanceView.vue'

beforeEach(() => { setActivePinia(createPinia()) })

it('uses persisted profiles and immediately clears results on numeric, selection and profile changes', async () => {
  const fleet = useFleetStore()
  fleet.profiles = [testPohAircraft(), { ...testPohAircraft(), id: '00000000-0000-4000-a000-000000000429', status: 'draft' }]
  fleet.fleetLoadState = 'READY'
  vi.spyOn(fleet, 'loadAll').mockResolvedValue()
  const view = mount(PerformanceView, { global: { stubs: { RouterLink: true } } })
  await flushPromises()
  await view.get('select').setValue(fleet.profiles[0]!.id)
  const fields = view.findAll('input')
  for (const [index, value] of ['900', '1000', '10'].entries()) await fields[index]!.setValue(value)
  await view.get('form').trigger('submit')
  expect(view.get('[aria-label="Raw POH table distances"]').text()).toContain('220.0 m')
  await fields[0]!.setValue('')
  expect(view.find('[aria-label="Raw POH table distances"]').exists()).toBe(false)
  await view.get('form').trigger('submit')
  expect(view.get('[role="alert"]').text()).toContain('required')
  await fields[0]!.setValue('900')
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
  for (const [index, value] of ['900', '1000', '10'].entries()) await view.findAll('input')[index]!.setValue(value)
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
  localStorage.clear()
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
  // Field elevation is never copied into the pressure-altitude lookup field.
  expect((view.findAll('input')[1]!.element as HTMLInputElement).value).toBe('')
})
