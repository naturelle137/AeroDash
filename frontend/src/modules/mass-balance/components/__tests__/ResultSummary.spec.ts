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
      { arm: 1.91, mass: 530, moment: 1012.3, label: 'Takeoff' },
      { arm: 1.9, mass: 500, moment: 950, label: 'Landing' },
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
    expect(limitSpans[0]!.text()).toBe('/ MTOM 630.0 kg')
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
    expect(limitSpans[1]!.text()).toBe('/ MZFM 600.0 kg')
  })

  it('rounds a non-integer kg limit down, never presenting more permissible mass', () => {
    // 2400 lb = 1088.621688 kg; 2000 lb = 907.18474 kg.
    const wrapper = mount(ResultSummary, {
      props: {
        result: buildResult(),
        limits: { maxTakeoffMass: 1088.621688, maxZeroFuelMass: 907.18474 },
        canExport: false,
      },
    })

    const limitSpans = wrapper.findAll('.result-summary__limit')
    expect(limitSpans[0]!.text()).toBe('/ MTOM 1088.6 kg')
    expect(limitSpans[1]!.text()).toBe('/ MZFM 907.1 kg')
    expect(wrapper.text()).not.toContain('1089')
    expect(wrapper.text()).not.toContain('907.2')
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
    expect(wrapper.find('.result-summary__sr-only').text()).toContain('above limit')
  })

  it('has no proximity band: 979 and 981 kg below a 1000 kg MTOM look identical', () => {
    const limits = { maxTakeoffMass: 1000, maxZeroFuelMass: 900 }
    for (const mass of [979, 981, 999.96]) {
      const wrapper = mount(ResultSummary, {
        props: {
          result: buildResult({ takeoffCenterOfGravityPoint: { arm: 1.91, mass, moment: mass * 1.91 } }),
          limits,
          canExport: false,
        },
      })
      const takeoffValue = wrapper.findAll('.result-summary__value')[0]!
      expect(takeoffValue.classes()).toEqual(['result-summary__value'])
      expect(wrapper.find('.result-summary__sr-only').exists()).toBe(false)
      expect(wrapper.text()).not.toMatch(/approaching/i)
    }
  })

  it('does not flag masses below their limits', () => {
    const wrapper = mount(ResultSummary, {
      props: { result: buildResult(), limits: defaultLimits, canExport: false },
    })

    const takeoffValue = wrapper.findAll('.result-summary__value')[0]!
    expect(takeoffValue.classes()).not.toContain('result-summary__value--over')
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

  it('applies no above-limit highlight when limits are absent', () => {
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
  })

  it('shows error message instead of NaN values when result.success is false', () => {
    const failedResult = buildResult({
      success: false,
      violations: [{ type: 'INVALID_INPUT', field: 'stations.0.arm', code: 'REQUIRED' }],
      zeroFuelCenterOfGravityPoint: { arm: Number.NaN, mass: Number.NaN, moment: Number.NaN },
      takeoffCenterOfGravityPoint: { arm: Number.NaN, mass: Number.NaN, moment: Number.NaN },
      landingCenterOfGravityPoint: { arm: Number.NaN, mass: Number.NaN, moment: Number.NaN },
    })

    const wrapper = mount(ResultSummary, {
      props: { result: failedResult, limits: null, canExport: false },
    })

    expect(wrapper.find('.result-summary__error').exists()).toBe(true)
    expect(wrapper.text()).toContain('Input validation failed')
    expect(wrapper.findAll('.result-summary__value')).toHaveLength(0)
  })
})

