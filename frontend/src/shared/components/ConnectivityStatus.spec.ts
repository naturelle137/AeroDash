import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConnectivityStatus from './ConnectivityStatus.vue'

afterEach(() => vi.restoreAllMocks())

describe('browser connectivity status', () => {
  it('reads initial offline state, updates on both network events and explains its limits', async () => {
    const state = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const wrapper = mount(ConnectivityStatus)
    expect(wrapper.get('[role="status"]').text()).toBe('Browser offline')
    expect(wrapper.text()).toContain('offline cache readiness and source freshness are not verified')
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    for (const online of [true, false, true]) {
      state.mockReturnValue(online)
      window.dispatchEvent(new Event(online ? 'online' : 'offline'))
      await nextTick()
      expect(wrapper.get('[role="status"]').text()).toBe(`Browser ${online ? 'online' : 'offline'}`)
    }
    wrapper.unmount()
  })

  it('refreshes after page restoration and removes the exact listeners on unmount', async () => {
    const state = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(ConnectivityStatus)
    state.mockReturnValue(false)
    window.dispatchEvent(new Event('pageshow'))
    await nextTick()
    expect(wrapper.get('[role="status"]').text()).toBe('Browser offline')
    const listeners = add.mock.calls.filter(([type]) => ['online', 'offline', 'pageshow'].includes(type))
    expect(listeners).toHaveLength(3)
    wrapper.unmount()
    for (const [type, listener] of listeners) expect(remove).toHaveBeenCalledWith(type, listener)
    state.mockClear()
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('pageshow'))
    expect(state).not.toHaveBeenCalled()
    const remounted = mount(ConnectivityStatus)
    expect(remounted.get('[role="status"]').text()).toBe('Browser offline')
    remounted.unmount()
  })
})
