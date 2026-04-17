/**
 * Unit tests for AircraftModelSelector.vue
 *
 * Covers: manufacturer filter rendering, ICAO auto-fill on model selection,
 * reverse lookup from ICAO, 'Other' manufacturer free-text mode.
 *
 * @see frontend/src/modules/aircraft/components/AircraftModelSelector.vue
 */

// @UT-AC-VIEW-025@ (FROM: @IMP-AC-VIEW-002@, @IMP-AC-VIEW-003@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AircraftModelSelector from '../components/AircraftModelSelector.vue'

function mountSelector(props: {
  manufacturer?: string
  model?: string
  icaoTypeDesignator?: string
}) {
  return mount(AircraftModelSelector, { props })
}

describe('AircraftModelSelector — manufacturer list', () => {
  // @UT-AC-VIEW-025@ (FROM: @IMP-AC-VIEW-002@)
  it('renders manufacturer select with known manufacturers', () => {
    const wrapper = mountSelector({})
    const select = wrapper.find('#manufacturer-select')
    expect(select.exists()).toBe(true)
    const optionText = select.text()
    expect(optionText).toContain('Cessna')
    expect(optionText).toContain('Piper')
    expect(optionText).toContain('Diamond')
    expect(optionText).toContain('Other')
  })

  // @UT-AC-VIEW-026@ (FROM: @IMP-AC-VIEW-002@)
  it("renders 'Other' as the last manufacturer option", () => {
    const wrapper = mountSelector({})
    const options = wrapper.findAll('#manufacturer-select option')
    const textValues = options.map((o) => o.text())
    expect(textValues[textValues.length - 1]).toBe('Other')
  })
})

describe('AircraftModelSelector — model dropdown filter', () => {
  // @UT-AC-VIEW-027@ (FROM: @IMP-AC-VIEW-002@)
  it('shows only Cessna models when manufacturer is Cessna', () => {
    const wrapper = mountSelector({ manufacturer: 'Cessna' })
    const select = wrapper.find('#model-input')
    expect(select.exists()).toBe(true)
    const optionText = select.text()
    expect(optionText).toContain('C152')
    expect(optionText).toContain('C172S Skyhawk SP')
    expect(optionText).not.toContain('PA-28')
  })

  // @UT-AC-VIEW-028@ (FROM: @IMP-AC-VIEW-002@)
  it('shows only Piper models when manufacturer is Piper', () => {
    const wrapper = mountSelector({ manufacturer: 'Piper' })
    const select = wrapper.find('#model-input')
    const optionText = select.text()
    expect(optionText).toContain('PA-28-161 Warrior III')
    expect(optionText).not.toContain('C152')
  })

  // @UT-AC-VIEW-029@ (FROM: @IMP-AC-VIEW-002@)
  it('model select is disabled when no manufacturer is selected', () => {
    const wrapper = mountSelector({ manufacturer: '' })
    const select = wrapper.find('#model-input')
    expect(select.attributes('disabled')).toBeDefined()
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
    const wrapper = mountSelector({ manufacturer: 'Other' })
    const select = wrapper.find('select#model-input')
    expect(select.exists()).toBe(false)
  })

  // @UT-AC-VIEW-032@ (FROM: @IMP-AC-VIEW-002@)
  it("emits 'update:model' when free-text model input changes", async () => {
    const wrapper = mountSelector({ manufacturer: 'Other', model: '' })
    const input = wrapper.find('input#model-input')
    await input.setValue('My Custom Aircraft')
    const emitted = wrapper.emitted('update:model')
    expect(emitted).toBeDefined()
    expect(emitted![emitted!.length - 1]).toEqual(['My Custom Aircraft'])
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
    expect(emitted![emitted!.length - 1]).toEqual(['C172'])
  })

  // @UT-AC-VIEW-034@ (FROM: @IMP-AC-VIEW-003@)
  it("emits 'update:icaoTypeDesignator' with DA42 when DA42 Twin Star is selected", async () => {
    const wrapper = mountSelector({ manufacturer: 'Diamond', model: '' })
    const select = wrapper.find('select#model-input')
    await select.setValue('DA42 Twin Star')
    await select.trigger('change')
    const emitted = wrapper.emitted('update:icaoTypeDesignator')
    expect(emitted).toBeDefined()
    expect(emitted![emitted!.length - 1]).toEqual(['DA42'])
  })
})

