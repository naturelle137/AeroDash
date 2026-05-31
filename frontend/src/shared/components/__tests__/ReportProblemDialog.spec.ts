/**
 * Unit tests for ReportProblemDialog.vue — UI surface for the in-app
 * incident-reporting MVP (issue #281, PR-006).
 */

// @UT-UI-SHARED-040@ (FROM: @IMP-UI-SHARED-008@)
// @UT-UI-SHARED-041@ (FROM: @IMP-UI-SHARED-008@)
// @UT-UI-SHARED-042@ (FROM: @IMP-UI-SHARED-008@)
// @UT-UI-SHARED-043@ (FROM: @IMP-UI-SHARED-008@)

import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import ReportProblemDialog from '../ReportProblemDialog.vue'
import { useIncidentReportStore } from '@/stores/incident-report.store'

afterEach(() => {
  document.body.innerHTML = ''
})

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

async function mountDialog(open = true) {
  const router = buildRouter()
  await router.push('/')
  await router.isReady()
  return mount(ReportProblemDialog, {
    attachTo: document.body,
    props: { open },
    global: { plugins: [router] },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  })
})

describe('ReportProblemDialog', () => {
  it('renders the dialog when open', async () => {
    await mountDialog(true)
    expect(document.body.querySelector('[data-testid="report-problem-dialog"]')).not.toBeNull()
  })

  it('renders nothing when closed', async () => {
    await mountDialog(false)
    expect(document.body.querySelector('[data-testid="report-problem-dialog"]')).toBeNull()
  })

  it('updates the redaction preview as the description changes', async () => {
    await mountDialog(true)
    const textarea = document.body.querySelector('textarea')!
    ;(textarea as HTMLTextAreaElement).value = 'Reach me at pilot@example.com after 1700Z.'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    const preview = document.body.querySelector('[data-testid="redaction-preview"]')!
    expect(preview.textContent).toContain('[REDACTED-EMAIL]')
  })

  it('disables Save until summary and description meet length minimums', async () => {
    await mountDialog(true)
    const saveBtn = document.body.querySelector(
      '[data-testid="report-problem-save-btn"]',
    ) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)

    const summary = document.body.querySelector('input[type="text"]') as HTMLInputElement
    summary.value = 'short summary'
    summary.dispatchEvent(new Event('input', { bubbles: true }))
    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'A description that is plenty long.'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(saveBtn.disabled).toBe(false)
  })

  it('persists the report on submit', async () => {
    await mountDialog(true)

    const summary = document.body.querySelector('input[type="text"]') as HTMLInputElement
    summary.value = 'CG amber after fuel'
    summary.dispatchEvent(new Event('input', { bubbles: true }))
    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'Loaded 100 kg pilot mass, contact pilot@example.com'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    // fake-indexeddb schedules onsuccess via macrotasks; pump real timers
    // alongside microtasks until the store enqueue resolves.
    for (let i = 0; i < 6; i += 1) {
      await flushPromises()
      await new Promise((r) => setTimeout(r, 0))
    }

    const store = useIncidentReportStore()
    expect(store.queuedCount).toBe(1)
    expect(store.reports[0]?.redactedDescription).toContain('[REDACTED-EMAIL]')
  })
})
