/**
 * Integration test: incomplete forgotten-passcode deletion stays visible and
 * retryable on the lock screen (REQ-SYS-014, REQ-SYS-056..058).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

const wipe = vi.hoisted(() => vi.fn<() => Promise<{ complete: boolean }>>())
vi.mock('@/modules/aircraft/services/data-rights.service', async (orig) => ({
  ...(await orig<object>()),
  wipeAllLocalData: wipe,
}))

import App from '../App.vue'
import { useAppLockStore } from '../stores/app-lock.store'

const Stub = defineComponent({ setup: () => () => h('div', 'stub') })

describe('App lock screen erase retry', () => {
  beforeEach(() => {
    localStorage.clear()
    wipe.mockReset()
    setActivePinia(createPinia())
  })

  it('keeps the lock screen and error visible when deletion is incomplete, then clears on retry', async () => {
    const seed = useAppLockStore()
    expect(await seed.enable('correct horse')).toBe('ok')
    setActivePinia(createPinia())

    wipe.mockImplementationOnce(async () => {
      localStorage.removeItem('aerodash.applock.v1')
      return { complete: false }
    })
    wipe.mockImplementationOnce(async () => ({ complete: true }))

    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Stub }] })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const screen = () => document.body.querySelector('[data-testid="app-lock-screen"]')
    expect(screen()).not.toBeNull()
    ;(document.body.querySelector('[data-testid="app-lock-forgot"]') as HTMLElement | null)?.click()
    await flushPromises()
    const input = document.body.querySelector('[data-testid="app-lock-erase-input"]') as HTMLInputElement
    input.value = 'DELETE ALL DATA'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    const btn = document.body.querySelector('[data-testid="app-lock-erase"]') as HTMLButtonElement
    btn.click()
    await flushPromises()

    expect(screen()).not.toBeNull()
    expect(document.body.querySelector('[data-testid="app-lock-erase-error"]')).not.toBeNull()

    btn.click()
    await flushPromises()
    expect(wipe).toHaveBeenCalledTimes(2)
    expect(screen()).toBeNull()
    wrapper.unmount()
  })
})
