// @UT-PF-VIEW-001@ (FROM: @IMP-PF-VIEW-001@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EstimatedMarker from '../EstimatedMarker.vue'

describe('EstimatedMarker', () => {
  it('renders the CAA SSL 07 estimation marker with a text label (not colour-only)', () => {
    const wrapper = mount(EstimatedMarker)
    expect(wrapper.text()).toContain('[ESTIMATED]')
    expect(wrapper.text()).toContain('(CAA SSL 07)')
  })

  it('exposes an accessible note label', () => {
    const wrapper = mount(EstimatedMarker)
    const marker = wrapper.get('[role="note"]')
    expect(marker.attributes('aria-label')).toMatch(/CAA SSL 07/i)
  })
})
