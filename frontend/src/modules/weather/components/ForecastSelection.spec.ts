import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import ForecastSelection from './ForecastSelection.vue'

afterEach(() => vi.restoreAllMocks())

it('keeps a synthetic selection when browser connectivity changes', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const view = mount(ForecastSelection)
  await view.get('select').setValue('arrival')
  await view.get('input[type="text"]').setValue('Test airfield')
  await view.get('input[type="datetime-local"]').setValue('2030-06-01T12:30')
  expect(view.get('[role="status"]').text()).toContain('No forecast source is configured')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  window.dispatchEvent(new Event('offline'))
  await view.vm.$nextTick()
  expect(view.get('[role="status"]').text()).toContain('Browser offline')
  expect((view.get('select').element as HTMLSelectElement).value).toBe('arrival')
  expect((view.get('input[type="text"]').element as HTMLInputElement).value).toBe('Test airfield')
  expect((view.get('input[type="datetime-local"]').element as HTMLInputElement).value).toBe('2030-06-01T12:30')
  view.unmount()
})
