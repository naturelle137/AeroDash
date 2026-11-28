import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useConnectivityStore } from './connectivity.store'

afterEach(() => vi.restoreAllMocks())

it('shares browser state, refreshes after restoration and detaches listeners after the last user', async () => {
  const state = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  const remove = vi.spyOn(window, 'removeEventListener')
  const component = defineComponent({ setup: useConnectivityStore, template: '<span>{{ online }}</span>' })
  const first = mount(component)
  const second = mount(component)
  expect(first.text()).toBe('false')
  state.mockReturnValue(true)
  window.dispatchEvent(new Event('online'))
  await nextTick()
  expect(first.text()).toBe('true')
  expect(second.text()).toBe('true')
  first.unmount()
  expect(remove).not.toHaveBeenCalledWith('online', expect.anything())
  state.mockReturnValue(false)
  window.dispatchEvent(new Event('pageshow'))
  await nextTick()
  expect(second.text()).toBe('false')
  second.unmount()
  expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
})
