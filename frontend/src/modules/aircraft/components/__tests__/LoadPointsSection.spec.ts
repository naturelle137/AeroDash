/**
 * Unit tests for LoadPointsSection.vue — fuel-tank UI gating on electric
 * aircraft (REQ-AD-020).
 *
 * @see frontend/src/modules/aircraft/components/LoadPointsSection.vue
 */

// @UT-AC-VIEW-LP-001@ (FROM: @IMP-AC-VIEW-017@, @IMP-AC-VIEW-018@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadPointsSection from '../LoadPointsSection.vue'
import type { AircraftProfileLoadPoint } from '@/core/adapters/aircraft.schema'

function makeLoadPoint(overrides: Partial<AircraftProfileLoadPoint> = {}): AircraftProfileLoadPoint {
  return {
    name: 'Pilot',
    arm: 1.1,
    armLookup: [],
    operationalLimit: 110,
    defaultQuantity: 0,
    unit: 'kg',
    allowableCategories: null,
    fuelTank: null,
    ...overrides,
  }
}

describe('LoadPointsSection — combustion default', () => {
  it('shows the "+ Add Fuel Tank" button', () => {
    const wrapper = mount(LoadPointsSection, {
      props: {
        modelValue: [makeLoadPoint()],
        sectionId: 'test',
      },
    })
    expect(wrapper.find('.btn-add-fuel').exists()).toBe(true)
  })

  it('shows the "This station is a fuel tank" toggle on each load point', () => {
    const wrapper = mount(LoadPointsSection, {
      props: {
        modelValue: [makeLoadPoint()],
        sectionId: 'test',
      },
    })
    const toggles = wrapper.findAll('.toggle')
    expect(toggles.length).toBeGreaterThan(0)
  })
})

describe('LoadPointsSection — electric powertrain', () => {
  it('hides the "+ Add Fuel Tank" button', () => {
    const wrapper = mount(LoadPointsSection, {
      props: {
        modelValue: [makeLoadPoint()],
        sectionId: 'test',
        powertrain: 'electric',
      },
    })
    expect(wrapper.find('.btn-add-fuel').exists()).toBe(false)
  })

  it('hides the fuel-tank toggle on each load point', () => {
    const wrapper = mount(LoadPointsSection, {
      props: {
        modelValue: [makeLoadPoint()],
        sectionId: 'test',
        powertrain: 'electric',
      },
    })
    expect(wrapper.find('.toggle').exists()).toBe(false)
  })

  it('shows an informational note explaining that fuel tanks are not applicable', () => {
    const wrapper = mount(LoadPointsSection, {
      props: {
        modelValue: [makeLoadPoint()],
        sectionId: 'test',
        powertrain: 'electric',
      },
    })
    expect(wrapper.text()).toContain('battery-electric')
  })
})
