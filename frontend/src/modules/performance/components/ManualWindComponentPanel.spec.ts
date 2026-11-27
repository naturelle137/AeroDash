import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWeatherInputsStore } from '@/modules/weather/stores/weather-inputs.store'
import ManualWindComponentPanel from './ManualWindComponentPanel.vue'

async function enter(view: ReturnType<typeof mount>, heading: string, direction: string, speed: string) {
  await view.get('#wind-runway-heading').setValue(heading)
  await view.get('#wind-direction').setValue(direction)
  await view.get('#wind-speed').setValue(speed)
}
const result = (view: ReturnType<typeof mount>) => view.get('[aria-label="Wind components"]').text()

beforeEach(() => setActivePinia(createPinia()))

describe('ManualWindComponentPanel', () => {
  it('uses the shared Weather wind until a wind is entered here', async () => {
    const weather = useWeatherInputsStore()
    weather.copyRetrieved('wind', { wind: { direction: '330', speed: '20', unit: 'kt' } }, 'METAR EDDF')
    const view = mount(ManualWindComponentPanel)
    await view.get('#wind-runway-heading').setValue('270')
    expect(result(view)).toContain('Headwind10.0 kt')
    expect(view.text()).toContain('retrieved, unverified')
    await view.get('#wind-speed').setValue('10')
    await view.get('#wind-direction').setValue('270')
    expect(result(view)).toContain('Headwind10.0 kt')
    expect(view.text()).toContain('overrides the Weather wind')
    await view.get('#wind-speed').setValue('0')
    expect(result(view)).toContain('Calm wind')
  })

  it('shows headwind and crosswind side with units', async () => {
    const view = mount(ManualWindComponentPanel)
    await enter(view, '270', '330', '20')
    expect(result(view)).toContain('Headwind10.0 kt')
    expect(result(view)).toContain('Crosswind17.3 kt from the right')
  })
  it('labels a tailwind and left crosswind', async () => {
    const view = mount(ManualWindComponentPanel)
    await view.get('#wind-speed-unit').setValue('km/h')
    await enter(view, '270', '150', '20')
    expect(result(view)).toContain('Tailwind10.0 km/h')
    expect(result(view)).toContain('17.3 km/h from the left')
  })
  it('clears the result synchronously when an input becomes invalid', async () => {
    const view = mount(ManualWindComponentPanel)
    await enter(view, '90', '90', '10')
    expect(result(view)).toContain('Headwind10.0 kt')
    await view.get('#wind-direction').setValue('VRB')
    expect(result(view)).not.toContain('Headwind')
    expect(view.get('#wind-direction').attributes('aria-invalid')).toBe('true')
    expect(view.get('#wind-windDirection-error').text()).toContain('variable direction')
  })
  it('states provenance and makes no verdict', () => {
    const view = mount(ManualWindComponentPanel)
    expect(view.text()).toContain('User-entered')
    expect(view.text()).toContain('advisory')
    expect(result(view)).toContain('Enter runway heading')
  })
})
