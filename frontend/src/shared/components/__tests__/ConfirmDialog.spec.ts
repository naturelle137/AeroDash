/**
 * Unit tests for ConfirmDialog.vue — the in-app replacement for native
 * window.confirm() on destructive cockpit actions.
 *
 * @see frontend/src/shared/components/ConfirmDialog.vue
 */

// @UT-UI-SHARED-001@ (FROM: @IMP-UI-SHARED-003@, @IMP-UI-SHARED-004@)

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from '../ConfirmDialog.vue'

// Teleport renders to document.body — clean it between tests.
afterEach(() => {
  document.body.innerHTML = ''
})

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(ConfirmDialog, {
    attachTo: document.body,
    props: {
      open: true,
      title: 'Delete aircraft profile?',
      message: 'Delete "D-EBPN"? You can undo for a few seconds.',
      ...props,
    },
  })
}

describe('ConfirmDialog', () => {
  it('does not render anything when closed', () => {
    mountDialog({ open: false })
    expect(document.querySelector('.confirm-dialog')).toBeNull()
  })

  it('renders title and message when open', () => {
    mountDialog()
    expect(document.querySelector('.confirm-dialog__title')?.textContent).toContain(
      'Delete aircraft profile?',
    )
    expect(document.querySelector('.confirm-dialog__message')?.textContent).toContain('D-EBPN')
  })

  it('exposes an accessible alertdialog with aria-labelledby and aria-describedby', () => {
    mountDialog()
    const dialog = document.querySelector('.confirm-dialog')!
    expect(dialog.getAttribute('role')).toBe('alertdialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelledby = dialog.getAttribute('aria-labelledby')
    const describedby = dialog.getAttribute('aria-describedby')
    expect(document.getElementById(labelledby!)?.classList.contains('confirm-dialog__title')).toBe(
      true,
    )
    expect(
      document.getElementById(describedby!)?.classList.contains('confirm-dialog__message'),
    ).toBe(true)
  })

  it('emits confirm when the confirm button is clicked', async () => {
    const wrapper = mountDialog()
    const confirmBtn = document.querySelector('.confirm-dialog__btn--danger') as HTMLButtonElement
    confirmBtn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mountDialog()
    const cancelBtn = document.querySelector('.confirm-dialog__btn--cancel') as HTMLButtonElement
    cancelBtn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel when the backdrop is tapped', async () => {
    const wrapper = mountDialog()
    const backdrop = document.querySelector('.confirm-dialog__backdrop') as HTMLElement
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('renders the danger variant by default and a primary variant when requested', () => {
    mountDialog()
    expect(document.querySelector('.confirm-dialog__btn--danger')).not.toBeNull()
    document.body.innerHTML = ''
    mountDialog({ variant: 'primary' })
    expect(document.querySelector('.confirm-dialog__btn--primary')).not.toBeNull()
    expect(document.querySelector('.confirm-dialog__btn--danger')).toBeNull()
  })

  it('uses custom confirm and cancel labels', () => {
    mountDialog({ confirmLabel: 'Delete', cancelLabel: 'Keep' })
    expect(document.querySelector('.confirm-dialog__btn--danger')?.textContent).toContain('Delete')
    expect(document.querySelector('.confirm-dialog__btn--cancel')?.textContent).toContain('Keep')
  })
})
