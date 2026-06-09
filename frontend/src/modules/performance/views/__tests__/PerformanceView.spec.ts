// @UT-PF-VIEW-004@ (FROM: @IMP-PF-VIEW-004@)

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/modules/aircraft/services/fleet.repository', () => ({
  fleetRepository: {
    findAllWithDiagnostics:
      vi.fn<() => Promise<{ profiles: unknown[]; diagnostics: unknown[] }>>(),
  },
}))

import { fleetRepository } from '@/modules/aircraft/services/fleet.repository'
import PerformanceView from '../PerformanceView.vue'
import PerformanceResultsTable from '../../components/PerformanceResultsTable.vue'
import ExtrapolationAcknowledgment from '../../components/ExtrapolationAcknowledgment.vue'
import { buildPerformanceAircraft } from '../../__tests__/performance-fixtures'

const mockedRepo = vi.mocked(fleetRepository)
const aircraft = buildPerformanceAircraft()

function seedFleet(profiles: unknown[]): void {
  mockedRepo.findAllWithDiagnostics.mockResolvedValue({
    profiles: profiles as never,
    diagnostics: [],
  })
}

async function selectAircraftAndEnter(
  wrapper: Awaited<ReturnType<typeof mount>>,
  values: { mass: string; pa: string; temp: string; tora: string; lda: string },
): Promise<void> {
  await wrapper.get('select[aria-label="Select aircraft"]').setValue(aircraft.id)
  await wrapper.get('#perf-mass').setValue(values.mass)
  await wrapper.get('#perf-pa').setValue(values.pa)
  await wrapper.get('#perf-temp').setValue(values.temp)
  await wrapper.get('#perf-tora').setValue(values.tora)
  await wrapper.get('#perf-lda').setValue(values.lda)
}

describe('PerformanceView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedFleet([])
  })

  it('shows an empty-state message when no Verified performance aircraft exist', async () => {
    const wrapper = mount(PerformanceView)
    await flushPromises()
    expect(wrapper.text()).toContain('No Verified aircraft with performance data')
  })

  it('computes and renders a GO advisory for a sufficient runway', async () => {
    seedFleet([aircraft])
    const wrapper = mount(PerformanceView)
    await flushPromises()

    await selectAircraftAndEnter(wrapper, {
      mass: '800',
      pa: '5000',
      temp: '25',
      tora: '1200',
      lda: '1000',
    })

    expect(wrapper.findComponent(PerformanceResultsTable).exists()).toBe(true)
    expect(wrapper.text()).toContain('GO — runway sufficient')
  })

  it('surfaces CRIT-PF-002 and a NO-GO advisory for an insufficient runway', async () => {
    seedFleet([aircraft])
    const wrapper = mount(PerformanceView)
    await flushPromises()

    await selectAircraftAndEnter(wrapper, {
      mass: '800',
      pa: '5000',
      temp: '25',
      tora: '900',
      lda: '1000',
    })

    expect(wrapper.text()).toContain('NO-GO — runway insufficient')
    expect(wrapper.find('.notification--critical').exists()).toBe(true)
    expect(wrapper.text()).toContain('CRIT-PF-002')
  })

  it('withholds the advisory behind the extrapolation acknowledgment gate (UJ-C-001)', async () => {
    seedFleet([aircraft])
    const wrapper = mount(PerformanceView)
    await flushPromises()

    await selectAircraftAndEnter(wrapper, {
      mass: '800',
      pa: '5000',
      temp: '54',
      tora: '2000',
      lda: '2000',
    })

    const ack = wrapper.findComponent(ExtrapolationAcknowledgment)
    expect(ack.exists()).toBe(true)
    expect(wrapper.text()).toContain('Advisory withheld')

    await ack.get('button').trigger('click')
    expect(wrapper.findComponent(ExtrapolationAcknowledgment).exists()).toBe(false)
    expect(wrapper.text()).toContain('GO — runway sufficient')
  })
})
