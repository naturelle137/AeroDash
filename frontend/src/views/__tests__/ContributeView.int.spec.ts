// @IT-SYS-VIEW-001@ (FROM: @IMP-UI-VIEW-003@, @IMP-SYS-CORE-013@)
//
// Integration test: walking the full guided defect/feature flow and
// confirming the prefilled GitHub URL passed to window.open carries the
// expected template + field values.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ContributeView from '../ContributeView.vue'
import {
  BUG_REPORT_TEMPLATE,
  FEATURE_REQUEST_TEMPLATE,
  GITHUB_NEW_ISSUE_URL,
  GITHUB_SECURITY_ADVISORY_URL,
} from '@/core/logic/github-issue-url'

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
}

const openSpy = vi.fn<typeof window.open>()
const originalOpen = window.open

beforeEach(() => {
  setOnline(true)
  openSpy.mockReset()
  Object.defineProperty(window, 'open', { configurable: true, value: openSpy })
})

afterEach(() => {
  Object.defineProperty(window, 'open', { configurable: true, value: originalOpen })
})

function parsedFrom(url: string): { base: string; params: URLSearchParams } {
  const [base = '', q = ''] = url.split('?')
  return { base, params: new URLSearchParams(q) }
}

describe('ContributeView integration — defect happy path', () => {
  it('opens GitHub with the bug template and every entered field prefilled', async () => {
    const w = mount(ContributeView, { attachTo: document.body })
    await w.find('[data-testid="category-defect"]').trigger('click')
    await flushPromises()

    await w.find('[data-testid="bug-title"]').setValue('CG marker drifts after profile swap')
    await w.find('[data-testid="bug-description"]').setValue('CG marker drifts.')
    await w.find('[data-testid="bug-reproduction"]').setValue('1. Open M&B.\n2. Swap profile.')
    await w
      .find('[data-testid="bug-severity"]')
      .setValue('Major: Core functionality impaired, no workaround')
    await w.find('[data-testid="bug-environment"]').setValue('Chrome 130 on iPadOS 17')
    await flushPromises()

    await w.find('[data-testid="bug-submit"]').trigger('submit')
    expect(openSpy).toHaveBeenCalledTimes(1)
    const url = openSpy.mock.calls[0]?.[0] as string
    const { base, params } = parsedFrom(url)
    expect(base).toBe(GITHUB_NEW_ISSUE_URL)
    expect(params.get('template')).toBe(BUG_REPORT_TEMPLATE)
    expect(params.get('title')).toBe('CG marker drifts after profile swap')
    expect(params.get('description')).toBe('CG marker drifts.')
    expect(params.get('reproduction')).toBe('1. Open M&B.\n2. Swap profile.')
    expect(params.get('severity')).toBe('Major: Core functionality impaired, no workaround')
    expect(params.get('environment')).toBe('Chrome 130 on iPadOS 17')
    expect(params.has('hazard_ref')).toBe(false)
  })
})

describe('ContributeView integration — feature happy path', () => {
  it('opens GitHub with the feature template and every entered field prefilled', async () => {
    const w = mount(ContributeView, { attachTo: document.body })
    await w.find('[data-testid="category-feature"]').trigger('click')
    await flushPromises()

    await w.find('[data-testid="feature-title"]').setValue('Wind arrow on runway diagram')
    await w
      .find('[data-testid="feature-problem"]')
      .setValue('As a pilot, I want to see the wind direction on the runway.')
    await w
      .find('[data-testid="feature-solution"]')
      .setValue('Overlay an arrow on the runway diagram.')
    await w.find('[data-testid="feature-dod"]').setValue('- [ ] Arrow visible when wind known')
    await flushPromises()

    await w.find('[data-testid="feature-submit"]').trigger('submit')
    expect(openSpy).toHaveBeenCalledTimes(1)
    const url = openSpy.mock.calls[0]?.[0] as string
    const { params } = parsedFrom(url)
    expect(params.get('template')).toBe(FEATURE_REQUEST_TEMPLATE)
    expect(params.get('title')).toBe('Wind arrow on runway diagram')
    expect(params.get('problem')).toBe(
      'As a pilot, I want to see the wind direction on the runway.',
    )
    expect(params.get('solution')).toBe('Overlay an arrow on the runway diagram.')
    expect(params.get('dod')).toBe('- [ ] Arrow visible when wind known')
  })
})

describe('ContributeView integration — security advisory link', () => {
  it('points at GitHub\'s private advisory form without opening a tab from the app', async () => {
    const w = mount(ContributeView, { attachTo: document.body })
    await w.find('[data-testid="category-security"]').trigger('click')
    const a = w.find('[data-testid="security-open"]')
    expect(a.attributes('href')).toBe(GITHUB_SECURITY_ADVISORY_URL)
    // The security path is a plain anchor — no JS-initiated window.open call.
    expect(openSpy).not.toHaveBeenCalled()
  })
})

describe('ContributeView integration — back navigation', () => {
  it('returns from the defect form to the category screen and resets state', async () => {
    const w = mount(ContributeView)
    await w.find('[data-testid="category-defect"]').trigger('click')
    await w.find('[data-testid="bug-title"]').setValue('something')
    await w.find('[data-testid="bug-back"]').trigger('click')

    expect(w.find('[data-testid="contribute-category-grid"]').exists()).toBe(true)
    // Reopening the defect form starts fresh — back unmounts the form.
    await w.find('[data-testid="category-defect"]').trigger('click')
    const newTitle = w.find('[data-testid="bug-title"]').element as HTMLInputElement
    expect(newTitle.value).toBe('')
  })
})
