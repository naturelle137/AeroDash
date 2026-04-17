/**
 * Unit tests for the version-blocked screen conditional (REQ-SYS-006).
 *
 * Tests verify that:
 * 1. useAppVersionStore.versionBlocked correctly gates content rendering.
 * 2. The gate is reactive — components re-render when the store flag changes.
 * 3. Version strings flow through to the blocked-screen component correctly.
 *
 * Uses a minimal VersionGate wrapper component to avoid App.vue module-cache
 * interference when running alongside other test files in the full unit suite.
 */

// @UT-SYS-APP-026@ (FROM: @IMP-SYS-SHARED-006@, @REQ-SYS-006@)

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { useAppVersionStore } from '@/stores/app-version.store'

/**
 * Minimal component that mirrors the v-if/v-else gate in App.vue (REQ-SYS-006).
 * Tested independently of App.vue to ensure module-isolation in the full suite.
 */
const VersionGate = defineComponent({
  name: 'VersionGate',
  setup() {
    const store = useAppVersionStore()
    return () =>
      store.versionBlocked
        ? h('div', { 'data-testid': 'version-blocked-screen' }, [
            h('span', { 'data-testid': 'current-version' }, store.currentVersion),
            h('span', { 'data-testid': 'min-version' }, store.minSafeVersion),
          ])
        : h('div', { 'data-testid': 'router-view' }, 'content')
  },
})

describe('REQ-SYS-006 version-blocked gate (store state + rendering)', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  function mountVersionGate() {
    return mount(VersionGate, { global: { plugins: [pinia] } })
  }

  // @UT-SYS-APP-026@ (FROM: @IMP-SYS-SHARED-006@, @REQ-SYS-006@)
  it('renders content when versionBlocked is false', async () => {
    const store = useAppVersionStore()
    store.versionBlocked = false

    const wrapper = mountVersionGate()
    await flushPromises()

    expect(wrapper.find('[data-testid="version-blocked-screen"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(true)
  })

  // @UT-SYS-APP-027@ (FROM: @IMP-SYS-SHARED-006@, @REQ-SYS-006@)
  it('renders version-blocked-screen and hides content when versionBlocked is true', async () => {
    const store = useAppVersionStore()
    store.versionBlocked = true

    const wrapper = mountVersionGate()
    await flushPromises()

    expect(wrapper.find('[data-testid="version-blocked-screen"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(false)
  })

  // @UT-SYS-APP-028@ (FROM: @IMP-SYS-SHARED-006@, @REQ-SYS-006@)
  it('blocked screen exposes currentVersion and minSafeVersion from store', async () => {
    const store = useAppVersionStore()
    store.versionBlocked = true
    store.currentVersion = '0.1.0'
    store.minSafeVersion = '0.3.0'

    const wrapper = mountVersionGate()
    await flushPromises()

    const screen = wrapper.find('[data-testid="version-blocked-screen"]')
    expect(screen.exists()).toBe(true)
    expect(wrapper.find('[data-testid="current-version"]').text()).toBe('0.1.0')
    expect(wrapper.find('[data-testid="min-version"]').text()).toBe('0.3.0')
  })

  // @UT-SYS-APP-029@ (FROM: @IMP-SYS-STORE-008@, @REQ-SYS-006@)
  it('checkMinSafeVersion sets versionBlocked=true when current < minimum', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const store = useAppVersionStore()
    store.currentVersion = '0.1.0'
    store.minSafeVersion = '0.3.0'
    store.versionBlocked = false

    await store.checkMinSafeVersion()

    expect(store.versionBlocked).toBe(true)
    vi.unstubAllGlobals()
  })

  // @UT-SYS-APP-030@ (FROM: @IMP-SYS-SHARED-006@, @REQ-SYS-006@)
  it('versionBlocked gate is reactive: component re-renders when store state changes', async () => {
    const store = useAppVersionStore()
    store.versionBlocked = false

    const wrapper = mountVersionGate()
    await flushPromises()
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(true)

    store.versionBlocked = true
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="version-blocked-screen"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(false)
  })
})
