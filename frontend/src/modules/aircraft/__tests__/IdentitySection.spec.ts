/**
 * Unit tests for IdentitySection.vue
 * Covers: rendering identity fields, patching modelValue, shareCode null handling,
 * and registration error surface.
 *
 * @see frontend/src/modules/aircraft/components/IdentitySection.vue
 */

// @UT-AC-VIEW-110@ (FROM: @IMP-AC-VIEW-011@, @IMP-AC-VIEW-012@)

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
    ownerId: 'user-test',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    ...overrides,
  }
}

describe('IdentitySection — rendering', () => {
  // @UT-AC-VIEW-110@
  it('displays the provided field values', () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields(), sectionId: 'test' },
    })
    const reg = wrapper.find('#test-registration')
    expect((reg.element as HTMLInputElement).value).toBe('D-EBPN')
  })

  // @UT-AC-VIEW-111@
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

  // @UT-AC-VIEW-112@
  it('renders empty string for null shareCode', () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields({ shareCode: null }), sectionId: 'test' },
    })
    const share = wrapper.find('#test-shareCode')
    expect((share.element as HTMLInputElement).value).toBe('')
  })
})

describe('IdentitySection — emits', () => {
  // @UT-AC-VIEW-113@
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

  // @UT-AC-VIEW-114@
  it('emits null shareCode when input is blanked', async () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields({ shareCode: 'ABC-123' }), sectionId: 'test' },
    })
    const share = wrapper.find('#test-shareCode')
    await share.setValue('')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toMatchObject({ shareCode: null })
  })

  // @UT-AC-VIEW-115@
  it('emits trimmed non-empty shareCode', async () => {
    const wrapper = mount(IdentitySection, {
      props: { modelValue: makeFields({ shareCode: null }), sectionId: 'test' },
    })
    const share = wrapper.find('#test-shareCode')
    await share.setValue('  FOO-42  ')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toMatchObject({ shareCode: 'FOO-42' })
  })
})
