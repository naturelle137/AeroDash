import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WeatherPanel from './WeatherPanel.vue'
import { useWeatherInputsStore } from './stores/weather-inputs.store'

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('WeatherPanel', () => {
  it('validates input and displays an unchanged, attributed observation without changing the input', async () => {
    const now = new Date('2026-11-21T17:00:00Z')
    vi.useFakeTimers().setSystemTime(now)
    const fetchMock = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true, json: async () => ({ metar: { raw: 'EDDF 211620Z AUTO 17004KT CAVOK', station: 'EDDF', reportTime: '2026-11-21T16:20:00Z', reportTimeKnown: true } }) })
    vi.stubGlobal('fetch', fetchMock)
    const view = mount(WeatherPanel)
    const input = view.get('#weather-icao')
    await input.setValue('123')
    await view.get('form').trigger('submit')
    expect(view.get('[role=status]').text()).toContain('four-letter')
    expect(fetchMock).not.toHaveBeenCalled()
    await input.setValue('EDDF')
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(view.text()).toContain('EDDF 211620Z AUTO 17004KT CAVOK')
    expect(view.text()).toContain('2026-11-21T16:20:00.000Z')
    expect(view.text()).toContain('wxdecoder.com')
    expect((input.element as HTMLInputElement).value).toBe('EDDF')
    vi.advanceTimersByTime(20 * 60 * 1000 + 1)
    await view.vm.$nextTick()
    expect(view.get('[role=status]').text()).toContain('Outdated')
    expect(view.text()).toContain('OUTDATED')
    expect(view.findAll('button').some(button => button.text().includes('Replace'))).toBe(false)
    view.unmount()
    vi.useRealTimers()
  })

  it('only emits a current value after the pilot explicitly chooses it', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-21T17:00:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ metar: { raw: 'EDDF 211620Z 17004KT 12/08 Q1013', station: 'EDDF', reportTime: '2026-11-21T16:20:00Z', reportTimeKnown: true } }) }))
    const view = mount(WeatherPanel)
    await view.get('#weather-icao').setValue('EDDF')
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(view.emitted('apply')).toBeUndefined()
    await view.findAll('button').find(button => button.text().includes('Replace temperature'))!.trigger('click')
    expect(view.emitted('apply')?.[0]?.[0]).toBe('temperature')
    view.unmount()
    vi.useRealTimers()
  })

  it('does not offer variable-direction wind while keeping other values available', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-21T17:00:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ metar: { raw: 'EDDF 211620Z 18010KT 140V220 12/08 Q1013', station: 'EDDF', reportTime: '2026-11-21T16:20:00Z', reportTimeKnown: true } }) }))
    const view = mount(WeatherPanel)
    await view.get('#weather-icao').setValue('EDDF')
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(view.text()).toContain('18010KT 140V220')
    expect(view.text()).not.toContain('Replace wind with METAR')
    expect(view.text()).toContain('Replace temperature with METAR')
    expect(view.text()).toContain('Replace QNH with METAR')
    expect(view.emitted('apply')).toBeUndefined()
    view.unmount()
    vi.useRealTimers()
  })

  it('does not request weather while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetchMock = vi.fn<() => Promise<unknown>>()
    vi.stubGlobal('fetch', fetchMock)
    const view = mount(WeatherPanel)
    await view.get('#weather-icao').setValue('EDDF')
    await view.get('form').trigger('submit')
    expect(view.get('[role=status]').text()).toContain('Offline')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('distinguishes stale, empty, malformed and failed responses', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-21T18:00:00Z'))
    const fetchMock = vi.fn<() => Promise<unknown>>()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ metar: { raw: 'EDDF 211620Z AUTO', station: 'EDDF', reportTime: '2026-11-21T16:20:00Z', reportTimeKnown: true } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ metar: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ metar: { raw: 'invalid', station: 'EDDF', reportTime: '2026-11-21T16:20:00Z', reportTimeKnown: true } }) })
      .mockRejectedValueOnce(new Error('network'))
    vi.stubGlobal('fetch', fetchMock)
    const view = mount(WeatherPanel)
    await view.get('#weather-icao').setValue('EDDF')
    for (const expected of ['Outdated', 'No METAR', 'Malformed', 'failed']) {
      await view.get('form').trigger('submit')
      await flushPromises()
      expect(view.get('[role=status]').text()).toContain(expected)
    }
    expect(view.text()).not.toContain('EDDF 211620Z AUTO')
    vi.useRealTimers()
  })
})

