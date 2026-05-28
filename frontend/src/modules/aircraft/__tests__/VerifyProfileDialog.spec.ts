/**
 * Unit tests for VerifyProfileDialog.vue (REQ-AC-007).
 * The dialog teleports into <body>, so assertions query the document.
 *
 * @see frontend/src/modules/aircraft/components/VerifyProfileDialog.vue
 */

// @UT-AC-VIEW-177@ (FROM: @IMP-AC-VIEW-020@, @IMP-AC-VIEW-021@)

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VerifyProfileDialog from '../components/VerifyProfileDialog.vue'

function setInput(selector: string, value: string): void {
  const el = document.querySelector(selector) as HTMLInputElement | null
  if (!el) throw new Error(`input not found: ${selector}`)
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('VerifyProfileDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  // @UT-AC-VIEW-177@ (FROM: @IMP-AC-VIEW-020@)
  it('renders the sign-off fields and the aircraft registration when open', () => {
    const wrapper = mount(VerifyProfileDialog, {
      props: { open: true, registration: 'D-EBPN' },
    })
    expect(document.querySelector('.verify-dialog')).not.toBeNull()
    expect(document.querySelector('.verify-dialog__title')?.textContent).toContain('D-EBPN')
    expect(document.querySelector('input[aria-label="Verifier initials"]')).not.toBeNull()
    expect(document.querySelector('input[aria-label="POH revision"]')).not.toBeNull()
    expect(document.querySelector('input[aria-label="Verification date"]')).not.toBeNull()
    wrapper.unmount()
  })

  // @UT-AC-VIEW-178@ (FROM: @IMP-AC-VIEW-021@)
  it('keeps the Verify button disabled until initials and POH revision are entered', async () => {
    const wrapper = mount(VerifyProfileDialog, {
      props: { open: true, registration: 'D-EBPN' },
    })
    const confirmBtn = document.querySelector('.verify-dialog__btn--primary') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    setInput('input[aria-label="Verifier initials"]', 'JS')
    await wrapper.vm.$nextTick()
    expect(confirmBtn.disabled).toBe(true)

    setInput('input[aria-label="POH revision"]', 'Rev 7')
    await wrapper.vm.$nextTick()
    expect(confirmBtn.disabled).toBe(false)
    wrapper.unmount()
  })

  // @UT-AC-VIEW-179@ (FROM: @IMP-AC-VIEW-021@)
  it('emits confirm with a trimmed sign-off payload', async () => {
    const wrapper = mount(VerifyProfileDialog, {
      props: { open: true, registration: 'D-EBPN' },
    })
    setInput('input[aria-label="Verifier initials"]', '  JS  ')
    setInput('input[aria-label="POH revision"]', '  Rev 7  ')
    setInput('input[aria-label="Verification date"]', '2026-05-01')
    await wrapper.vm.$nextTick()
    ;(document.querySelector('.verify-dialog__btn--primary') as HTMLButtonElement).click()

    const events = wrapper.emitted('confirm')
    expect(events).toBeTruthy()
    expect(events![0]![0]).toEqual({
      verifiedBy: 'JS',
      pohRevision: 'Rev 7',
      verifiedOn: '2026-05-01',
    })
    wrapper.unmount()
  })

  // @UT-AC-VIEW-180@ (FROM: @IMP-AC-VIEW-021@)
  it('emits cancel when the Cancel button is tapped', async () => {
    const wrapper = mount(VerifyProfileDialog, {
      props: { open: true, registration: 'D-EBPN' },
    })
    ;(document.querySelector('.verify-dialog__btn--cancel') as HTMLButtonElement).click()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
