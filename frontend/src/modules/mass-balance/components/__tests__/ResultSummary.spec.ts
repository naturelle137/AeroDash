import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultSummary from '../ResultSummary.vue'
import type { MathCoreResult } from '@/modules/mass-balance/stores/mass-balance.types'

interface CategoryLimits {
  maxTakeoffMass: number
  maxZeroFuelMass: number | null
}

function buildResult(overrides: Partial<MathCoreResult> = {}): MathCoreResult {
  return {
    success: true,
    violations: [],
    zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    takeoffCenterOfGravityPoint: { arm: 1.91, mass: 530, moment: 1012.3 },
    landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    migrationPath: [
      { arm: 1.91, mass: 530, label: 'Takeoff' },
      { arm: 1.9, mass: 500, label: 'Landing' },
    ],
    ...overrides,
  }
}

const defaultLimits: CategoryLimits = {
  maxTakeoffMass: 630,
  maxZeroFuelMass: 600,
}

describe('ResultSummary', () => {
  // ─── v-if="result" branch ────────────────────────────────────────────────

  it('renders nothing when result prop is null', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: null, limits: null, canExport: false },
    })

    expect(wrapper.find('section.result-summary').exists()).toBe(false)
  })

  it('renders the result section when a result is provided', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: false },
    })

    expect(wrapper.find('section.result-summary').exists()).toBe(true)
  })

  // ─── Numeric value display ───────────────────────────────────────────────

  it('displays takeoff mass formatted to one decimal place', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: false },
    })

    const values = wrapper.findAll('.result-summary__value')
    expect(values[0]!.text()).toBe('530.0')
  })

  it('displays zero fuel mass formatted to one decimal place', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: false },
    })

    const values = wrapper.findAll('.result-summary__value')
    expect(values[1]!.text()).toBe('500.0')
  })

  it('displays takeoff CG arm formatted to three decimal places', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: false },
    })

    const values = wrapper.findAll('.result-summary__value')
    expect(values[2]!.text()).toBe('1.910')
  })

  it('displays landing CG arm formatted to three decimal places', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: false },
    })

    const values = wrapper.findAll('.result-summary__value')
    expect(values[3]!.text()).toBe('1.900')
  })

  // ─── v-if="limits" branch — takeoff mass limit ───────────────────────────

  it('shows the takeoff mass limit when limits prop is provided', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: defaultLimits, canExport: false },
    })

    const limitSpans = wrapper.findAll('.result-summary__limit')
    expect(limitSpans[0]!.text()).toBe('/ 630')
  })

  it('omits the takeoff mass limit span when limits prop is null', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: false },
    })

    const limitSpans = wrapper.findAll('.result-summary__limit')
    expect(limitSpans).toHaveLength(0)
  })

  // ─── v-if="limits?.maxZeroFuelMass != null" branch ──────────────────────

  it('shows the zero fuel mass limit when limits has a non-null maxZeroFuelMass', () => {
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult(),
        limits: { maxTakeoffMass: 630, maxZeroFuelMass: 600 },
        canExport: false,
      },
    })

    const limitSpans = wrapper.findAll('.result-summary__limit')
    expect(limitSpans).toHaveLength(2)
    expect(limitSpans[1]!.text()).toBe('/ 600')
  })

  it('omits the zero fuel mass limit span when maxZeroFuelMass is null', () => {
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult(),
        limits: { maxTakeoffMass: 630, maxZeroFuelMass: null },
        canExport: false,
      },
    })

    const limitSpans = wrapper.findAll('.result-summary__limit')
    expect(limitSpans).toHaveLength(1)
  })

  // ─── :disabled="!canExport" branch ──────────────────────────────────────

  it('renders the export button as disabled when canExport is false', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: false },
    })

    const btn = wrapper.find<HTMLButtonElement>('.result-summary__export-btn')
    expect(btn.element.disabled).toBe(true)
  })

  it('renders the export button as enabled when canExport is true', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: true },
    })

    const btn = wrapper.find<HTMLButtonElement>('.result-summary__export-btn')
    expect(btn.element.disabled).toBe(false)
  })

  // ─── exportRequiresConfirmation ternary branch ───────────────────────────

  it('shows "Export" label when exportRequiresConfirmation is false', () => {
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult(),
        limits: null,
        canExport: true,
        exportRequiresConfirmation: false,
      },
    })

    expect(wrapper.find('.result-summary__export-btn').text()).toBe('Export')
  })

  it('shows "Export (Confirm)" label when exportRequiresConfirmation is true', () => {
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult(),
        limits: null,
        canExport: true,
        exportRequiresConfirmation: true,
      },
    })

    expect(wrapper.find('.result-summary__export-btn').text()).toBe('Export (Confirm)')
  })

  it('defaults to "Export" label when exportRequiresConfirmation is absent', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: true },
    })

    expect(wrapper.find('.result-summary__export-btn').text()).toBe('Export')
  })

  // ─── export event emission ───────────────────────────────────────────────

  it('emits an export event when the export button is clicked', async () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: true },
    })

    await wrapper.find('.result-summary__export-btn').trigger('click')

    expect(wrapper.emitted('export')).toHaveLength(1)
  })

  it('still emits export when clicked even if canExport is false (DOM allows it)', async () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: false },
    })

    // Simulate programmatic click on the button element to verify the emit handler is wired
    wrapper.find('.result-summary__export-btn').element.removeAttribute('disabled')
    await wrapper.find('.result-summary__export-btn').trigger('click')

    expect(wrapper.emitted('export')).toHaveLength(1)
  })
})
