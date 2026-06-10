// @UT-AP-VIEW-002@ (FROM: @IMP-AP-VIEW-002@)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ManualAirportEntryView from '../ManualAirportEntryView.vue'
import { useManualAirportStore } from '../../stores/manual-airport.store'

vi.mock('../../services/airport.repository', () => ({
  MANUAL_AIRPORT_SCHEMA_VERSION: 1,
  airportRepository: {
    update: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    findAll: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  },
}))

import { airportRepository } from '../../services/airport.repository'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

async function searchUnknownAirport() {
  const wrapper = mount(ManualAirportEntryView)
  await wrapper.find('#icao-search-input').setValue('zzzz')
  await wrapper.find('form.icao-search').trigger('submit')
  return wrapper
}

describe('ManualAirportEntryView', () => {
  it('hides the manual-entry form until a search is run', () => {
    const wrapper = mount(ManualAirportEntryView)
    expect(wrapper.find('.manual-entry').exists()).toBe(false)
  })

  it('switches to manual entry with the ICAO echoed when no airport is found (REQ-AP-003)', async () => {
    const wrapper = await searchUnknownAirport()
    expect(wrapper.find('.manual-entry').exists()).toBe(true)
    expect(wrapper.find('.manual-entry-banner').text()).toContain('ZZZZ')
  })

  it('blocks compute and shows an inline rejection without a surface condition (REQ-AP-004)', async () => {
    const wrapper = await searchUnknownAirport()
    const store = useManualAirportStore()
    store.updateRunway({ toraM: 600 })
    await wrapper.vm.$nextTick()
    await wrapper.find('.actions .btn-primary').trigger('click')
    const rejection = wrapper.find('.compute-rejection')
    expect(rejection.exists()).toBe(true)
    expect(rejection.text()).toMatch(/surface condition/i)
  })

  it('clears the block and signals ready once a surface condition is selected', async () => {
    const wrapper = await searchUnknownAirport()
    const store = useManualAirportStore()
    store.updateRunway({ toraM: 600 })
    await wrapper.find('#runway-surface-condition').setValue('paved-dry')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.compute-rejection').exists()).toBe(false)
    expect(wrapper.find('.compute-ready').exists()).toBe(true)
  })

  it('binds every editable override field back to the store (REQ-AP-006)', async () => {
    const wrapper = await searchUnknownAirport()
    const store = useManualAirportStore()
    await wrapper.find('#airport-name').setValue('Family Strip')
    await wrapper.find('#airport-elevation').setValue('350')
    await wrapper.find('#runway-designator').setValue('27')
    await wrapper.find('#runway-heading').setValue('270')
    await wrapper.find('#runway-surface-type').setValue('grass')
    await wrapper.find('#runway-tora').setValue('600')
    await wrapper.find('#runway-toda').setValue('640')
    await wrapper.find('#runway-asda').setValue('620')
    await wrapper.find('#runway-lda').setValue('580')
    await wrapper.find('#runway-slope').setValue('1.5')
    expect(store.entry?.name).toBe('Family Strip')
    expect(store.entry?.elevationFt).toBe(350)
    expect(store.entry?.runway.designator).toBe('27')
    expect(store.entry?.runway.magneticHeadingDeg).toBe(270)
    expect(store.entry?.runway.baseSurfaceType).toBe('grass')
    expect(store.entry?.runway.toraM).toBe(600)
    expect(store.entry?.runway.todaM).toBe(640)
    expect(store.entry?.runway.asdaM).toBe(620)
    expect(store.entry?.runway.ldaM).toBe(580)
    expect(store.entry?.runway.slopePercent).toBe(1.5)
  })

  it('persists overrides when Save is pressed (REQ-AP-006)', async () => {
    const wrapper = await searchUnknownAirport()
    const store = useManualAirportStore()
    store.updateRunway({ toraM: 600 })
    await wrapper.find('.actions .btn-secondary').trigger('click')
    await flushPromises()
    expect(airportRepository.update).toHaveBeenCalledOnce()
    expect(wrapper.find('.save-confirmation').exists()).toBe(true)
  })
})
