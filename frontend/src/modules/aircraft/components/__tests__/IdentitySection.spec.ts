/**
 * Unit tests for IdentitySection.vue — powertrain chooser and catalogue hint
 * behaviour introduced with REQ-AD-020 / REQ-AD-021.
 *
 * @see frontend/src/modules/aircraft/components/IdentitySection.vue
 */

// @UT-AC-VIEW-IDENT-001@ (FROM: @IMP-AC-VIEW-011@, @IMP-AC-VIEW-012@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IdentitySection, { type IdentityFields } from '../IdentitySection.vue'

function makeFields(overrides: Partial<IdentityFields> = {}): IdentityFields {
  return {
    registration: '',
    manufacturer: '',
    model: '',
    icaoTypeDesignator: '',
    sourceUnit: 'kg',
    referenceDatumDescription: '',
    referenceDatumLocation: '',
    powertrain: 'combustion',
    shareCode: null,
    ...overrides,
  }
}

describe('IdentitySection — powertrain selector', () => {
  it('renders both combustion and electric radio options', () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields(), sectionId: 'test' },
    })
    const radios = wrapper.findAll('input[type="radio"][name="powertrain"]')
    expect(radios).toHaveLength(2)
    const values = radios.map((r) => (r.element as HTMLInputElement).value)
    expect(values).toContain('combustion')
    expect(values).toContain('electric')
  })

  it('marks the combustion option active by default', () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields(), sectionId: 'test' },
    })
    const combustionRadio = wrapper.find('input[type="radio"][value="combustion"]')
    expect((combustionRadio.element as HTMLInputElement).checked).toBe(true)
  })

  it('emits an updated identity with powertrain=electric when the electric radio is chosen', async () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields(), sectionId: 'test' },
    })
    const electricRadio = wrapper.find('input[type="radio"][value="electric"]')
    await electricRadio.setValue(true)

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    const last = emitted![emitted!.length - 1]![0] as IdentityFields
    expect(last.powertrain).toBe('electric')
  })

  it('reflects an incoming electric modelValue in the radio state', () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields({ powertrain: 'electric' }), sectionId: 'test' },
    })
    const electricRadio = wrapper.find('input[type="radio"][value="electric"]')
    expect((electricRadio.element as HTMLInputElement).checked).toBe(true)
  })

  it('honours the powertrain hint emitted by AircraftModelSelector when the user picks Pipistrel Velis Electro', async () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields(), sectionId: 'test' },
    })

    // Simulate the AircraftModelSelector emitting its `powertrain-hint` event
    // as it does when the pilot selects Pipistrel / Velis Electro.
    const selector = wrapper.findComponent({ name: 'AircraftModelSelector' })
    expect(selector.exists()).toBe(true)
    await selector.vm.$emit('powertrain-hint', 'electric')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    const last = emitted![emitted!.length - 1]![0] as IdentityFields
    expect(last.powertrain).toBe('electric')
  })

  it('does not overwrite the powertrain when the catalogue hint is undefined (e.g. Other manufacturer)', async () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields({ powertrain: 'electric' }), sectionId: 'test' },
    })
    const selector = wrapper.findComponent({ name: 'AircraftModelSelector' })
    await selector.vm.$emit('powertrain-hint', undefined)

    // The only emits so far should be whatever the selector surfaces for
    // manufacturer/model/ICAO resets — not a powertrain flip. The local state
    // must still reflect 'electric' if the parent re-reads it.
    const emitted = wrapper.emitted('update:modelValue') ?? []
    for (const call of emitted) {
      const payload = call[0] as IdentityFields
      expect(payload.powertrain).toBe('electric')
    }
  })
})

// @UT-AC-VIEW-IDENT-002@ (FROM: @IMP-AC-VIEW-031@, @REQ-AD-022@)
describe('IdentitySection — lockPowertrain (edit-existing-aircraft flow)', () => {
  it('hides the powertrain radio group when lockPowertrain is true', () => {
    const wrapper = mount(IdentitySection, {
      props: {
        modelValue: makeFields({ powertrain: 'electric' }),
        sectionId: 'edit',
        lockPowertrain: true,
      },
    })

    expect(wrapper.findAll('input[type="radio"][name="powertrain"]')).toHaveLength(0)
    expect(wrapper.find('.powertrain-fieldset').exists()).toBe(false)
  })

  it('renders a read-only "Electric" label when powertrain is electric and lockPowertrain is true', () => {
    const wrapper = mount(IdentitySection, {
      props: {
        modelValue: makeFields({ powertrain: 'electric' }),
        sectionId: 'edit',
        lockPowertrain: true,
      },
    })

    const readonly = wrapper.find('.powertrain-readonly')
    expect(readonly.exists()).toBe(true)
    expect(readonly.text()).toContain('Powertrain')
    expect(readonly.text()).toContain('Electric')
  })

  it('renders a read-only "Combustion" label when powertrain is combustion and lockPowertrain is true', () => {
    const wrapper = mount(IdentitySection, {
      props: {
        modelValue: makeFields({ powertrain: 'combustion' }),
        sectionId: 'edit',
        lockPowertrain: true,
      },
    })

    expect(wrapper.find('.powertrain-readonly').text()).toContain('Combustion')
  })

  it('ignores catalogue powertrain hints when lockPowertrain is true', async () => {
    const wrapper = mount(IdentitySection, {
      props: {
        modelValue: makeFields({ powertrain: 'combustion' }),
        sectionId: 'edit',
        lockPowertrain: true,
      },
    })
    const selector = wrapper.findComponent({ name: 'AircraftModelSelector' })
    await selector.vm.$emit('powertrain-hint', 'electric')

    const emitted = wrapper.emitted('update:modelValue') ?? []
    // Pilots editing a saved profile must never see the powertrain silently
    // flipped by the catalogue hint — it would cascade into schema violations
    // on save and confuse the Save button's enable state.
    for (const call of emitted) {
      const payload = call[0] as IdentityFields
      expect(payload.powertrain).toBe('combustion')
    }
  })

  it('renders the radio group when lockPowertrain is explicitly false (wizard default)', () => {
    const wrapper = mount(IdentitySection, {
      props: {
        modelValue: makeFields(),
        sectionId: 'wizard',
        lockPowertrain: false,
      },
    })

    expect(wrapper.findAll('input[type="radio"][name="powertrain"]')).toHaveLength(2)
    expect(wrapper.find('.powertrain-readonly').exists()).toBe(false)
  })
})