it('emits only fresh, structurally plausible present liquid precipitation', async () => {
  vi.useFakeTimers().setSystemTime(new Date('2026-11-21T17:00:00Z'))
  let raw = ''
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ metar: { raw, station: 'EDDF', reportTime: '2026-11-21T16:30:00Z', reportTimeKnown: true } }) })))
  const view = mount(WeatherPanel)
  await view.get('#weather-icao').setValue('EDDF')
  for (const [body, expected] of [['17004KT 9999 -RA BKN020 10/08 Q1013 TEMPO 4000 BR', true], ['17004KT 9999 BKN020 10/08 Q1013 BECMG -RA', false], ['17004KT 9999 +SHRASN BKN020 10/08 Q1013', true], ['17004KT 9999 BKN020 10/08 Q1013', false], ['17004KT 9999 VCSHRA', null], ['17004KT 9999 RMK RA', null], ['17004KT 9999 RA GARBAGE', null], ['17004KT CAVOK RA', null], ['17004KT 9999 TEMPO RA', null], ['17004KT 9999 FZSNRA BKN020 10/08 Q1013', null], ['99904KT 9999 RA BKN020 10/08 Q1013', null], ['17004KT 9999 RA BKN020 10/08 Q0000', null], ['garbage RA', null]] as const) {
    raw = `EDDF 211630Z ${body}`
    await view.get('form').trigger('submit')
    await flushPromises()
    const events = view.emitted('observation')!
    const value = events.at(-1)![0] as { liquid: boolean } | null
    expect(value?.liquid ?? null).toBe(expected)
  }
  vi.advanceTimersByTime(30 * 60 * 1000 + 1)
  await view.vm.$nextTick()
  expect(view.emitted('observation')!.at(-1)![0]).toBeNull()
  view.unmount()
  vi.useRealTimers()
})

