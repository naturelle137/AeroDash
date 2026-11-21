import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TafView from './TafView.vue'

describe('TAF availability', () => {
  it('validates the code and reports unavailable without changing the entry', async () => {
    const view = mount(TafView)
    const input = view.get('#taf-icao')
    await input.setValue('12')
    await view.get('form').trigger('submit')
    expect(view.get('[role=status]').text()).toContain('four-letter')
    await input.setValue('EDDF')
    await view.get('form').trigger('submit')
    expect(view.get('[role=status]').text()).toContain('unavailable')
    expect((input.element as HTMLInputElement).value).toBe('EDDF')
  })
})
