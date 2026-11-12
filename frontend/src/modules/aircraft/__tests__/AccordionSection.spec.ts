/**
 * Unit tests for AccordionSection.vue
 * Covers: open/closed rendering, toggle emission, title + summary display,
 * aria attributes for accessibility.
 *
 * @see frontend/src/modules/aircraft/components/AccordionSection.vue
 */


import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AccordionSection from '../components/AccordionSection.vue'

function mountAccordion(open: boolean, slot = '<p class="child-content">Body</p>') {
  return mount(AccordionSection, {
    props: { title: 'My Section', summary: '3 items', modelValue: open, sectionId: 'test' },
    slots: { default: slot },
  })
}

describe('AccordionSection — rendering', () => {
  it('renders the title and summary', () => {
    const wrapper = mountAccordion(false)
    expect(wrapper.text()).toContain('My Section')
    expect(wrapper.text()).toContain('3 items')
  })

  it('hides the body when modelValue is false', () => {
    const wrapper = mountAccordion(false)
    const body = wrapper.find('.accordion-body')
    // v-show still renders the element but with display:none
    expect((body.element as HTMLElement).style.display).toBe('none')
  })

  it('shows the body when modelValue is true', () => {
    const wrapper = mountAccordion(true)
    expect(wrapper.find('.child-content').exists()).toBe(true)
  })

  it('sets aria-expanded to reflect open state', () => {
    const wrapperOpen = mountAccordion(true)
    const wrapperClosed = mountAccordion(false)
    expect(wrapperOpen.find('.accordion-header').attributes('aria-expanded')).toBe('true')
    expect(wrapperClosed.find('.accordion-header').attributes('aria-expanded')).toBe('false')
  })
})

describe('AccordionSection — toggle', () => {
  it('emits update:modelValue with inverted value on header click', async () => {
    const wrapper = mountAccordion(false)
    await wrapper.find('.accordion-header').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('emits false when already open and clicked', async () => {
    const wrapper = mountAccordion(true)
    await wrapper.find('.accordion-header').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