describe('AircraftModelSelector — manufacturer change resets model and ICAO', () => {
  // @UT-AC-VIEW-035@ (FROM: @IMP-AC-VIEW-003@)
  it('emits empty model and ICAO when manufacturer changes', async () => {
    const wrapper = mountSelector({
      manufacturer: 'Cessna',
      model: 'C152',
      icaoTypeDesignator: 'C152',
    })
    const select = wrapper.find('#manufacturer-select')
    await select.setValue('Piper')
    await select.trigger('change')
    const modelEmitted = wrapper.emitted('update:model')
    const icaoEmitted = wrapper.emitted('update:icaoTypeDesignator')
    expect(modelEmitted).toBeDefined()
    expect(modelEmitted![modelEmitted!.length - 1]).toEqual([''])
    expect(icaoEmitted).toBeDefined()
    expect(icaoEmitted![icaoEmitted!.length - 1]).toEqual([''])
  })
})

describe('AircraftModelSelector — ICAO bidirectional reverse lookup (REQ-UI-004)', () => {
  // @UT-AC-VIEW-036@ (FROM: @IMP-AC-VIEW-003@)
  it('shows lookup results when ICAO input has 2+ characters matching catalogue', async () => {
    const wrapper = mountSelector({ manufacturer: '', model: '', icaoTypeDesignator: '' })
    const icaoInput = wrapper.find('#icao-designator-input')
    await icaoInput.setValue('PA28')
    const results = wrapper.find('.icao-lookup-results')
    expect(results.exists()).toBe(true)
    expect(results.text()).toContain('Piper')
  })

  // @UT-AC-VIEW-037@ (FROM: @IMP-AC-VIEW-003@)
  it('shows no lookup results when ICAO input has fewer than 2 characters', async () => {
    const wrapper = mountSelector({ manufacturer: '', model: '', icaoTypeDesignator: '' })
    const icaoInput = wrapper.find('#icao-designator-input')
    await icaoInput.setValue('C')
    const results = wrapper.find('.icao-lookup-results')
    expect(results.exists()).toBe(false)
  })

  // @UT-AC-VIEW-038@ (FROM: @IMP-AC-VIEW-003@)
  it('emits manufacturer, model and ICAO when a lookup result is clicked', async () => {
    const wrapper = mountSelector({ manufacturer: '', model: '', icaoTypeDesignator: '' })
    const icaoInput = wrapper.find('#icao-designator-input')
    await icaoInput.setValue('PA28')
    const resultItem = wrapper.find('.icao-lookup-result')
    expect(resultItem.exists()).toBe(true)
    await resultItem.trigger('click')
    expect(wrapper.emitted('update:manufacturer')).toBeDefined()
    expect(wrapper.emitted('update:model')).toBeDefined()
    expect(wrapper.emitted('update:icaoTypeDesignator')).toBeDefined()
    const lastIcao = wrapper.emitted('update:icaoTypeDesignator')
    expect(lastIcao![lastIcao!.length - 1]).toEqual(['PA28'])
  })

  // @UT-AC-VIEW-039@ (FROM: @IMP-AC-VIEW-003@)
  it('normalises ICAO input to uppercase before emitting', async () => {
    const wrapper = mountSelector({ manufacturer: '', model: '', icaoTypeDesignator: '' })
    const icaoInput = wrapper.find('#icao-designator-input')
    await icaoInput.setValue('da40')
    const emitted = wrapper.emitted('update:icaoTypeDesignator')
    expect(emitted).toBeDefined()
    expect(emitted![0]).toEqual(['DA40'])
  })
})
