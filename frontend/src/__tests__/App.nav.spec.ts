/**
 * Reachability tests for the Privacy (GDPR data-rights) navigation link.
 *
 * The /privacy view hosts the REQ-SYS-014 (Delete-All-Data) and REQ-SYS-015
 * (bulk export) controls. The desktop / tablet sidebar exposes every
 * destination (including Privacy) at >= 768px, but on phone-width viewports
 * (< 768px) the sidebar is hidden and only the bottom nav renders. These
 * tests pin Privacy into BOTH surfaces so a future edit that drops it from the
 * mobile bottom nav — silently making the data-rights surface desktop-only —
 * fails here rather than shipping a phone-unreachable compliance control.
 *
 * CSS media queries are not evaluated by jsdom, so both <nav> elements are in
 * the DOM regardless of viewport; we assert the link's presence per surface.
 */

// @UT-UI-SHARED-003@ (FROM: @IMP-UI-SHARED-007@)

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import App from '../App.vue'

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/fleet', name: 'fleet', component: { template: '<div />' } },
      { path: '/mass-balance', name: 'mass-balance', component: { template: '<div />' } },
      { path: '/privacy', name: 'privacy', component: { template: '<div />' } },
    ],
  })
}

async function mountApp(): Promise<VueWrapper> {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = buildRouter()
  await router.push('/')
  await router.isReady()

  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router],
      stubs: {
        RouterView: { template: '<div data-testid="router-view-stub" />' },
        // Render `to` as an href so destination reachability is assertable.
        RouterLink: {
          name: 'RouterLink',
          props: ['to'],
          template: '<a :href="to"><slot /></a>',
        },
        AppLogo: { template: '<div />' },
        AppVersion: { template: '<div />' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('App.vue — Privacy data-rights nav reachability (REQ-SYS-014/015)', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('exposes the Privacy link in the mobile bottom nav (reachable on phone-width)', async () => {
    wrapper = await mountApp()
    const bottomNav = wrapper.find('.app-bottom-nav')
    expect(bottomNav.exists()).toBe(true)
    const link = bottomNav.find('a[href="/privacy"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain('Privacy')
  })

  it('exposes the Privacy link in the desktop/tablet sidebar', async () => {
    wrapper = await mountApp()
    const sidebar = wrapper.find('.app-sidebar')
    expect(sidebar.exists()).toBe(true)
    expect(sidebar.find('a[href="/privacy"]').exists()).toBe(true)
  })
})
