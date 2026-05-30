/**
 * Unit tests for DisclaimerAcknowledgementModal.vue — the blocking
 * first-launch / baseline-change disclaimer gate (REQ-SYS-016, audit PR-016).
 *
 * @see frontend/src/shared/components/DisclaimerAcknowledgementModal.vue
 */

// @UT-UI-SHARED-004@ (FROM: @IMP-UI-SHARED-008@, @IMP-UI-SHARED-009@)

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DisclaimerAcknowledgementModal from '../DisclaimerAcknowledgementModal.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

function mountModal(props: Record<string, unknown> = {}) {
  return mount(DisclaimerAcknowledgementModal, {
    attachTo: document.body,
    props: {
      open: true,
      ...props,
    },
  })
}

describe('DisclaimerAcknowledgementModal', () => {
  it('does not render anything when closed', () => {
    mountModal({ open: false })
    expect(document.querySelector('[data-testid="disclaimer-gate"]')).toBeNull()
  })

  it('renders the gate with role="alertdialog" and aria-modal="true"', () => {
    mountModal()
    const dialog = document.querySelector('.disclaimer-gate')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('role')).toBe('alertdialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
  })

  it('labels the dialog via aria-labelledby and aria-describedby', () => {
    mountModal()
    const dialog = document.querySelector('.disclaimer-gate')!
    const labelledby = dialog.getAttribute('aria-labelledby')!
    const describedby = dialog.getAttribute('aria-describedby')!
    expect(document.getElementById(labelledby)?.classList.contains('disclaimer-gate__title')).toBe(
      true,
    )
    expect(document.getElementById(describedby)?.classList.contains('disclaimer-gate__body')).toBe(
      true,
    )
  })

  it('renders the Pilot in Command obligations and POH precedence statement', () => {
    mountModal()
    const body = document.querySelector('.disclaimer-gate__body')!.textContent ?? ''
    expect(body).toMatch(/POH/i)
    expect(body).toMatch(/Pilot in Command/i)
    expect(body).toMatch(/not certified/i)
    expect(body).toMatch(/advisory|verify/i)
  })

  it('emits "accept" when the accept button is clicked', async () => {
    const wrapper = mountModal()
    const acceptBtn = document.querySelector<HTMLButtonElement>(
      '[data-testid="disclaimer-gate-accept"]',
    )!
    acceptBtn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('accept')).toHaveLength(1)
  })

  it('renders no cancel / dismiss action — the only control is "Accept"', () => {
    mountModal()
    const buttons = document.querySelectorAll('.disclaimer-gate button')
    expect(buttons.length).toBe(1)
    expect(buttons[0]?.getAttribute('data-testid')).toBe('disclaimer-gate-accept')
  })

  it('shows the storage-unavailable advisory when the prop is set', () => {
    mountModal({ storageUnavailable: true })
    expect(document.querySelector('.disclaimer-gate__storage-advisory')).not.toBeNull()
  })

  it('hides the storage-unavailable advisory by default', () => {
    mountModal()
    expect(document.querySelector('.disclaimer-gate__storage-advisory')).toBeNull()
  })

  it('shows the write-failed advisory after a refused acknowledge() write', () => {
    // PR-review m1 — when the parent's `acknowledge()` returned false the
    // modal must surface a visible alert; a silent failure makes the pilot
    // re-click an unresponsive Accept button.
    mountModal({ writeFailed: true })
    const alert = document.querySelector('[data-testid="disclaimer-gate-write-failed"]')
    expect(alert).not.toBeNull()
    expect(alert?.getAttribute('role')).toBe('alert')
  })

  it('does not double-report when both storageUnavailable and writeFailed are set', () => {
    // The storage-unavailable advisory already covers the load-time
    // unreachable case; the write-failed alert is suppressed when both
    // signals are true to avoid a duplicate message.
    mountModal({ storageUnavailable: true, writeFailed: true })
    expect(
      document.querySelector('[data-testid="disclaimer-gate-write-failed"]'),
    ).toBeNull()
  })

  it('keeps focus inside the modal on Tab (no focusable controls outside the accept button)', async () => {
    mountModal()
    const acceptBtn = document.querySelector<HTMLButtonElement>(
      '[data-testid="disclaimer-gate-accept"]',
    )!
    acceptBtn.focus()
    const dialog = document.querySelector('.disclaimer-gate') as HTMLElement
    // Simulate Tab — handler should re-focus the accept button.
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(acceptBtn)
  })
})
