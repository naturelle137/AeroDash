/**
 * Unit tests for IdentitySection.vue
 * Covers: rendering identity fields, patching modelValue, shareCode null handling,
 * and registration error surface.
 *
 * @see frontend/src/modules/aircraft/components/IdentitySection.vue
 */


import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IdentitySection, {
  type IdentityFields,
} from '../components/IdentitySection.vue'

function makeFields(overrides: Partial<IdentityFields> = {}): IdentityFields {
  return {
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    powertrain: 'combustion',
    shareCode: null,
    ...overrides,
  }
}

describe('IdentitySection — rendering', () => {
  it('displays the provided field values', () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields(), sectionId: 'test' },
    })
    const reg = wrapper.find('#test-registration')
    expect((reg.element as HTMLInputElement).value).toBe('D-EBPN')
  })

  it('renders registration error when provided', () => {
    const wrapper = mount(IdentitySection, {
      props: {
        modelValue: makeFields(),
        sectionId: 'test',
        registrationError: 'Invalid registration format.',
      },
    })
    expect(wrapper.text()).toContain('Invalid registration format.')
  })

  it('does not render an ownerId input field', () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields(), sectionId: 'test' },
    })
    expect(wrapper.find('#test-ownerId').exists()).toBe(false)
  })

  //  — share code is a future cloud-generated field; never user input
  it('does not render a share-code input field', () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields({ shareCode: null }), sectionId: 'test' },
    })
    expect(wrapper.find('#test-shareCode').exists()).toBe(false)
  })
})

describe('IdentitySection — emits', () => {
  it('emits patched modelValue when registration changes', async () => {
    const fields = makeFields()
    const wrapper = mount(IdentitySection, {
      props: { modelValue: fields, sectionId: 'test' },
    })
    const input = wrapper.find('#test-registration')
    await input.setValue('G-ABCD')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toMatchObject({ registration: 'G-ABCD' })
  })

  //  — multi-emit batch preserves prior changes (iOS defect regression)
  it('preserves prior patches when AircraftModelSelector fires manufacturer + model + icao back-to-back', async () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields({ manufacturer: '', model: '', icaoTypeDesignator: '' }), sectionId: 'test' },
    })
    const selector = wrapper.findComponent({ name: 'AircraftModelSelector' })
    // Simulate AircraftModelSelector's onManufacturerChange which fires three emits
    // synchronously. Before the local-ref fix, the last emit's spread of stale
    // props.modelValue clobbered the manufacturer back to ''.
    selector.vm.$emit('update:manufacturer', 'Cessna')
    selector.vm.$emit('update:model', '')
    selector.vm.$emit('update:icao-type-designator', '')
    await wrapper.vm.$nextTick()
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as IdentityFields
    expect(last.manufacturer).toBe('Cessna')
  })
})
