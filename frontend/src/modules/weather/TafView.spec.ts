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

  it('accepts amended forecasts issued during their validity', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-21T13:30:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ taf: { ...forecast, raw: 'TAF AMD EDDF 211300Z 2112/2218 21005KT 9999', issueTime: '2026-11-21T13:00:00.000Z' } }) }))
    const view = mount(TafView)
    await view.get('#taf-icao').setValue('EDDF')
    await view.get('form').trigger('submit'); await flushPromises()
    expect(view.text()).toContain('TAF AMD EDDF')
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
    vi.stubGlobal('navigator', { onLine: false })
    await view.get('form').trigger('submit')
    expect(view.text()).toContain('Offline: TAF retrieval is unavailable')
    expect(view.text()).not.toContain(forecast.raw)
    view.unmount()
  })
})

it('emits applicable forecast provenance, clears at change boundaries, offline and failed refresh', async () => {
  vi.useFakeTimers().setSystemTime(new Date('2026-11-21T13:59:59Z'))
  const fetchMock = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true, json: async () => ({ taf: { ...forecast, raw: `${forecast.raw} BKN020 TEMPO 2114/2116 4000 RA BKN010` } }) })
  vi.stubGlobal('fetch', fetchMock)
  const view = mount(TafView)
  await view.get('input').setValue('EDDF')
  await view.get('form').trigger('submit'); await flushPromises()
  expect(view.emitted('forecast')!.at(-1)![0]).toMatchObject({ liquid: false })
  await vi.advanceTimersByTimeAsync(1000)
  expect(view.emitted('forecast')!.at(-1)![0]).toEqual({ source: 'TAF', station: 'EDDF', time: forecast.issueTime, validFrom: forecast.validFrom, validTo: forecast.validTo, liquid: true, heavy: false })
  window.dispatchEvent(new Event('offline'))
  expect(view.emitted('forecast')!.at(-1)![0]).toBeNull()
  await view.vm.$nextTick()
  expect(view.text()).toContain('Offline')
  await view.get('form').trigger('submit'); await flushPromises()
  fetchMock.mockRejectedValueOnce(new Error('network'))
  await view.get('form').trigger('submit'); await flushPromises()
  expect(view.emitted('forecast')!.at(-1)![0]).toBeNull()
  view.unmount()
})

it('releases the form offline and ignores an older request after retry', async () => {
  vi.useFakeTimers().setSystemTime(new Date('2026-11-21T13:00:00Z'))
  let resolveOld!: (value: unknown) => void
  let resolveNew!: (value: unknown) => void
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn()
    .mockImplementationOnce(() => new Promise(r => { resolveOld = r }))
    .mockImplementationOnce(() => new Promise(r => { resolveNew = r })))
  const view = mount(TafView)
  await view.get('input').setValue('EDDF')
  await view.get('form').trigger('submit')
  expect((view.get('input').element as HTMLInputElement).disabled).toBe(true)
  vi.stubGlobal('navigator', { onLine: false })
  window.dispatchEvent(new Event('offline'))
  await view.vm.$nextTick()
  expect((view.get('input').element as HTMLInputElement).disabled).toBe(false)
  expect((view.get('button').element as HTMLButtonElement).disabled).toBe(false)
  vi.stubGlobal('navigator', { onLine: true })
  await view.get('form').trigger('submit')
  expect(view.get('[role=status]').text()).toContain('Loading TAF')
  resolveOld({ ok: true, json: async () => ({ taf: forecast }) })
  await flushPromises()
  await view.vm.$nextTick()
  expect(view.get('[role=status]').text()).toContain('Loading TAF')
  expect((view.get('input').element as HTMLInputElement).disabled).toBe(true)
  expect(view.text()).not.toContain(forecast.raw)
  resolveNew({ ok: true, json: async () => ({ taf: forecast }) })
  await flushPromises()
  expect(view.get('[role=status]').text()).toContain('Forecast retrieved')
  expect(view.text()).toContain(forecast.raw)
  view.unmount()
})
