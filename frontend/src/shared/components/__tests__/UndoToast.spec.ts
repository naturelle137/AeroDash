/**
 * Unit tests for UndoToast.vue — the transient undo affordance for recoverable
 * destructive actions (delete aircraft, reset payload).
 *
 * @see frontend/src/shared/components/UndoToast.vue
 */

// @UT-UI-SHARED-002@ (FROM: @IMP-UI-SHARED-005@, @IMP-UI-SHARED-006@)

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UndoToast from '../UndoToast.vue'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function mountToast(props: Record<string, unknown> = {}) {
  return mount(UndoToast, {
    attachTo: document.body,
    props: {
      open: true,
      message: 'Deleted "D-EBPN"',
      ...props,
    },
  })
}

describe('UndoToast', () => {
  it('does not render when closed', () => {
    mountToast({ open: false })
    expect(document.querySelector('.undo-toast')).toBeNull()
  })

  it('renders the message and an undo action when open', () => {
    mountToast()
    expect(document.querySelector('.undo-toast')?.textContent).toContain('Deleted "D-EBPN"')
    expect(document.querySelector('.undo-toast__action')?.textContent).toContain('Undo')
  })

  it('uses a polite live region so screen readers announce it', () => {
    mountToast()
    const toast = document.querySelector('.undo-toast')!
    expect(toast.getAttribute('role')).toBe('status')
    expect(toast.getAttribute('aria-live')).toBe('polite')
  })

  it('emits undo when the undo action is clicked', async () => {
    const wrapper = mountToast()
    ;(document.querySelector('.undo-toast__action') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('undo')).toHaveLength(1)
  })

  it('emits dismiss when the dismiss control is clicked', async () => {
    const wrapper = mountToast()
    ;(document.querySelector('.undo-toast__dismiss') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('auto-emits dismiss after the duration window elapses', async () => {
    const wrapper = mountToast({ duration: 5000 })
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    vi.advanceTimersByTime(5000)
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('does not auto-dismiss before the window elapses', () => {
    const wrapper = mountToast({ duration: 8000 })
    vi.advanceTimersByTime(7999)
    expect(wrapper.emitted('dismiss')).toBeUndefined()
  })

  it('cancels the auto-dismiss timer once the pilot taps undo', async () => {
    const wrapper = mountToast({ duration: 5000 })
    ;(document.querySelector('.undo-toast__action') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    vi.advanceTimersByTime(10000)
    // Only the undo fired; the auto-dismiss timer was cleared.
    expect(wrapper.emitted('undo')).toHaveLength(1)
    expect(wrapper.emitted('dismiss')).toBeUndefined()
  })
})
