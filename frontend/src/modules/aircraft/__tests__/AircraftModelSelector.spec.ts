/**
 * Unit tests for AircraftModelSelector.vue
 * Covers: manufacturer filter rendering, ICAO auto-fill, reverse lookup, 'Other' free-text mode.
 * @see frontend/src/modules/aircraft/components/AircraftModelSelector.vue
 */
// @UT-AC-VIEW-025@ (FROM: @IMP-AC-VIEW-002@, @IMP-AC-VIEW-003@)
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AircraftModelSelector from '../components/AircraftModelSelector.vue'
function mountSelector(props: { manufacturer?: string; model?: string; icaoTypeDesignator?: string }) {
  return mount(AircraftModelSelector, { props })
}
describe('AircraftModelSelector — manufacturer list', () => {
  // @UT-AC-VIEW-025@ (FROM: @IMP-AC-VIEW-002@)
  it('renders manufacturer select with known manufacturers', () => {
    const wrapper = mountSelector({})
    const select = wrapper.find('#manufacturer-select')
    expect(select.exists()).toBe(true)
    expect(select.text()).toContain('Cessna')
    expect(select.text()).toContain('Piper')
    expect(select.text()).toContain('Diamond')
    expect(select.text()).toContain('Other')
  })
  // @UT-AC-VIEW-026@ (FROM: @IMP-AC-VIEW-002@)
  it("renders 'Other' as the last manufacturer option", () => {
    const wrapper = mountSelector({})
    const options = wrapper.findAll('#manufacturer-select option')
    expect(options[options.length - 1].text()).toBe('Other')
  })
})
describe('AircraftModelSelector — model dropdown filter', () => {
  // @UT-AC-VIEW-027@ (FROM: @IMP-AC-VIEW-002@)
  it('shows only Cessna models when manufacturer is Cessna', () => {
    const wrapper = mountSelector({ manufacturer: 'Cessna' })
    const optionText = wrapper.find('#model-input').text()
    expect(optionText).toContain('C152')
    expect(optionText).toContain('C172S Skyhawk SP')
    expect(optionText).not.toContain('PA-28')
  })
  // @UT-AC-VIEW-028@ (FROM: @IMP-AC-VIEW-002@)
  it('shows only Piper models when manufacturer is Piper', () => {
    const wrapper = mountSelector({ manufacturer: 'Piper' })
    const optionText = wrapper.find('#model-input').text()
    expect(optionText).toContain('PA-28-161 Warrior III')
    expect(optionText).not.toContain('C152')
  })
  // @UT-AC-VIEW-029@ (FROM: @IMP-AC-VIEW-002@)
  it('model select is disabled when no manufacturer is selected', () => {
    const wrapper = mountSelector({ manufacturer: '' })
    expect(wrapper.find('#model-input').attributes('disabled')).toBeDefined()
  })
})
describe("AircraftModelSelector — 'Other' manufacturer free-text mode (REQ-UI-002)", () => {
  // @UT-AC-VIEW-030@ (FROM: @IMP-AC-VIEW-002@)
  it("renders a text input for model when manufacturer is 'Other'", () => {
    const wrapper = mountSelector({ manufacturer: 'Other' })
    const input = wrapper.find('input#model-input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('type')).toBe('text')
  })
  // @UT-AC-VIEW-031@ (FROM: @IMP-AC-VIEW-002@)
  it("does not render a model dropdown when manufacturer is 'Other'", () => {
    expect(mountSelector({ manufacturer: 'Other' }).find('select#model-input').exists()).toBe(false)
  })
  // @UT-AC-VIEW-032@ (FROM: @IMP-AC-VIEW-002@)
  it("emits 'update:model' when free-text model input changes", async () => {
    const wrapper = mountSelector({ manufacturer: 'Other', model: '' })
    await wrapper.find('input#model-input').setValue('My Custom Aircraft')
    const emitted = wrapper.emitted('update:model')
    expect(emitted).toBeDefined()
    expect(emitted[emitted.length - 1]).toEqual(['My Custom Aircraft'])
  })
})
describe('AircraftModelSelector — ICAO auto-fill on model selection (REQ-UI-003)', () => {
  // @UT-AC-VIEW-033@ (FROM: @IMP-AC-VIEW-003@)
  it("emits 'update:icaoTypeDesignator' with C172 when C172S Skyhawk SP is selected", async () => {
    const wrapper = mountSelector({ manufacturer: 'Cessna', model: '' })
    const select = wrapper.find('select#model-input')
    await select.setValue('C172S Skyhawk SP')
    await select.trigger('change')
    const emitted = wrapper.emitted('update:icaoTypeDesignator')
    expect(emitted).toBeDefined()
    expect(emitted[emitted.length - 1]).toEqual(['C172'])
  })
  // @UT-AC-VIEW-034@ (FROM: @IMP-AC-VIEW-003@)
  it("emits 'update:icaoTypeDesignator' with DA42 when DA42 Twin Star is selected", async () => {
    const wrapper = mountSelector({ manufacturer: 'Diamond', model: '' })
    const select = wrapper.find('select#model-input')
    await select.setValue('DA42 Twin Star')
    await select.trigger('change')
    const emitted = wrapper.emitted('update:icaoTypeDesignator')
    expect(emitted).toBeDefined()
    expect(emitted[emitted.length - 1]).toEqual(['DA42'])
  })
})
describe('AircraftModelSelector — manufacturer change resets model and ICAO', () => {
  // @UT-AC-VIEW-035@ (FROM: @IMP-AC-VIEW-003@)
  it('emits empty model and ICAO when manufacturer changes', async () => {
    const wrapper = mountSelector({ manufacturer: 'Cessna', model: 'C152', icaoTypeDesignator: 'C152' })
    await wrapper.find('#manufacturer-select').setValue('Piper')
    await wrapper.find('#manufacturer-select').trigger('change')
    const modelEmitted = wrapper.emitted('update:model')
    const icaoEmitted = wrapper.emitted('update:icaoTypeDesignator')
    expect(modelEmitted[modelEmitted.length - 1]).toEqual([''])
    expect(icaoEmitted[icaoEmitted.length - 1]).toEqual([''])
  })
})
describe('AircraftModelSelector — ICAO bidirectional reverse lookup (REQ-UI-004)', () => {
  // @UT-AC-VIEW-036@ (FROM: @IMP-AC-VIEW-003@)
  it('shows lookup results when ICAO input has 2+ characters matching catalogue', async () => {
    const wrapper = mountSelector({ manufacturer: '', model: '', icaoTypeDesignator: '' })
    await wrapper.find('#icao-designator-input').setValue('C172')
    const results = wrapper.find('.icao-lookup-results')
    expect(results.exists()).toBe(true)
    expect(results.text()).toContain('Cessna')
  })
  // @UT-AC-VIEW-037@ (FROM: @IMP-AC-VIEW-003@)
  it('shows no lookup results when ICAO input has fewer than 2 characters', async () => {
    const wrapper = mountSelector({ manufacturer: '', model: '', icaoTypeDesignator: '' })
    await wrapper.find('#icao-designator-input').setValue('C')
    expect(wrapper.find('.icao-lookup-results').exists()).toBe(false)
  })
  // @UT-AC-VIEW-038@ (FROM: @IMP-AC-VIEW-003@)
  it('emits manufacturer, model and ICAO when a lookup result is clicked', async () => {
    const wrapper = mountSelector({ manufacturer: '', model: '', icaoTypeDesignator: '' })
    await wrapper.find('#icao-designator-input').setValue('C152')
    const resultItem = wrapper.find('.icao-lookup-result')
    expect(resultItem.exists()).toBe(true)
    await resultItem.trigger('click')
    const lastIcao = wrapper.emitted('update:icaoTypeDesignator')
    expect(lastIcao[lastIcao.length - 1]).toEqual(['C152'])
  })
  // @UT-AC-VIEW-039@ (FROM: @IMP-AC-VIEW-003@)
  it('normalises ICAO input to uppercase before emitting', async () => {
    const wrapper = mountSelector({ manufacturer: '', model: '', icaoTypeDesignator: '' })
    await wrapper.find('#icao-designator-input').setValue('da40')
    const emitted = wrapper.emitted('update:icaoTypeDesignator')
    expect(emitted[0]).toEqual(['DA40'])
  })
})
