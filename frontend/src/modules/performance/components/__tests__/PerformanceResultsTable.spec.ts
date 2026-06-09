// @UT-PF-VIEW-003@ (FROM: @IMP-PF-VIEW-003@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PerformanceResultsTable from '../PerformanceResultsTable.vue'
import EstimatedMarker from '../EstimatedMarker.vue'
import type { PerformanceResultView } from '../../stores/performance.types'

function makeResult(overrides: Partial<PerformanceResultView> = {}): PerformanceResultView {
  return {
    base: { takeoffRoll: 475, takeoffDistance50ft: 800, landingRoll: 330, landingDistance50ft: 600 },
    estimated: {
      takeoffRoll: false,
      takeoffDistance50ft: false,
      landingRoll: false,
      landingDistance50ft: false,
    },
    takeoff: {
      groundRollRequired: 593.75,
      fullRequired: 1000,
      available: 900,
      marginAbsolute: -100,
      marginPercent: -10,
      insufficient: true,
      appliedOsf: 1.25,
    },
    landing: {
      groundRollRequired: 471.9,
      fullRequired: 858,
      available: 1000,
      marginAbsolute: 142,
      marginPercent: 16.55,
      insufficient: false,
      appliedOsf: 1.43,
    },
    goNoGo: false,
    finalized: true,
    extrapolation: { requiresAcknowledgment: false, benefitCapped: false, penaltyApplied: false },
    clamped: false,
    ...overrides,
  }
}

describe('PerformanceResultsTable', () => {
  it('renders all four distance variables (TOR / TOD / LR / LD)', () => {
    const wrapper = mount(PerformanceResultsTable, { props: { result: makeResult() } })
    const text = wrapper.text()
    expect(text).toContain('TOR')
    expect(text).toContain('TOD')
    expect(text).toContain('LR')
    expect(text).toContain('LD')
  })

  it('shows the safety margin as both absolute distance and percentage', () => {
    const wrapper = mount(PerformanceResultsTable, { props: { result: makeResult() } })
    const ld = wrapper.get('[data-phase="ld"]')
    expect(ld.text()).toContain('142 m')
    expect(ld.text()).toContain('16.5%')
  })

  it('flags an insufficient runway on the affected row', () => {
    const wrapper = mount(PerformanceResultsTable, { props: { result: makeResult() } })
    const tod = wrapper.get('[data-phase="tod"]')
    expect(tod.text()).toMatch(/insufficient/i)
    expect(tod.classes()).toContain('perf-results__row--insufficient')
  })

  it('renders the [ESTIMATED] marker only on estimated values (REQ-PF-017)', () => {
    const wrapper = mount(PerformanceResultsTable, {
      props: {
        result: makeResult({
          estimated: {
            takeoffRoll: false,
            takeoffDistance50ft: true,
            landingRoll: false,
            landingDistance50ft: false,
          },
        }),
      },
    })
    expect(wrapper.findAllComponents(EstimatedMarker)).toHaveLength(1)
    expect(wrapper.get('[data-phase="tod"]').text()).toContain('[ESTIMATED]')
    expect(wrapper.get('[data-phase="tor"]').text()).not.toContain('[ESTIMATED]')
  })

  it('shows no estimated marker when every value is POH-authoritative', () => {
    const wrapper = mount(PerformanceResultsTable, { props: { result: makeResult() } })
    expect(wrapper.findAllComponents(EstimatedMarker)).toHaveLength(0)
  })
})
