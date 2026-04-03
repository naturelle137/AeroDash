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

  it('does not render an export button (hidden until handler is wired)', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: null, canExport: true },
    })

    expect(wrapper.find('.result-summary__export-btn').exists()).toBe(false)
  })

  it('shows error message instead of NaN values when result.success is false', () => {
    const failedResult = buildResult({
      success: false,
      violations: [{ type: 'INVALID_INPUT', field: 'stations.0.arm', code: 'REQUIRED' }],
      zeroFuelCenterOfGravityPoint: { arm: NaN, mass: NaN, moment: NaN },
      takeoffCenterOfGravityPoint: { arm: NaN, mass: NaN, moment: NaN },
      landingCenterOfGravityPoint: { arm: NaN, mass: NaN, moment: NaN },
    })

    const wrapper = mount(ResultSummary, {
      props: { result: failedResult, limits: null, canExport: false },
    })

    expect(wrapper.find('.result-summary__error').exists()).toBe(true)
    expect(wrapper.text()).toContain('Input validation failed')
    expect(wrapper.findAll('.result-summary__value')).toHaveLength(0)
  })
})
