import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TafView from './TafView.vue'

const forecast = { raw: 'TAF EDDF 211100Z 2112/2218 21005KT 9999', station: 'EDDF', issueTime: '2026-11-21T11:00:00.000Z', validFrom: '2026-11-21T12:00:00.000Z', validTo: '2026-11-22T18:00:00.000Z' }

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('TAF forecast', () => {
  it('shows the raw forecast and marks expiry at the validity boundary', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-22T17:59:59Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ taf: forecast }) }))
    const view = mount(TafView)
    await view.get('#taf-icao').setValue('EDDF')
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(view.text()).toContain(forecast.raw)
    expect(view.text()).toContain('Unverified')
    expect(view.text()).not.toContain('EXPIRED')
    await vi.advanceTimersByTimeAsync(1000)
    expect(view.text()).toContain('EXPIRED')
    await view.get('#taf-icao').setValue('KJFK')
    expect(view.text()).not.toContain(forecast.raw)
    view.unmount()
  })

  it.each([
    [{ taf: null }, 'No TAF available'],
    [{ taf: { ...forecast, validTo: '2026-11-23T18:00:00.000Z' } }, 'Malformed TAF'],
    [{ taf: { ...forecast, station: 'KJFK' } }, 'Malformed TAF'],
    [{}, 'Malformed TAF'],
  ])('rejects missing or inconsistent responses', async (data, expected) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-21T13:00:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    const view = mount(TafView)
    await view.get('#taf-icao').setValue('EDDF')
    await view.get('form').trigger('submit'); await flushPromises()
    expect(view.get('[role=status]').text()).toContain(expected)
    view.unmount()
  })

  it('validates input and handles network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const view = mount(TafView)
    await view.get('#taf-icao').setValue('12')
    await view.get('form').trigger('submit')
    expect(view.text()).toContain('four-letter')
    await view.get('#taf-icao').setValue('EDDF')
    await view.get('form').trigger('submit'); await flushPromises()
    expect(view.text()).toContain('retrieval failed')
    view.unmount()
  })
})