describe('ResultSummary — mass-limit differences', () => {
  function mountWith(takeoff: number, zeroFuel: number, limits: CategoryLimits | null) {
    return mount(ResultSummary, {
      props: {
        result: buildResult({
          takeoffCenterOfGravityPoint: { arm: 1.91, mass: takeoff, moment: takeoff * 1.91 },
          zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: zeroFuel, moment: zeroFuel * 1.9 },
        }),
        limits,
        canExport: false,
      },
    })
  }

  it('shows below, at and above relations as text for MTOM and MZFM', () => {
    const below = mountWith(530, 500, defaultLimits)
    expect(below.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Below MTOM by 100.0 kg')
    expect(below.get('[data-testid="zero-fuel-limit-difference"]').text()).toBe('Below MZFM by 100.0 kg')

    const at = mountWith(630, 600, defaultLimits)
    expect(at.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Exactly at MTOM')
    expect(at.get('[data-testid="zero-fuel-limit-difference"]').text()).toBe('Exactly at MZFM')

    const above = mountWith(630.5, 601.25, defaultLimits)
    expect(above.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Above MTOM by 0.5 kg')
    expect(above.get('[data-testid="zero-fuel-limit-difference"]').text()).toBe('Above MZFM by 1.3 kg')
  })

  it('keeps sub-display-unit differences visible in both directions', () => {
    const w = mountWith(629.96, 600.0001, defaultLimits)
    expect(w.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Below MTOM by less than 0.1 kg')
    expect(w.get('[data-testid="zero-fuel-limit-difference"]').text()).toBe('Above MZFM by 0.1 kg')
  })

  it('omits the MZFM difference when the category has no MZFM', () => {
    const w = mountWith(530, 500, { maxTakeoffMass: 630, maxZeroFuelMass: null })
    expect(w.find('[data-testid="zero-fuel-limit-difference"]').exists()).toBe(false)
    expect(w.find('[data-testid="takeoff-limit-difference"]').exists()).toBe(true)
  })

  it('shows no comparison or scope text without limits or on a failed result', () => {
    expect(mountWith(530, 500, null).find('.result-summary__scope').exists()).toBe(false)
    const failed = mount(ResultSummary, {
      props: { result: { success: false } as unknown as MathCoreResult, limits: defaultLimits, canExport: false },
    })
    expect(failed.find('[data-testid="takeoff-limit-difference"]').exists()).toBe(false)
  })

  it('states the scope and updates synchronously when limits or masses change', async () => {
    const w = mountWith(530, 500, defaultLimits)
    expect(w.get('.result-summary__scope').text()).toContain('not a flight-suitability or Go/No-Go')
    await w.setProps({ limits: { maxTakeoffMass: 500, maxZeroFuelMass: null } })
    expect(w.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Above MTOM by 30.0 kg')
    expect(w.find('[data-testid="zero-fuel-limit-difference"]').exists()).toBe(false)
    await w.setProps({ limits: null })
    expect(w.find('[data-testid="takeoff-limit-difference"]').exists()).toBe(false)
  })

  it('drops a stale comparison when the result becomes null or failed, then shows the new one', async () => {
    const w = mountWith(530, 500, defaultLimits)
    const diff = '[data-testid="takeoff-limit-difference"]'
    expect(w.get(diff).text()).toBe('Below MTOM by 100.0 kg')
    const valid = w.props('result')

    await w.setProps({ result: null })
    expect(w.find(diff).exists()).toBe(false)
    expect(w.find('.result-summary__scope').exists()).toBe(false)

    await w.setProps({ result: valid })
    await w.setProps({ result: { success: false } as unknown as MathCoreResult })
    expect(w.find(diff).exists()).toBe(false)

    await w.setProps({
      result: buildResult({
        takeoffCenterOfGravityPoint: { arm: 1.91, mass: 640, moment: 640 * 1.91 },
      }),
    })
    expect(w.get(diff).text()).toBe('Above MTOM by 10.0 kg')
  })

  it('suppresses numeric comparisons while showLimitDifference is false and restores them', async () => {
    const w = mountWith(530, 500, defaultLimits)
    await w.setProps({ showLimitDifference: false })
    expect(w.find('[data-testid="takeoff-limit-difference"]').exists()).toBe(false)
    expect(w.find('[data-testid="zero-fuel-limit-difference"]').exists()).toBe(false)
    expect(w.find('.result-summary__scope').exists()).toBe(false)
    await w.setProps({ showLimitDifference: true })
    expect(w.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Below MTOM by 100.0 kg')
  })

  it('names no exact-limit cross-check when masses are below or above', () => {
    expect(mountWith(530, 500, defaultLimits).find('[data-testid="exact-limit-cross-check"]').exists()).toBe(false)
    expect(mountWith(630.5, 601.25, defaultLimits).find('[data-testid="exact-limit-cross-check"]').exists()).toBe(false)
  })
})

// Synthetic software vectors (normalized kg), not aircraft data.
describe('ResultSummary — exact-limit cross-check', () => {
  const limits: CategoryLimits = { maxTakeoffMass: 1000, maxZeroFuelMass: 900 }
  const prompt = '[data-testid="exact-limit-cross-check"]'
  function mountWith(takeoff: number, zeroFuel: number, l: CategoryLimits | null = limits) {
    return mount(ResultSummary, {
      props: {
        result: buildResult({
          takeoffCenterOfGravityPoint: { arm: 1.91, mass: takeoff, moment: takeoff * 1.91 },
          zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: zeroFuel, moment: zeroFuel * 1.9 },
        }),
        limits: l,
        canExport: false,
      },
    })
  }

  it.each([
    [979, 'Below MTOM by 21.0 kg'],
    [981, 'Below MTOM by 19.0 kg'],
    [999.96, 'Below MTOM by less than 0.1 kg'],
    [1000.04, 'Above MTOM by 0.1 kg'],
  ])('shows no MTOM prompt for takeoff %s kg (%s)', (takeoff, text) => {
    const w = mountWith(takeoff, 800)
    expect(w.get('[data-testid="takeoff-limit-difference"]').text()).toBe(text)
    expect(w.find(prompt).exists()).toBe(false)
  })

  it('does not infer equality from a rounded mass that displays as the limit', () => {
    const w = mountWith(999.96, 899.96)
    // Conservative mass display rounds up, so both masses read exactly like their limits.
    expect(w.findAll('.result-summary__value')[0]!.text()).toBe('1000.0')
    expect(w.findAll('.result-summary__value')[1]!.text()).toBe('900.0')
    expect(w.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Below MTOM by less than 0.1 kg')
    expect(w.find(prompt).exists()).toBe(false)
  })

  it('prompts once for raw MTOM equality only', () => {
    const w = mountWith(1000, 800)
    expect(w.findAll(prompt)).toHaveLength(1)
    expect(w.get(prompt).text()).toBe(
      'Exactly at MTOM: no arithmetic mass difference remains. Re-check the loading and the entered category/profile limit against the POH/AFM.',
    )
    expect(w.findAll('.result-summary__value')[0]!.classes()).not.toContain('result-summary__value--over')
  })

  it.each([
    [899.96, 'Below MZFM by less than 0.1 kg', ''],
    [900, 'Exactly at MZFM', 'Exactly at MZFM: '],
    [900.04, 'Above MZFM by 0.1 kg', ''],
  ])('relates ZFM %s kg to MZFM by raw value', (zeroFuel, text, promptStart) => {
    const w = mountWith(950, zeroFuel)
    expect(w.get('[data-testid="zero-fuel-limit-difference"]').text()).toBe(text)
    expect(w.find(prompt).exists() ? w.get(prompt).text().slice(0, promptStart.length) : '').toBe(promptStart)
  })

  it('shows one prompt naming MTOM and MZFM when both are exact', () => {
    const w = mountWith(1000, 900)
    expect(w.findAll(prompt)).toHaveLength(1)
    expect(w.get(prompt).text()).toMatch(/^Exactly at MTOM and MZFM: no arithmetic mass difference remains\./)
    expect(w.get(prompt).text()).toContain('category/profile limits against the POH/AFM')
    expect(w.get(prompt).text()).not.toMatch(/payload|suitab/i)
  })

  it('creates no MZFM relation or prompt when the category has no MZFM', () => {
    const w = mountWith(990, 900, { maxTakeoffMass: 1000, maxZeroFuelMass: null })
    expect(w.find('[data-testid="zero-fuel-limit-difference"]').exists()).toBe(false)
    expect(w.find(prompt).exists()).toBe(false)
  })

  it('drops the previous equality when the category limits change', async () => {
    const w = mountWith(1000, 900)
    await w.setProps({ limits: { maxTakeoffMass: 1100, maxZeroFuelMass: 950 } })
    expect(w.find(prompt).exists()).toBe(false)
    expect(w.get('[data-testid="takeoff-limit-difference"]').text()).toBe('Below MTOM by 100.0 kg')
  })

  it('hides the prompt for a pending, failed or absent result and restores it for the current one', async () => {
    const w = mountWith(1000, 900)
    const valid = w.props('result')
    await w.setProps({ showLimitDifference: false })
    expect(w.find(prompt).exists()).toBe(false)
    await w.setProps({ showLimitDifference: true })
    expect(w.find(prompt).exists()).toBe(true)
    await w.setProps({ result: { success: false } as unknown as MathCoreResult })
    expect(w.find(prompt).exists()).toBe(false)
    await w.setProps({ result: null })
    expect(w.find(prompt).exists()).toBe(false)
    await w.setProps({ result: valid })
    expect(w.findAll(prompt)).toHaveLength(1)
  })
})