describe('WeatherPanel forecast with observation fallback', () => {
  const taf = { raw: 'TAF EDDF 211100Z 2112/2218 21005KT 9999 BKN020', station: 'EDDF', issueTime: '2026-11-21T11:00:00.000Z', validFrom: '2026-11-21T12:00:00.000Z', validTo: '2026-11-22T18:00:00.000Z' }
  const metar = { raw: 'EDDF 211620Z 17004KT 12/08 Q1013', station: 'EDDF', reportTime: '2026-11-21T16:20:00Z', reportTimeKnown: true }
  async function load(data: { taf?: unknown; metar?: unknown }, tafStation = 'EDDF') {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-21T17:00:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    const view = mount(WeatherPanel, { props: { selection: { location: 'EDDF', time: Date.parse('2026-11-21T17:30:00Z'), forecast: {} } } })
    const forms = view.findAll('form')
    for (const [index, id, station] of [[0, '#weather-icao', 'EDDF'], [1, '#taf-icao', tafStation]] as const) {
      await view.get(id).setValue(station)
      await forms[index]!.trigger('submit')
      await flushPromises()
    }
    return view
  }
  const button = (view: ReturnType<typeof mount>, text: string) => view.findAll('button').find(b => b.text().includes(text))

  it('prefers the applicable TAF wind and labels METAR values for the remaining parameters as observations', async () => {
    const view = await load({ taf, metar })
    expect(view.text()).toContain('Forecast wind from TAF EDDF, issued 2026-11-21T11:00:00.000Z')
    expect(view.text()).toContain('valid 2026-11-21T12:00:00.000Z to 2026-11-22T18:00:00.000Z')
    expect(button(view, 'Replace wind with METAR')).toBeUndefined()
    expect(view.text()).toContain('temperature: no forecast available — this is a METAR observation from EDDF')
    expect(view.text()).toContain('qnh: no forecast available — this is a METAR observation')
    expect(view.text()).not.toContain('wind: no forecast available')
    expect(view.emitted('apply')).toBeUndefined()
    await button(view, 'Replace wind with TAF forecast (210 / 5 kt)')!.trigger('click')
    expect(view.emitted('apply')?.[0]).toEqual(['wind', { wind: { direction: '210', speed: '5', unit: 'kt' } }, expect.stringContaining('TAF EDDF via wxdecoder.com, issued 2026-11-21T11:00:00.000Z, valid 2026-11-21T12:00:00.000Z to 2026-11-22T18:00:00.000Z')])
    view.unmount()
  })

  it('falls back to the METAR wind with an explicit label when the TAF is missing', async () => {
    const view = await load({ taf: null, metar })
    expect(button(view, 'TAF forecast')).toBeUndefined()
    expect(button(view, 'Replace wind with METAR')).toBeDefined()
    expect(view.text()).toContain('wind: no forecast available — this is a METAR observation from EDDF, observed 2026-11-21T16:20:00.000Z UTC (40 min ago)')
    view.unmount()
  })

  it('falls back to the METAR wind when the TAF wind is variable, and offers nothing without either source', async () => {
    const variable = await load({ taf: { ...taf, raw: taf.raw.replace('21005KT', 'VRB05KT') }, metar })
    expect(button(variable, 'TAF forecast')).toBeUndefined()
    expect(button(variable, 'Replace wind with METAR')).toBeDefined()
    variable.unmount()
    const none = await load({ taf: null, metar: null })
    expect(none.findAll('button').filter(b => b.text().includes('Replace'))).toHaveLength(0)
    expect(none.text()).not.toContain('no forecast available —')
    none.unmount()
  })


  it('selects FM wind at flight time and restores fallback on station or time changes', async () => {
    const view = await load({ taf: { ...taf, raw: taf.raw + ' FM211800 30012KT 9999 BKN020' }, metar })
    expect(button(view, 'TAF forecast (210 / 5 kt)')).toBeDefined()
    await view.setProps({ selection: { location: 'EDDF', time: Date.parse('2026-11-21T19:00:00Z'), forecast: {} } })
    expect(button(view, 'TAF forecast (300 / 12 kt)')).toBeDefined()
    await view.setProps({ selection: { location: 'EDDM', time: Date.parse('2026-11-21T19:00:00Z'), forecast: {} } })
    expect(button(view, 'TAF forecast')).toBeUndefined()
    expect(button(view, 'Replace wind with METAR')).toBeDefined()
    view.unmount()
  })

  it('labels observation fallback per applicable model parameter', async () => {
    const view = await load({ taf: null, metar })
    for (const forecast of [{ temperature: '12', wind: { direction: '180', speed: '10', unit: 'kt' as const } }, { temperature: '12' }, {}]) {
      await view.setProps({ selection: { location: 'EDDF', time: Date.parse('2026-11-21T19:00:00Z'), forecast } })
      expect(view.text().includes('temperature: no forecast available')).toBe(!forecast.temperature)
      expect(view.text().includes('wind: no forecast available')).toBe(!forecast.wind)
    }
    view.unmount()
  })

  it('warns when the TAF and METAR stations differ', async () => {
    const view = await load({ taf: { ...taf, station: 'EDDM', raw: taf.raw.replace('EDDF', 'EDDM') }, metar }, 'EDDM')
    expect(view.text()).toContain('The METAR station EDDF differs from the TAF station EDDM.')
    view.unmount()
  })

  it('withdraws the TAF wind when its validity ends', async () => {
    const ended = await load({ taf: { ...taf, validTo: '2026-11-21T18:00:00.000Z', raw: taf.raw.replace('2218', '2118') }, metar })
    expect(button(ended, 'TAF forecast')).toBeDefined()
    await ended.setProps({ selection: { location: 'EDDF', time: Date.parse('2026-11-21T18:00:00Z'), forecast: {} } })
    expect(button(ended, 'TAF forecast')).toBeUndefined()
    ended.unmount()
  })
})

describe('WeatherPanel shared inputs', () => {
  it('stores manually typed temperature, wind and QNH in the shared set without a source note', async () => {
    const view = mount(WeatherPanel)
    await view.get('#weather-temperature').setValue('15')
    await view.get('#weather-wind-direction').setValue('270')
    await view.get('#weather-wind-speed').setValue('12')
    await view.get('#weather-qnh').setValue('1013')
    const store = useWeatherInputsStore()
    expect(store.temperature).toBe('15')
    expect(store.wind).toMatchObject({ windDirection: '270', windSpeed: '12', unit: 'kt' })
    expect(store.qnh).toEqual({ qnh: '1013', qnhUnit: 'hPa' })
    expect(view.text()).not.toContain('source:')
  })
  it('clears all shared inputs on request', async () => {
    const view = mount(WeatherPanel)
    await view.get('#weather-temperature').setValue('15')
    await view.findAll('button').find(b => b.text() === 'Clear weather inputs')!.trigger('click')
    expect((view.get('#weather-temperature').element as HTMLInputElement).value).toBe('')
  })
})
