/**
 * Unit tests for WeighingReportsSection.vue
 * Covers: row rendering, add/remove row, field patch emissions, invalid-row highlight,
 * and min-1-row disable of remove button.
 *
 * @see frontend/src/modules/aircraft/components/WeighingReportsSection.vue
 */

// @UT-AC-VIEW-120@ (FROM: @IMP-AC-VIEW-013@, @IMP-AC-VIEW-014@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AircraftProfileWeighingReport } from '@/core/adapters/aircraft.schema'
import WeighingReportsSection from '../components/WeighingReportsSection.vue'

function makeReport(
  overrides: Partial<AircraftProfileWeighingReport> = {},
): AircraftProfileWeighingReport {
  return {
    bem: 432,
    emptyCg: 1.882,
    weighingDate: '2025-01-01',
    validFrom: '2025-01-01',
    ...overrides,
  }
}

describe('WeighingReportsSection — rendering', () => {
  // @UT-AC-VIEW-120@
  it('renders a row for each report', () => {
    const reports = [makeReport(), makeReport({ bem: 500 })]
    const wrapper = mount(WeighingReportsSection, {
      props: { modelValue: reports, sectionId: 'test' },
    })
    expect(wrapper.findAll('.weighing-report-row')).toHaveLength(2)
  })

  // @UT-AC-VIEW-121@
  it('disables remove button when only one row exists', () => {
    const wrapper = mount(WeighingReportsSection, {
      props: { modelValue: [makeReport()], sectionId: 'test' },
    })
    expect(wrapper.find('.btn-remove-row').attributes('disabled')).toBeDefined()
  })

  // @UT-AC-VIEW-122@
  it('enables remove button when more than one row exists', () => {
    const wrapper = mount(WeighingReportsSection, {
      props: { modelValue: [makeReport(), makeReport()], sectionId: 'test' },
    })
    const buttons = wrapper.findAll('.btn-remove-row')
    expect(buttons[0]!.attributes('disabled')).toBeUndefined()
  })

  // @UT-AC-VIEW-123@
  it('applies invalid class to rows missing required fields', () => {
    const invalid = makeReport({ bem: 0 })
    const wrapper = mount(WeighingReportsSection, {
      props: { modelValue: [invalid], sectionId: 'test' },
    })
    expect(wrapper.find('.weighing-report-row--invalid').exists()).toBe(true)
  })
})

describe('WeighingReportsSection — emits', () => {
  // @UT-AC-VIEW-124@
  it('emits updated array with patched bem when input changes', async () => {
    const report = makeReport({ bem: 432 })
    const wrapper = mount(WeighingReportsSection, {
      props: { modelValue: [report], sectionId: 'test' },
    })
    const input = wrapper.find('#test-bem-0')
    await input.setValue('450')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    expect(emitted[emitted.length - 1]?.[0]).toEqual([{ ...report, bem: 450 }])
  })

  // @UT-AC-VIEW-125@
  it('emits array with added row when + Add is clicked', async () => {
    const wrapper = mount(WeighingReportsSection, {
      props: { modelValue: [makeReport()], sectionId: 'test' },
    })
    await wrapper.find('.btn-add-row').trigger('click')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileWeighingReport[]
    expect(last).toHaveLength(2)
  })

  // @UT-AC-VIEW-126@
  it('emits array without the removed row', async () => {
    const reports = [makeReport({ bem: 1 }), makeReport({ bem: 2 })]
    const wrapper = mount(WeighingReportsSection, {
      props: { modelValue: reports, sectionId: 'test' },
    })
    await wrapper.findAll('.btn-remove-row')[0]!.trigger('click')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileWeighingReport[]
    expect(last).toHaveLength(1)
    expect(last[0]!.bem).toBe(2)
  })
})
