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
import {
  STORAGE_KEY,
  useDisclaimerAcknowledgementStore,
  type AcknowledgementRecord,
} from '../stores/disclaimer-acknowledgement.store'

const Stub = defineComponent({
  name: 'StubView',
  setup: () => () => h('div', { 'data-testid': 'stub-view' }, 'stub'),
})

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/mass-balance', name: 'mass-balance', component: Stub },
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

describe('App.vue ↔ disclaimer-acknowledgement gate (REQ-SYS-016)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.body.innerHTML = ''
  })

  // @IT-SYS-APP-002@ (FROM: @IMP-SYS-STORE-022@, @IMP-UI-SHARED-008@, @IMP-UI-SHARED-002@)
  it('renders the blocking gate on first launch (no record stored)', async () => {
    await mountApp()
    const gate = document.querySelector('[data-testid="disclaimer-gate"]')
    expect(gate).not.toBeNull()
  })

  // @IT-SYS-APP-003@ (FROM: @IMP-SYS-STORE-022@, @IMP-UI-SHARED-002@)
  it('hides the gate when a record for the current baseline is already stored', async () => {
    // Pre-stage the persisted acceptance BEFORE the store/App mount.
    // We do not know the running build's baseline at compile time; assemble
    // the record from the store-computed baseline.
    setActivePinia(createPinia())
    const store = useDisclaimerAcknowledgementStore()
    const baseline = store.currentBaseline as string
    const record: AcknowledgementRecord = {
      schemaVersion: 1,
      acceptedVersion: store.currentVersion,
      acceptedBaseline: baseline,
      acceptedAt: 1_780_000_000_000,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))

    await mountApp()

    expect(document.querySelector('[data-testid="disclaimer-gate"]')).toBeNull()
  })

  // @IT-SYS-APP-004@ (FROM: @IMP-SYS-STORE-022@, @IMP-UI-SHARED-008@, @IMP-UI-SHARED-002@)
  it('hides the gate after the pilot clicks "Accept" and persists the acceptance', async () => {
    await mountApp()

    const gate = document.querySelector('[data-testid="disclaimer-gate"]')
    expect(gate).not.toBeNull()

    const acceptBtn = document.querySelector<HTMLButtonElement>(
      '[data-testid="disclaimer-gate-accept"]',
    )!
    acceptBtn.click()
    await flushPromises()

    expect(document.querySelector('[data-testid="disclaimer-gate"]')).toBeNull()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.schemaVersion).toBe(1)
    expect(typeof parsed.acceptedAt).toBe('number')
    expect(typeof parsed.acceptedBaseline).toBe('string')
  })

  // @IT-SYS-APP-005@ (FROM: @IMP-SYS-STORE-022@, @IMP-UI-SHARED-002@)
  it('shows the gate when only a different-baseline record is stored (milestone bump simulation)', async () => {
    // A clearly-stale baseline that no current build can equal.
    const previous: AcknowledgementRecord = {
      schemaVersion: 1,
      acceptedVersion: '9999.0.0',
      acceptedBaseline: '9999.0',
      acceptedAt: 1_700_000_000_000,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previous))

    await mountApp()

    expect(document.querySelector('[data-testid="disclaimer-gate"]')).not.toBeNull()
  })
})
