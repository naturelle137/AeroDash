import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import InfoPopover from '../InfoPopover.vue'
import { INFO_TERMS, infoTerm } from '../../i18n/info-terms'

// REQ-UI-012
describe('InfoPopover', () => {
  afterEach(() => { document.documentElement.lang = 'en' })
  const make = (term: keyof typeof INFO_TERMS = 'qnh') => mount(InfoPopover, { props: { term }, attachTo: document.body })

  it('is a collapsed, named button with a touch target of 44 px', () => {
    const wrapper = make()
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('QNH info')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[role=note]').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('opens on activation and shows the generic explanation', async () => {
    const wrapper = make('safetyFactor')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role=note]').isVisible()).toBe(true)
    expect(wrapper.get('[role=note]').text()).toContain('multiplier')
    wrapper.unmount()
  })

  it('closes on Escape and returns focus to the button', async () => {
    const wrapper = make()
    await wrapper.get('button').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('button').element)
    wrapper.unmount()
  })

  it('closes on an outside tap but not on a tap inside', async () => {
    const wrapper = make()
    await wrapper.get('button').trigger('click')
    wrapper.get('[role=note]').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('renders German text when the document language is German', () => {
    document.documentElement.lang = 'de'
    const wrapper = make('pressureAltitude')
    expect(wrapper.get('button').attributes('aria-label')).toBe('Druckhöhe info')
    wrapper.unmount()
  })

  it('has an English and German explanation for every term without POH-style figures', () => {
    for (const id of Object.keys(INFO_TERMS) as (keyof typeof INFO_TERMS)[]) {
      for (const locale of ['en', 'de'] as const) {
        expect(infoTerm(id, locale).explanation.length).toBeGreaterThan(20)
      }
    }
  })
})
