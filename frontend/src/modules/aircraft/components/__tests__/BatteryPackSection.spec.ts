/**
 * Unit tests for BatteryPackSection.vue — the electric aircraft battery
 * editor introduced with REQ-AD-021.
 *
 * @see frontend/src/modules/aircraft/components/BatteryPackSection.vue
 */

// @UT-AC-VIEW-BAT-001@ (FROM: @IMP-AC-VIEW-BAT-001@, @IMP-AC-VIEW-BAT-002@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BatteryPackSection from '../BatteryPackSection.vue'
import type { AircraftProfileBatteryPack } from '@/core/adapters/aircraft.schema'

function makePack(overrides: Partial<AircraftProfileBatteryPack> = {}): AircraftProfileBatteryPack {
  return {
    usableEnergyKwh: 24.8,
    reserveFloorKwh: 4.0,
    ...overrides,
  }
}

describe('BatteryPackSection — rendering', () => {
  it('renders usable energy, reserve floor, voltage, and chemistry inputs', () => {
    const wrapper = mount(BatteryPackSection, {
      props: { modelValue: makePack(), sectionId: 'test' },
    })
    expect(wrapper.find('#test-usable-energy').exists()).toBe(true)
    expect(wrapper.find('#test-reserve-floor').exists()).toBe(true)
    expect(wrapper.find('#test-nominal-voltage').exists()).toBe(true)
    expect(wrapper.find('#test-chemistry').exists()).toBe(true)
  })

  it('surfaces a validation error when reserve floor equals usable energy', () => {
    const wrapper = mount(BatteryPackSection, {
      props: {
        modelValue: makePack({ usableEnergyKwh: 24.8, reserveFloorKwh: 24.8 }),
        sectionId: 'test',
      },
    })
    const errors = wrapper.findAll('.field-error')
    const messages = errors.map((e) => e.text())
    expect(messages.some((m) => m.includes('Reserve floor'))).toBe(true)
  })

  it('surfaces no error for a well-formed battery pack', () => {
    const wrapper = mount(BatteryPackSection, {
      props: { modelValue: makePack(), sectionId: 'test' },
    })
    expect(wrapper.findAll('.field-error')).toHaveLength(0)
  })
})

describe('BatteryPackSection — emits', () => {
  it('emits update:modelValue when chemistry is typed', async () => {
    const wrapper = mount(BatteryPackSection, {
      props: { modelValue: makePack(), sectionId: 'test' },
    })
    const input = wrapper.find('#test-chemistry')
    await input.setValue('NMC')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    const last = emitted![emitted!.length - 1]![0] as AircraftProfileBatteryPack
    expect(last.chemistry).toBe('NMC')
  })

  it('collapses an empty chemistry string to undefined (schema-compatible)', async () => {
    const wrapper = mount(BatteryPackSection, {
      props: { modelValue: makePack({ chemistry: 'LiFePO4' }), sectionId: 'test' },
    })
    const input = wrapper.find('#test-chemistry')
    await input.setValue('')

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as AircraftProfileBatteryPack
    expect(last.chemistry).toBeUndefined()
  })
})
