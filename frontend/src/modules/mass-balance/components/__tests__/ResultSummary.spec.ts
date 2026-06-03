// @UT-MB-UI-004@ (FROM: @IMP-MB-UI-005@, @IMP-MB-UI-011@)

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

  // ─── Limit-proximity highlighting ──────────────────────────────────────────

  it('flags the takeoff mass as over-limit (colour + screen-reader text) when it exceeds MTOM', () => {
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult({
          takeoffCenterOfGravityPoint: { arm: 1.91, mass: 650, moment: 1241.5 },
        }),
        limits: defaultLimits,
        canExport: false,
      },
    })

    const takeoffValue = wrapper.findAll('.result-summary__value')[0]!
    expect(takeoffValue.classes()).toContain('result-summary__value--over')
    expect(wrapper.find('.result-summary__sr-only').text()).toContain('at or above limit')
  })

  it('flags the takeoff mass as near-limit when within 2% of MTOM', () => {
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult({
          takeoffCenterOfGravityPoint: { arm: 1.91, mass: 625, moment: 1193.75 },
        }),
        limits: defaultLimits,
        canExport: false,
      },
    })

    const takeoffValue = wrapper.findAll('.result-summary__value')[0]!
    expect(takeoffValue.classes()).toContain('result-summary__value--near')
  })

  it('does not flag masses comfortably below their limits', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: defaultLimits, canExport: false },
    })

    const takeoffValue = wrapper.findAll('.result-summary__value')[0]!
    expect(takeoffValue.classes()).not.toContain('result-summary__value--over')
    expect(takeoffValue.classes()).not.toContain('result-summary__value--near')
    expect(wrapper.find('.result-summary__sr-only').exists()).toBe(false)
  })

  it('flags the zero-fuel mass as over-limit when it exceeds MZFM', () => {
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult({
          zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 620, moment: 1178 },
        }),
        limits: defaultLimits,
        canExport: false,
      },
    })

    const zeroFuelValue = wrapper.findAll('.result-summary__value')[1]!
    expect(zeroFuelValue.classes()).toContain('result-summary__value--over')
  })

  it('applies no proximity highlight when limits are absent', () => {
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult({
          takeoffCenterOfGravityPoint: { arm: 1.91, mass: 9999, moment: 1 },
        }),
        limits: null,
        canExport: false,
      },
    })

    const takeoffValue = wrapper.findAll('.result-summary__value')[0]!
    expect(takeoffValue.classes()).not.toContain('result-summary__value--over')
    expect(takeoffValue.classes()).not.toContain('result-summary__value--near')
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
