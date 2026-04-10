/**
 * Unit tests for AircraftModelSelector (manufacturer / model / ICAO hierarchy).
 *
 * @see frontend/src/modules/aircraft/components/AircraftModelSelector.vue
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AircraftModelSelector from '../components/AircraftModelSelector.vue'

describe('AircraftModelSelector', () => {
  // @UT-AC-VIEW-009@ (FROM: @IMP-AC-VIEW-003@)
  it('selecting a model auto-fills ICAO type designator', async () => {
    const wrapper = mount(AircraftModelSelector, {
      props: { manufacturer: 'Tecnam', model: '', icaoTypeDesignator: '' },
    })

    await wrapper.get('#model-input').setValue('P2008 JC')

    const icaoEmits = wrapper.emitted('update:icaoTypeDesignator') as unknown[][] | undefined
    expect(icaoEmits?.[icaoEmits.length - 1]?.[0]).toBe('P208')
  })

  // @UT-AC-VIEW-010@ (FROM: @IMP-AC-VIEW-003@)
  it('typing a unique 4-char ICAO auto-fills manufacturer and model', async () => {
    const wrapper = mount(AircraftModelSelector, {
      props: { manufacturer: '', model: '', icaoTypeDesignator: '' },
    })

    const icao = wrapper.get('#icao-designator-input')
    await icao.setValue('P208')

    const mfr = wrapper.emitted('update:manufacturer') as unknown[][] | undefined
    const mdl = wrapper.emitted('update:model') as unknown[][] | undefined
    const icaoEmits = wrapper.emitted('update:icaoTypeDesignator') as unknown[][] | undefined
    expect(mfr?.[mfr.length - 1]?.[0]).toBe('Tecnam')
    expect(mdl?.[mdl.length - 1]?.[0]).toBe('P2008 JC')
    expect(icaoEmits?.[icaoEmits.length - 1]?.[0]).toBe('P208')
  })

  // @UT-AC-VIEW-011@ (FROM: @IMP-AC-VIEW-003@)
  it('shows text model input when manufacturer is Other', () => {
    const wrapper = mount(AircraftModelSelector, {
      props: { manufacturer: 'Other', model: '', icaoTypeDesignator: '' },
    })

    expect(wrapper.find('#model-input').element.tagName).toBe('INPUT')
  })
})
