import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import InfoPopover from '../InfoPopover.vue'

describe('InfoPopover', () => {
  it('offers a named keyboard-operable disclosure with English and German text', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'CG', en: 'Balance point', de: 'Schwerpunkt' }, attachTo: document.body })
    const disclosure = wrapper.get('details')
    expect(wrapper.get('summary').attributes('aria-label')).toBe('Information: CG')
    expect(disclosure.attributes('open')).toBeUndefined()
    await wrapper.get('summary').trigger('click')
    expect(disclosure.element.open).toBe(true)
    expect(wrapper.get('[lang="en"]').text()).toBe('Balance point')
    expect(wrapper.get('[lang="de"]').text()).toBe('Schwerpunkt')
    wrapper.unmount()
  })
})
