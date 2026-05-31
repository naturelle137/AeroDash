import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DisclaimerAcknowledgementModal from '../DisclaimerAcknowledgementModal.vue'

const wrappers: Array<ReturnType<typeof mount>> = []

afterEach(() => {
  // Unmount so onBeforeUnmount runs and the document-level keydown listener is
  // detached; otherwise a leaked trap from one test fires in the next.
  while (wrappers.length > 0) wrappers.pop()?.unmount()
  document.body.innerHTML = ''
})

function mountModal(props: Record<string, unknown> = {}) {
  const wrapper = mount(DisclaimerAcknowledgementModal, {
    attachTo: document.body,
    props: {
      open: true,
      ...props,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('DisclaimerAcknowledgementModal', () => {
  // @UT-UI-SHARED-004@ (FROM: @IMP-UI-SHARED-008@)
  it('does not render anything when closed', () => {
    mountModal({ open: false })
    expect(document.querySelector('[data-testid="disclaimer-gate"]')).toBeNull()
  })

  // @UT-UI-SHARED-005@ (FROM: @IMP-UI-SHARED-008@)
  it('renders the gate with role="alertdialog" and aria-modal="true"', () => {
    mountModal()
    const dialog = document.querySelector('.disclaimer-gate')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('role')).toBe('alertdialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
  })

  // @UT-UI-SHARED-006@ (FROM: @IMP-UI-SHARED-008@)
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

  // @UT-UI-SHARED-007@ (FROM: @IMP-UI-SHARED-008@)
  it('renders the Pilot in Command obligations and POH precedence statement', () => {
    mountModal()
    const body = document.querySelector('.disclaimer-gate__body')!.textContent ?? ''
    expect(body).toMatch(/POH/i)
    expect(body).toMatch(/Pilot in Command/i)
    expect(body).toMatch(/not certified/i)
    expect(body).toMatch(/advisory|verify/i)
  })

  // @UT-UI-SHARED-008@ (FROM: @IMP-UI-SHARED-008@)
  it('emits "accept" when the accept button is clicked', async () => {
    const wrapper = mountModal()
    const acceptBtn = document.querySelector<HTMLButtonElement>(
      '[data-testid="disclaimer-gate-accept"]',
    )!
    acceptBtn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('accept')).toHaveLength(1)
  })

  // @UT-UI-SHARED-009@ (FROM: @IMP-UI-SHARED-008@)
  it('renders no cancel / dismiss action — the only control is "Accept"', () => {
    mountModal()
    const buttons = document.querySelectorAll('.disclaimer-gate button')
    expect(buttons.length).toBe(1)
    expect(buttons[0]?.getAttribute('data-testid')).toBe('disclaimer-gate-accept')
  })

  // @UT-UI-SHARED-010@ (FROM: @IMP-UI-SHARED-008@)
  it('shows the storage-unavailable advisory when the prop is set', () => {
    mountModal({ storageUnavailable: true })
    expect(document.querySelector('.disclaimer-gate__storage-advisory')).not.toBeNull()
  })

  // @UT-UI-SHARED-011@ (FROM: @IMP-UI-SHARED-008@)
  it('hides the storage-unavailable advisory by default', () => {
    mountModal()
    expect(document.querySelector('.disclaimer-gate__storage-advisory')).toBeNull()
  })

  // @UT-UI-SHARED-012@ (FROM: @IMP-UI-SHARED-008@)
  it('shows the write-failed advisory after a refused acknowledge() write', () => {
    mountModal({ writeFailed: true })
    const alert = document.querySelector('[data-testid="disclaimer-gate-write-failed"]')
    expect(alert).not.toBeNull()
    expect(alert?.getAttribute('role')).toBe('alert')
  })

  // @UT-UI-SHARED-013@ (FROM: @IMP-UI-SHARED-008@)
  it('prefers the specific write-failed advisory when both flags are set', () => {
    // M3 precedence: write-failed is the more actionable diagnosis ("clear
    // quota" / "refused write") and must win over the generic
    // storage-unavailable advisory ("switch browser") so the pilot is pointed
    // at the right remediation.
    mountModal({ storageUnavailable: true, writeFailed: true })
    expect(
      document.querySelector('[data-testid="disclaimer-gate-write-failed"]'),
    ).not.toBeNull()
    const advisories = document.querySelectorAll('.disclaimer-gate__storage-advisory')
    expect(advisories.length).toBe(1)
  })

  // @UT-UI-SHARED-014@ (FROM: @IMP-UI-SHARED-008@)
  it('confines Tab focus to the dialog: pulls escaped focus back and wraps at the boundaries', () => {
    mountModal()
    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.disclaimer-gate a[href], .disclaimer-gate button',
      ),
    )
    expect(focusables.length).toBeGreaterThanOrEqual(2)
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!

    // Focus escaped the dialog (e.g. `inert` unsupported) → next Tab pulls it
    // back to the first control.
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(document.activeElement).toBe(first)

    // Tab on the last control wraps to the first.
    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(document.activeElement).toBe(first)

    // Shift+Tab on the first control wraps to the last.
    first.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    expect(document.activeElement).toBe(last)
  })

  // @UT-UI-SHARED-015@ (FROM: @IMP-UI-SHARED-008@)
  it('allows Tab between controls inside the dialog so the links stay reachable', () => {
    mountModal()
    const link = document.querySelector<HTMLAnchorElement>('.disclaimer-gate__legal a')!
    link.focus()
    expect(document.activeElement).toBe(link)

    // A non-boundary Tab is not intercepted; the DISCLAIMER / LICENSE links
    // remain keyboard-reachable (WCAG 2.1.1) rather than being pinned to Accept.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(document.activeElement).toBe(link)
  })

  // @UT-UI-SHARED-016@ (FROM: @IMP-UI-SHARED-008@)
  it('does not emit accept or dismiss on Escape', () => {
    const wrapper = mountModal()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('accept')).toBeUndefined()
    expect(document.querySelector('[data-testid="disclaimer-gate"]')).not.toBeNull()
  })
})
