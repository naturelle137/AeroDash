/**
 * Unit tests for ActionChoiceDialog.vue — the accessible multi-action modal
 * used for the wizard exit prompt and post-save chooser.
 *
 * @see frontend/src/shared/components/ActionChoiceDialog.vue
 */

// @UT-UI-SHARED-021@ (FROM: @IMP-UI-SHARED-018@)

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionChoiceDialog, { type DialogAction } from '../ActionChoiceDialog.vue'

// Teleport renders to document.body — clean it between tests.
afterEach(() => {
  document.body.innerHTML = ''
})

const DEFAULT_ACTIONS: DialogAction[] = [
  { id: 'keep', label: 'Keep editing', variant: 'secondary', default: true },
  { id: 'save', label: 'Save draft', variant: 'primary' },
  { id: 'discard', label: 'Discard', variant: 'danger' },
]

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(ActionChoiceDialog, {
    attachTo: document.body,
    props: {
      open: true,
      title: 'Leave the wizard?',
      message: 'You have unsaved changes.',
      actions: DEFAULT_ACTIONS,
      ...props,
    },
  })
}

describe('ActionChoiceDialog', () => {
  it('renders nothing when closed', () => {
    mountDialog({ open: false })
    expect(document.querySelector('.action-choice')).toBeNull()
  })

  it('renders the title, message and one button per action', () => {
    mountDialog()
    expect(document.querySelector('.action-choice__title')?.textContent).toContain(
      'Leave the wizard?',
    )
    expect(document.querySelector('.action-choice__message')?.textContent).toContain(
      'unsaved changes',
    )
    const btns = document.querySelectorAll('.action-choice__btn')
    expect(btns).toHaveLength(3)
    expect([...btns].map((b) => b.textContent?.trim())).toEqual([
      'Keep editing',
      'Save draft',
      'Discard',
    ])
  })

  it('exposes an accessible modal dialog labelled by its title and message', () => {
    mountDialog()
    const dialog = document.querySelector('.action-choice')!
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelledby = dialog.getAttribute('aria-labelledby')
    const describedby = dialog.getAttribute('aria-describedby')
    expect(document.getElementById(labelledby!)?.classList.contains('action-choice__title')).toBe(
      true,
    )
    expect(
      document.getElementById(describedby!)?.classList.contains('action-choice__message'),
    ).toBe(true)
  })

  it('applies the requested variant class to each action button', () => {
    mountDialog()
    expect(document.querySelector('.action-choice__btn--secondary')?.textContent).toContain(
      'Keep editing',
    )
    expect(document.querySelector('.action-choice__btn--primary')?.textContent).toContain(
      'Save draft',
    )
    expect(document.querySelector('.action-choice__btn--danger')?.textContent).toContain('Discard')
  })

  it('emits choose with the action id when a button is clicked', async () => {
    const wrapper = mountDialog()
    const discardBtn = document.querySelector('.action-choice__btn--danger') as HTMLButtonElement
    discardBtn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('choose')).toEqual([['discard']])
  })

  it('emits dismiss (never choose) when the backdrop is tapped', async () => {
    const wrapper = mountDialog()
    const backdrop = document.querySelector('.action-choice__backdrop') as HTMLElement
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('dismiss')).toBeTruthy()
    expect(wrapper.emitted('choose')).toBeFalsy()
  })

  it('emits dismiss when Escape is pressed', async () => {
    const wrapper = mountDialog()
    const dialog = document.querySelector('.action-choice') as HTMLElement
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('dismiss')).toBeTruthy()
  })

  it('focuses the action flagged default on open', async () => {
    const wrapper = mountDialog()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect((document.activeElement as HTMLElement)?.textContent).toContain('Keep editing')
  })

  it('focuses the first action when none is flagged default', async () => {
    const actions: DialogAction[] = [
      { id: 'verify', label: 'Verify now', variant: 'primary' },
      { id: 'fly', label: 'Start flight prep', variant: 'secondary' },
    ]
    const wrapper = mountDialog({ actions })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect((document.activeElement as HTMLElement)?.textContent).toContain('Verify now')
  })
})
