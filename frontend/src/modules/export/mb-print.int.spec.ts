import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'
import { mapFleetProfileToContext } from '@/modules/mass-balance/services/fleet-profile.mapper'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import MbPrintPreview from './MbPrintPreview.vue'
import { assembleMbPrint, canPrintMb, type MbPrintSource } from './mb-print'

function source(): MbPrintSource {
  setActivePinia(createPinia())
  const profile = testPohAircraft()
  profile.status = 'draft'
  const store = useMassBalanceStore()
  store.loadProfile(mapFleetProfileToContext(profile))
  return reactive({ state: store.uiState, ready: true, profile, aircraft: store.aircraft,
    category: store.activeCategoryDef, result: store.lastResult, stations: store.availableStations,
    notifications: store.notifications })
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
describe('M&B print presentation with real store calculation', () => {
  it('retains warnings, honest endpoints, units and draft markers without mutating verification', () => {
    const input = source()
    const before = JSON.stringify(input)
    const result = assembleMbPrint(input, new Date('2026-11-14T12:00:00Z'))!
    expect(result.points.map(p => p.label)).toEqual(['Takeoff', 'Zero fuel', 'All usable fuel burned'])
    expect(result.points[0]!.mass).toBe('500.0 kg [UNVERIFIED]')
    expect(result.status).toBe('draft; draft [UNVERIFIED]')
    expect(result.notifications).toEqual(input.notifications.map(({ id, severity, message, context }) => ({ id, severity, message, context })))
    expect(result.generated).toContain('(UTC)')
    expect(JSON.stringify(input)).toBe(before)
  })
  it('normalizes source limits and marks expired and unattributed provenance', () => {
    const input = source()
    input.aircraft!.sourceUnit = 'lb-in'
    input.category!.maxTakeoffMass = 1000
    input.category!.envelope[0] = { mass: 1000, armOrMoment: 40 }
    let result = assembleMbPrint(input, new Date('2026-11-14'))!
    expect(result.mtom).toBe('453.6 kg [UNVERIFIED]')
    expect(result.envelope[0]!.horizontal).toBe('1.016 m [UNVERIFIED]')
    input.profile!.status = 'verified'
    expect(assembleMbPrint(input, new Date('2026-11-14'))!.status).toContain('verified-unattributed [UNVERIFIED]')
    input.profile!.verification = { verifiedOn: '2026-01-01', verifiedBy: 'TEST', pohRevision: 'Synthetic', sourceWeighingDate: '2026-01-01' }
    result = assembleMbPrint(input, new Date('2026-11-14'))!
    expect(result.status).toContain('expired-aged [UNVERIFIED]')
    expect(result.provenance!.revision).toBe('Synthetic')
  })
  it.each(['INITIAL', 'LOADING', 'UNCONFIGURED', 'UNVERIFIED', 'ERROR_CRITICAL'] as const)('blocks retained success in %s', state => {
    const input = source()
    input.state = state
    expect(assembleMbPrint(input, new Date())).toBeNull()
  })
  it('blocks error notifications, pending selection, failed result and incomplete loading', () => {
    const input = source()
    input.ready = false
    expect(canPrintMb(input)).toBe(false)
    input.ready = true
    input.notifications.push({ id: 'test', severity: 'CRITICAL', message: 'Blocked', persistent: false, dismissible: false })
    expect(canPrintMb(input)).toBe(false)
    input.notifications.pop()
    input.result!.success = false
    expect(canPrintMb(input)).toBe(false)
    input.result!.success = true
    input.stations.push({ index: 0, name: 'Missing', weight: 0, mandatory: true, touched: false, verified: false, hasError: false })
    expect(canPrintMb(input)).toBe(false)
  })
  it.each(['loading', 'category', 'aircraft', 'status', 'notifications'] as const)('invalidates open preview on %s and blocks beforeprint', async change => {
    const input = source()
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('500.0 kg')
    if (change === 'loading') input.stations.push({ index: 0, name: 'Added', weight: 10, mandatory: false, touched: true, verified: false, hasError: false })
    if (change === 'category') input.category!.category = 'Utility'
    if (change === 'aircraft') input.aircraft!.registration = 'D-NEXT'
    if (change === 'status') input.state = 'LOADING'
    if (change === 'notifications') input.notifications[0]!.message = 'New warning'
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')).toBe('true')
    await nextTick()
    expect(document.body.textContent).not.toContain('500.0 kg')
    expect(document.body.textContent).toContain('Preview invalidated')
    const print = [...document.querySelectorAll('button')].find(b => b.textContent === 'Print M&B')!
    expect(print.disabled).toBe(true)
    wrapper.unmount()
  })
  it('cancels without changing preparation and rechecks expiry before native Print', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02'))
    const input = source()
    input.profile!.status = 'verified'
    input.profile!.verification = { verifiedOn: '2026-01-01', verifiedBy: 'T', pohRevision: 'Test', sourceWeighingDate: '2026-01-01' }
    const wrapper = mount(MbPrintPreview, { props: { source: input }, attachTo: document.body })
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const before = JSON.stringify(input)
    await wrapper.get('button').trigger('click')
    document.querySelectorAll<HTMLButtonElement>('.mb-print-controls button')[1]!.click()
    expect(print).toHaveBeenCalledOnce()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(JSON.stringify(input)).toBe(before)
    await wrapper.get('button').trigger('click')
    vi.setSystemTime(new Date('2026-11-14'))
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.querySelector('.mb-print-root')?.getAttribute('data-print-invalid')).toBe('true')
    await nextTick()
    expect(document.body.textContent).not.toContain('500.0 kg')
    wrapper.unmount()
    vi.useRealTimers()
  })
})
