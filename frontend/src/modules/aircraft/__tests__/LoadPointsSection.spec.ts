/**
 * Unit tests for LoadPointsSection.vue
 * Covers: row rendering, add/remove, patch emissions, unit select, fuel-tank toggle,
 * fuel-type multi-select, and armLookup read-only hint.
 *
 * @see frontend/src/modules/aircraft/components/LoadPointsSection.vue
 */

// @UT-AC-VIEW-140@ (FROM: @IMP-AC-VIEW-017@, @IMP-AC-VIEW-018@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AircraftProfileLoadPoint } from '@/core/adapters/aircraft.schema'
import LoadPointsSection from '../components/LoadPointsSection.vue'

function makeRow(overrides: Partial<AircraftProfileLoadPoint> = {}): AircraftProfileLoadPoint {
  return {
    name: 'Pilot',
    arm: 1.9,
    armLookup: [],
    operationalLimit: 110,
    defaultQuantity: 85,
    unit: 'kg',
    allowableCategories: null,
    fuelTank: null,
    ...overrides,
  }
}

describe('LoadPointsSection — rendering', () => {
  // @UT-AC-VIEW-140@
  it('renders one row per load point', () => {
    const rows = [makeRow(), makeRow({ name: 'Copilot' })]
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: rows, sectionId: 'test' },
    })
    expect(wrapper.findAll('.load-point-row')).toHaveLength(2)
  })

  // @UT-AC-VIEW-141@
  it('shows an empty-state message when there are no load points', () => {
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [], sectionId: 'test' },
    })
    expect(wrapper.text()).toContain('No load stations yet')
  })

  // @UT-AC-VIEW-142@
  it('disables the arm input and shows a hint when armLookup is used', () => {
    const row = makeRow({
      arm: null,
      armLookup: [
        { massOrVolume: 0, moment: 0 },
        { massOrVolume: 30, moment: 60 },
      ],
    })
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [row], sectionId: 'test' },
    })
    const arm = wrapper.find('#test-arm-0')
    expect(arm.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('variable-arm lookup table')
  })

  // @UT-AC-VIEW-143@
  it('marks fuel-tank rows with the fuel accent modifier', () => {
    const tank = makeRow({
      name: 'Main Tank',
      unit: 'L',
      fuelTank: {
        unusableFuel: 1,
        permissibleFuelTypes: ['AvGas 100LL'],
        burnSequences: [],
      },
    })
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [tank], sectionId: 'test' },
    })
    expect(wrapper.find('.load-point-row--fuel').exists()).toBe(true)
  })
})

describe('LoadPointsSection — emits', () => {
  // @UT-AC-VIEW-144@
  it('emits updated name when the name input changes', async () => {
    const row = makeRow()
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [row], sectionId: 'test' },
    })
    await wrapper.find('#test-name-0').setValue('Front Pax')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileLoadPoint[]
    expect(last[0]?.name).toBe('Front Pax')
  })

  // @UT-AC-VIEW-145@
  it('emits a new load point row when + Add Load Station is clicked', async () => {
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [], sectionId: 'test' },
    })
    await wrapper.find('.btn-add-row').trigger('click')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileLoadPoint[]
    expect(last).toHaveLength(1)
    expect(last[0]?.fuelTank).toBeNull()
    expect(last[0]?.unit).toBe('kg')
  })

  // @UT-AC-VIEW-146@
  it('emits a fuel-tank-seeded row when + Add Fuel Tank is clicked', async () => {
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [], sectionId: 'test' },
    })
    await wrapper.find('.btn-add-fuel').trigger('click')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileLoadPoint[]
    expect(last).toHaveLength(1)
    expect(last[0]?.fuelTank).not.toBeNull()
    expect(last[0]?.unit).toBe('L')
    expect(last[0]?.fuelTank?.permissibleFuelTypes).toEqual(['AvGas 100LL'])
  })

  // @UT-AC-VIEW-147@
  it('emits an array without the removed row when ✕ is clicked', async () => {
    const rows = [makeRow({ name: 'A' }), makeRow({ name: 'B' })]
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: rows, sectionId: 'test' },
    })
    await wrapper.findAll('.btn-remove-row')[0]!.trigger('click')
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileLoadPoint[]
    expect(last).toHaveLength(1)
    expect(last[0]?.name).toBe('B')
  })

  // @UT-AC-VIEW-148@
  it('enables the fuel-tank extension when the toggle is checked', async () => {
    const row = makeRow()
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [row], sectionId: 'test' },
    })
    const toggle = wrapper.find('.toggle input[type="checkbox"]')
    await toggle.setValue(true)
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileLoadPoint[]
    expect(last[0]?.fuelTank).not.toBeNull()
    expect(last[0]?.fuelTank?.permissibleFuelTypes.length).toBeGreaterThan(0)
  })

  // @UT-AC-VIEW-149@
  it('clears the fuel-tank extension when the toggle is unchecked', async () => {
    const row = makeRow({
      fuelTank: {
        unusableFuel: 1,
        permissibleFuelTypes: ['AvGas 100LL'],
        burnSequences: [],
      },
    })
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [row], sectionId: 'test' },
    })
    const toggle = wrapper.find('.toggle input[type="checkbox"]')
    await toggle.setValue(false)
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileLoadPoint[]
    expect(last[0]?.fuelTank).toBeNull()
  })

  // @UT-AC-VIEW-150@
  it('adds a permissible fuel type when its checkbox is checked', async () => {
    const row = makeRow({
      unit: 'L',
      fuelTank: {
        unusableFuel: 0,
        permissibleFuelTypes: ['AvGas 100LL'],
        burnSequences: [],
      },
    })
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [row], sectionId: 'test' },
    })
    const labels = wrapper.findAll('.checkbox-inline')
    const target = labels.find((l) => l.text().includes('MoGas'))
    expect(target).toBeDefined()
    await target!.find('input[type="checkbox"]').setValue(true)
    const emitted = (wrapper.emitted('update:modelValue') ?? []) as unknown[][]
    const last = emitted[emitted.length - 1]?.[0] as AircraftProfileLoadPoint[]
    expect(last[0]?.fuelTank?.permissibleFuelTypes).toContain('MoGas')
    expect(last[0]?.fuelTank?.permissibleFuelTypes).toContain('AvGas 100LL')
  })

  // @UT-AC-VIEW-151@
  it('shows an error when all permissible fuel types are removed', async () => {
    const row = makeRow({
      unit: 'L',
      fuelTank: {
        unusableFuel: 0,
        permissibleFuelTypes: [],
        burnSequences: [],
      },
    })
    const wrapper = mount(LoadPointsSection, {
      props: { modelValue: [row], sectionId: 'test' },
    })
    expect(wrapper.text()).toContain('At least one permissible fuel type is required')
  })
})
