import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WeatherPanel from './WeatherPanel.vue'

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
    vi.useRealTimers()
  })

  it('does not request weather while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetchMock = vi.fn<() => Promise<unknown>>()
    vi.stubGlobal('fetch', fetchMock)
    const view = mount(WeatherPanel)
    await view.get('input').setValue('EDDF')
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
    await view.get('input').setValue('EDDF')
    for (const expected of ['Outdated', 'No METAR', 'Malformed', 'failed']) {
      await view.get('form').trigger('submit')
      await flushPromises()
      expect(view.get('[role=status]').text()).toContain(expected)
    }
    expect(view.text()).not.toContain('EDDF 211620Z AUTO')
    vi.useRealTimers()
  })
})
