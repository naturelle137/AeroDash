/**
 * Unit tests for IncidentReportsView.vue — list / open-on-GitHub / delete
 * surface for the in-app incident-reporting MVP (issue #281, PR-006).
 */

// @UT-UI-VIEW-010@ (FROM: @IMP-UI-VIEW-005@)
// @UT-UI-VIEW-011@ (FROM: @IMP-UI-VIEW-005@)
// @UT-UI-VIEW-012@ (FROM: @IMP-UI-VIEW-005@)

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import IncidentReportsView from '../IncidentReportsView.vue'
import { useIncidentReportStore } from '@/stores/incident-report.store'

const Stub = defineComponent({
  setup() {
    return () => h('div')
  },
})

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: Stub }],
  })
}

async function settle(): Promise<void> {
  // fake-indexeddb schedules onsuccess callbacks through the macrotask queue,
  // so flushPromises (microtasks only) is not enough. Pump a few real-timer
  // ticks alongside flushPromises until the store transitions out of LOADING.
  for (let i = 0; i < 6; i += 1) {
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
  }
}

async function mountView() {
  const router = buildRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(IncidentReportsView, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await settle()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('IncidentReportsView', () => {
  it('shows the empty-state copy when the queue is empty', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="incidents-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="incidents-list"]').exists()).toBe(false)
  })

  it('lists queued reports newest-first', async () => {
    const store = useIncidentReportStore()
    await store.capture({
      kind: 'OTHER',
      summary: 'Older report saved',
      description: 'A description long enough.',
    })
    await store.capture({
      kind: 'UI',
      summary: 'Newer report saved',
      description: 'Another long-enough description.',
    })

    const wrapper = await mountView()
    const summaries = wrapper
      .findAll('.incidents__summary')
      .map((node) => node.text())
    expect(summaries[0]).toBe('Newer report saved')
    expect(summaries[1]).toBe('Older report saved')
  })

  it('builds an "Open on GitHub" link that targets the issues/new endpoint', async () => {
    const store = useIncidentReportStore()
    await store.capture({
      kind: 'CALCULATION',
      summary: 'CG amber after fuel',
      description: 'Loaded 100 kg pilot mass; the envelope chart went amber.',
    })

    const wrapper = await mountView()
    const link = wrapper.find('[data-testid="open-on-github"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toContain(
      'github.com/naturelle137/AeroDash/issues/new',
    )
    expect(decodeURIComponent(link.attributes('href') ?? '')).toContain(
      '[Incident] CG amber after fuel',
    )
  })
})
