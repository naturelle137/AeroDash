import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InputGroupCard from '../InputGroupCard.vue'

describe('InputGroupCard', () => {
  // ─── Title branch ───────────────────────────────────────────────────────

  it('renders the title heading when title prop is provided', () => {
    const wrapper = mount(InputGroupCard, {
      props: { title: 'Passengers' },
    })

    const heading = wrapper.find('h3.input-group-card__title')
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toBe('Passengers')
  })

  it('sets aria-label on the section element to the provided title', () => {
    const wrapper = mount(InputGroupCard, {
      props: { title: 'Fuel' },
    })

    expect(wrapper.find('section').attributes('aria-label')).toBe('Fuel')
  })

  it('omits the title heading when no title prop is given', () => {
    const wrapper = mount(InputGroupCard)

    expect(wrapper.find('h3').exists()).toBe(false)
  })

  it('sets aria-label to undefined on the section when no title prop is given', () => {
    const wrapper = mount(InputGroupCard)

    expect(wrapper.find('section').attributes('aria-label')).toBeUndefined()
  })

  // ─── Slot content ───────────────────────────────────────────────────────

  it('renders slotted content inside the card body', () => {
    const wrapper = mount(InputGroupCard, {
      slots: { default: '<input class="slot-input" />' },
    })

    expect(wrapper.find('.slot-input').exists()).toBe(true)
  })

  it('renders multiple slot children', () => {
    const wrapper = mount(InputGroupCard, {
      slots: { default: '<span id="a">A</span><span id="b">B</span>' },
    })

    expect(wrapper.find('#a').exists()).toBe(true)
    expect(wrapper.find('#b').exists()).toBe(true)
  })

  // ─── Structure ──────────────────────────────────────────────────────────

  it('wraps content in a section with role group', () => {
    const wrapper = mount(InputGroupCard)

    const section = wrapper.find('section.input-group-card')
    expect(section.exists()).toBe(true)
    expect(section.attributes('role')).toBe('group')
  })
})
