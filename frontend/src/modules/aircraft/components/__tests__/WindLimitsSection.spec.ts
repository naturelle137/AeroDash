// @UT-AC-VIEW-185@ (FROM: @IMP-AC-VIEW-035@, @IMP-AC-VIEW-036@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WindLimitsSection from '../WindLimitsSection.vue'
import type { AircraftProfileWindLimit } from '@/core/adapters/aircraft.schema'

function makeLimit(overrides: Partial<AircraftProfileWindLimit> = {}): AircraftProfileWindLimit {
  return {
    component: 'MaxCrosswind',
    value: 15,
    classification: 'Demonstrated',
    ...overrides,
  }
}

function lastEmit(wrapper: ReturnType<typeof mount>): AircraftProfileWindLimit[] {
  const emitted = wrapper.emitted('update:modelValue')!
  return emitted[emitted.length - 1]![0] as AircraftProfileWindLimit[]
}

describe('WindLimitsSection — rendering', () => {
  it('shows the empty state when there are no wind limits', () => {
    const wrapper = mount(WindLimitsSection, {
      props: { modelValue: [], sectionId: 'test' },
    })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.wind-limit-row').exists()).toBe(false)
  })

  it('renders a row with component, value and classification controls per limit', () => {
    const wrapper = mount(WindLimitsSection, {
      props: { modelValue: [makeLimit()], sectionId: 'test' },
    })
    expect(wrapper.find('#test-component-0').exists()).toBe(true)
    expect(wrapper.find('#test-value-0').exists()).toBe(true)
    expect(wrapper.find('#test-classification-0').exists()).toBe(true)
  })

  it('warns when the same (component, classification) pair appears more than once', () => {
    const wrapper = mount(WindLimitsSection, {
      props: {
        modelValue: [makeLimit(), makeLimit()],
        sectionId: 'test',
      },
    })
    expect(wrapper.find('.field-error').exists()).toBe(true)
  })

  it('does not warn for same component with different classifications (valid POH data)', () => {
    const wrapper = mount(WindLimitsSection, {
      props: {
        modelValue: [makeLimit(), makeLimit({ classification: 'Limit' })],
        sectionId: 'test',
      },
    })
    expect(wrapper.find('.field-error').exists()).toBe(false)
  })

  it('does not warn for distinct components', () => {
    const wrapper = mount(WindLimitsSection, {
      props: {
        modelValue: [makeLimit(), makeLimit({ component: 'MaxGust' })],
        sectionId: 'test',
      },
    })
    expect(wrapper.find('.field-error').exists()).toBe(false)
  })
})

describe('WindLimitsSection — emits', () => {
  it('adds a default crosswind/Demonstrated row', async () => {
    const wrapper = mount(WindLimitsSection, {
      props: { modelValue: [], sectionId: 'test' },
    })
    await wrapper.find('.btn-add-row').trigger('click')
    const next = lastEmit(wrapper)
    expect(next).toHaveLength(1)
    expect(next[0]).toEqual({ component: 'MaxCrosswind', value: 0, classification: 'Demonstrated' })
  })

  it('removes the targeted row', async () => {
    const wrapper = mount(WindLimitsSection, {
      props: {
        modelValue: [makeLimit(), makeLimit({ component: 'MaxGust' })],
        sectionId: 'test',
      },
    })
    await wrapper.find('.btn-remove-row').trigger('click')
    const next = lastEmit(wrapper)
    expect(next).toHaveLength(1)
    expect(next[0]!.component).toBe('MaxGust')
  })

  it('patches the component when the component select changes', async () => {
    const wrapper = mount(WindLimitsSection, {
      props: { modelValue: [makeLimit()], sectionId: 'test' },
    })
    await wrapper.find('#test-component-0').setValue('MaxTailwind')
    expect(lastEmit(wrapper)[0]!.component).toBe('MaxTailwind')
  })

  it('patches the classification when the classification select changes', async () => {
    const wrapper = mount(WindLimitsSection, {
      props: { modelValue: [makeLimit()], sectionId: 'test' },
    })
    await wrapper.find('#test-classification-0').setValue('Limit')
    expect(lastEmit(wrapper)[0]!.classification).toBe('Limit')
  })

  it('patches the value when the value input changes', async () => {
    const wrapper = mount(WindLimitsSection, {
      props: { modelValue: [makeLimit()], sectionId: 'test' },
    })
    await wrapper.find('#test-value-0').setValue('22')
    expect(lastEmit(wrapper)[0]!.value).toBe(22)
  })

  it('coerces a cleared value back to zero so the schema bound holds', async () => {
    const wrapper = mount(WindLimitsSection, {
      props: { modelValue: [makeLimit()], sectionId: 'test' },
    })
    await wrapper.find('#test-value-0').setValue('')
    expect(lastEmit(wrapper)[0]!.value).toBe(0)
  })
})
