/**
 * Integration test — issue #263 (DP-004 / CS-012).
 *
 * Validates the end-to-end behaviour of the sessionStorage-failure pilot
 * advisory: the `pwaUpdateStore.sessionStorageAdvisory` ref drives a banner
 * in `App.vue`, and the banner's Dismiss button clears the advisory.
 *
 * Mounts the real `App.vue` against a memory-history router so the wiring
 * between store ↔ template is exercised exactly as production runs.
 */

// @IT-SYS-APP-001@ (FROM: @IMP-SYS-STORE-011@, @IMP-SYS-STORE-012@)

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  createMemoryHistory,
  createRouter,
  type Router,
} from 'vue-router'
import { defineComponent, h } from 'vue'

import App from '../App.vue'
import { usePwaUpdateStore } from '../stores/pwa-update.store'

const Stub = defineComponent({
  name: 'StubView',
  setup: () => () => h('div', { 'data-testid': 'stub' }, 'stub'),
})

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/fleet', name: 'fleet', component: Stub },
    ],
  })
}

async function mountApp(): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(App, {
    global: {
      plugins: [router],
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('App.vue ↔ pwaUpdateStore session-storage advisory (issue #263)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // Re-set pinia so each test starts clean — App teardown is handled by Vue test-utils.
    setActivePinia(createPinia())
  })

  it('does not render the advisory banner when sessionStorageAdvisory is false', async () => {
    const { wrapper } = await mountApp()

    const banner = wrapper.find('[data-testid="session-storage-advisory"]')
    expect(banner.exists()).toBe(false)
  })

  it('renders the advisory banner when raiseSessionStorageAdvisory() is called', async () => {
    const { wrapper } = await mountApp()
    const store = usePwaUpdateStore()

    store.raiseSessionStorageAdvisory()
    await flushPromises()

    const banner = wrapper.find('[data-testid="session-storage-advisory"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toMatch(/session storage is unavailable/i)
  })

  it('hides the advisory banner after the Dismiss button is clicked', async () => {
    const { wrapper } = await mountApp()
    const store = usePwaUpdateStore()

    store.raiseSessionStorageAdvisory()
    await flushPromises()

    const dismissButton = wrapper.find('.session-storage-advisory__btn')
    expect(dismissButton.exists()).toBe(true)
    await dismissButton.trigger('click')
    await flushPromises()

    expect(store.sessionStorageAdvisory).toBe(false)
    expect(wrapper.find('[data-testid="session-storage-advisory"]').exists()).toBe(false)
  })

  it('renders the advisory with the polite live-region role for accessibility', async () => {
    const { wrapper } = await mountApp()
    const store = usePwaUpdateStore()

    store.raiseSessionStorageAdvisory()
    await flushPromises()

    const banner = wrapper.find('[data-testid="session-storage-advisory"]')
    expect(banner.attributes('role')).toBe('status')
    expect(banner.attributes('aria-live')).toBe('polite')
  })
})
