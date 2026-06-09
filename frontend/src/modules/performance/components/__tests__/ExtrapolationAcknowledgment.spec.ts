// @UT-PF-VIEW-002@ (FROM: @IMP-PF-VIEW-002@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ExtrapolationAcknowledgment from '../ExtrapolationAcknowledgment.vue'

describe('ExtrapolationAcknowledgment', () => {
  it('presents the Pilot-in-Command acknowledgment as an alert', () => {
    const wrapper = mount(ExtrapolationAcknowledgment)
    expect(wrapper.get('[role="alert"]')).toBeTruthy()
    expect(wrapper.text()).toMatch(/Pilot-in-Command acknowledges extrapolated data/i)
    expect(wrapper.text()).toMatch(/\+20%/)
  })

  it('emits "acknowledge" when the pilot confirms', async () => {
    const wrapper = mount(ExtrapolationAcknowledgment)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('acknowledge')).toHaveLength(1)
  })
})
