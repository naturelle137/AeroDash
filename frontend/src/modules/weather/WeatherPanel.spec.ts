import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WeatherPanel from './WeatherPanel.vue'

describe('WeatherPanel', () => {
  it('validates the station and reports unavailable without replacing the input', async () => {
    const view = mount(WeatherPanel)
    const input = view.get('#weather-icao')
    await input.setValue('123')
    await view.get('form').trigger('submit')
    expect(view.get('[role=status]').text()).toContain('four-letter')
    await input.setValue('EDDF')
    await view.get('form').trigger('submit')
    expect(view.get('[role=status]').text()).toContain('unavailable')
    expect((input.element as HTMLInputElement).value).toBe('EDDF')
  })
})
