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
