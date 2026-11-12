/**
 * Unit tests for EnvelopeSection.vue
 *
 * @see frontend/src/modules/aircraft/components/EnvelopeSection.vue
 */


import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EnvelopeSection from '../EnvelopeSection.vue'
import type { AircraftProfileCertificationCategory } from '@/core/adapters/aircraft.schema'

function makeCategory(overrides: Partial<AircraftProfileCertificationCategory> = {}): AircraftProfileCertificationCategory {
  return {
    category: 'Normal',
    mtom: 650,
    maxZeroFuelMass: null,
    graphType: 'arm',
    envelope: [
      { armOrMoment: 1.841, mass: 432 },
      { armOrMoment: 1.841, mass: 650 },
      { armOrMoment: 1.978, mass: 650 },
      { armOrMoment: 1.978, mass: 432 },
    ],
    ...overrides,
  }
}

describe('EnvelopeSection — envelope point management', () => {
  it('add-point button is disabled when envelope has 20 points', () => {
    const envelope = Array.from({ length: 20 }, (_, i) => ({ armOrMoment: i, mass: i }))
    const cat = makeCategory({ envelope })
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [cat], sectionId: 'test' },
    })
    const addBtn = wrapper.find('.btn-add-row')
    expect((addBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('add-point button is enabled when envelope has fewer than 20 points', () => {
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory()], sectionId: 'test' },
    })
    const addBtn = wrapper.find('.btn-add-row')
    expect((addBtn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('emits new envelope with 5 points when add-point is clicked on a 4-point envelope', async () => {
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory()], sectionId: 'test' },
    })
    await wrapper.find('.btn-add-row').trigger('click')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const lastEmit = emitted[emitted.length - 1]?.[0] as AircraftProfileCertificationCategory[]
    expect(lastEmit[0]?.envelope).toHaveLength(5)
  })

  it('remove-point button is disabled when envelope has exactly 4 points', () => {
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory()], sectionId: 'test' },
    })
    const removeBtns = wrapper.findAll('.btn-remove-row')
    // All remove-point buttons should be disabled at minimum 4 points
    removeBtns.forEach((btn) => {
      expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('remove-point button is enabled when envelope has 5+ points', async () => {
    const envelope = [
      { armOrMoment: 0, mass: 0 },
      { armOrMoment: 0, mass: 1 },
      { armOrMoment: 1, mass: 1 },
      { armOrMoment: 1, mass: 0 },
      { armOrMoment: 0.5, mass: 0.5 },
    ]
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory({ envelope })], sectionId: 'test' },
    })
    const removeBtns = wrapper.findAll('.btn-remove-row')
    // At least one remove button should be enabled
    const anyEnabled = removeBtns.some((btn) => !(btn.element as HTMLButtonElement).disabled)
    expect(anyEnabled).toBe(true)
  })

  it('shows "At least 4 points required" error when envelope has fewer than 4 points', () => {
    // Simulate having only 3 points (we bypass the component logic by passing directly)
    const envelope = [
      { armOrMoment: 0, mass: 0 },
      { armOrMoment: 1, mass: 0 },
      { armOrMoment: 1, mass: 1 },
    ]
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory({ envelope })], sectionId: 'test' },
    })
    expect(wrapper.text()).toContain('At least 4 points required')
  })
})

describe('EnvelopeSection — category management', () => {
  it('add-category button emits a new category appended to the list', async () => {
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory()], sectionId: 'test' },
    })
    await wrapper.find('.btn-add-category').trigger('click')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const lastEmit = emitted[emitted.length - 1]?.[0] as AircraftProfileCertificationCategory[]
    expect(lastEmit).toHaveLength(2)
  })

  it('remove-category button is disabled when only 1 category exists', () => {
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory()], sectionId: 'test' },
    })
    const removeBtn = wrapper.find('.btn-remove-cat')
    expect((removeBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('remove-category emits the list without the removed entry when 2 categories exist', async () => {
    const cats = [makeCategory({ category: 'Normal' }), makeCategory({ category: 'Utility' })]
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: cats, sectionId: 'test' },
    })
    const removeBtns = wrapper.findAll('.btn-remove-cat')
    await removeBtns[0]!.trigger('click')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const lastEmit = emitted[emitted.length - 1]?.[0] as AircraftProfileCertificationCategory[]
    expect(lastEmit).toHaveLength(1)
    expect(lastEmit[0]?.category).toBe('Utility')
  })
})

describe('EnvelopeSection — graph type', () => {
  it('shows "Arm" as column header when graphType is arm', () => {
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory({ graphType: 'arm' })], sectionId: 'test' },
    })
    const th = wrapper.find('.envelope-table th')
    expect(th.text()).toBe('Arm')
  })

  it('shows "Moment" as column header when graphType is moment', () => {
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory({ graphType: 'moment' })], sectionId: 'test' },
    })
    const th = wrapper.find('.envelope-table th')
    expect(th.text()).toBe('Moment')
  })

  it('switching graph type to moment emits updated category', async () => {
    const wrapper = mount(EnvelopeSection, {
      props: { modelValue: [makeCategory({ graphType: 'arm' })], sectionId: 'test' },
    })
    // Find the moment radio and trigger change
    const momentRadio = wrapper.find('input[value="moment"]')
    await momentRadio.trigger('change')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const lastEmit = emitted[emitted.length - 1]?.[0] as AircraftProfileCertificationCategory[]
    expect(lastEmit[0]?.graphType).toBe('moment')
  })
})
