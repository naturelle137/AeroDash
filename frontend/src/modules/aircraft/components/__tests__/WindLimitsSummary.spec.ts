// @UT-AC-VIEW-186@ (FROM: @IMP-AC-VIEW-037@, @IMP-AC-VIEW-038@)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WindLimitsSummary from '../WindLimitsSummary.vue'
import type { AircraftProfileWindLimit } from '@/core/adapters/aircraft.schema'

describe('WindLimitsSummary — empty', () => {
  it('shows the empty hint when windLimits is undefined', () => {
    const wrapper = mount(WindLimitsSummary, { props: {} })
    expect(wrapper.find('.wind-limits-summary__empty').exists()).toBe(true)
    expect(wrapper.find('.wind-limits-summary__list').exists()).toBe(false)
  })

  it('shows the empty hint when windLimits is an empty array', () => {
    const wrapper = mount(WindLimitsSummary, { props: { windLimits: [] } })
    expect(wrapper.find('.wind-limits-summary__empty').exists()).toBe(true)
  })

  it('always renders the manual-check note', () => {
    const wrapper = mount(WindLimitsSummary, { props: { windLimits: [] } })
    expect(wrapper.find('.wind-limits-summary__note').text()).toContain('by hand')
  })
})

describe('WindLimitsSummary — populated', () => {
  const limits: AircraftProfileWindLimit[] = [
    { component: 'MaxGust', value: 35, classification: 'Limit' },
    { component: 'MaxCrosswind', value: 15, classification: 'Demonstrated' },
  ]

  it('renders one item per wind limit', () => {
    const wrapper = mount(WindLimitsSummary, { props: { windLimits: limits } })
    expect(wrapper.findAll('.wind-limits-summary__item')).toHaveLength(2)
  })

  it('orders crosswind ahead of gust regardless of input order', () => {
    const wrapper = mount(WindLimitsSummary, { props: { windLimits: limits } })
    const components = wrapper
      .findAll('.wind-limits-summary__component')
      .map((c) => c.text())
    expect(components[0]).toBe('Crosswind')
    expect(components[1]).toBe('Gust')
  })

  it('renders human labels for component, value and classification', () => {
    const wrapper = mount(WindLimitsSummary, {
      props: { windLimits: [{ component: 'MaxCrosswind', value: 15, classification: 'Demonstrated' }] },
    })
    expect(wrapper.find('.wind-limits-summary__component').text()).toBe('Crosswind')
    expect(wrapper.find('.wind-limits-summary__value').text()).toBe('15 kt')
    expect(wrapper.find('.wind-limits-summary__classification').text()).toContain('Demonstrated')
  })

  it('labels a hard limit distinctly and tags the row for colour-independent signalling', () => {
    const wrapper = mount(WindLimitsSummary, {
      props: { windLimits: [{ component: 'MaxCrosswind', value: 20, classification: 'Limit' }] },
    })
    expect(wrapper.find('.wind-limits-summary__classification').text()).toContain('Limit')
    expect(wrapper.find('.wind-limits-summary__item--limit').exists()).toBe(true)
  })
})
