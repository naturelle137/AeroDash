import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, nextTick, h, type ComputedRef } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'
import { mapFleetProfileToContext } from '@/modules/mass-balance/services/fleet-profile.mapper'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { useFuelPlanning, type FuelPlanning } from '@/modules/fuel-endurance/services/use-fuel-planning'
import MbPrintPreview from './MbPrintPreview.vue'
import { assembleMbPrint, type MbPrintSource } from './mb-print'

function setup() {
  setActivePinia(createPinia())
  const profile = testPohAircraft()
  profile.status = 'draft'
  profile.loadPoints = [{ name: 'Synthetic tank', arm: 1, armLookup: [], operationalLimit: 100,
    defaultQuantity: 50, unit: 'kg', allowableCategories: null,
    fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } }]
  const store = useMassBalanceStore()
  store.loadProfile(mapFleetProfileToContext(profile))
  let planning: FuelPlanning
  let source: ComputedRef<MbPrintSource>
  const wrapper = mount(defineComponent({ setup() {
    planning = useFuelPlanning()
    source = computed(() => ({ state: store.uiState, ready: true, aircraft: store.aircraft,
      profile, category: store.activeCategoryDef, result: store.lastResult,
      stations: store.availableStations, notifications: store.notifications,
      fuel: planning.presentation.value }))
    return () => h(MbPrintPreview, { source: source.value, readSource: () => source.value })
  } }), { attachTo: document.body })
  return { store, wrapper, planning: planning!, source: source! }
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
describe('shared current fuel print presentation', () => {
  it('starts opt-out, retains reserve shortages and markers, cancels without clearing inputs', async () => {
    const { planning: p, source, wrapper } = setup()
    expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(false)
    expect(assembleMbPrint(source.value, new Date())!.fuel).toBeNull()
    expect(assembleMbPrint(source.value, new Date(), true)).toBeNull()
    p.method.value = 'duration'
    p.consumption.value = '10'; p.trip.value = '120'; p.reserve.value = '300'
    const fuel = assembleMbPrint(source.value, new Date(), true)!.fuel!
    expect(fuel.warnings).toEqual(['WARN-FE-001 — Insufficient fuel for the entered trip plus reserve.', 'Usable fuel is insufficient even for the reserve alone.'])
    expect(fuel.rows).toContainEqual({ label: 'Fuel shortfall', value: '30 kg [UNVERIFIED]' })
    expect(fuel.rows).toContainEqual({ label: 'Estimated arrival mass', value: '520 kg [UNVERIFIED]' })
    expect(fuel.rows).toContainEqual({ label: 'Usable fuel remaining on arrival', value: '20 kg [UNVERIFIED]' })
    await wrapper.get('input').setValue(true)
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('WARN-FE-001')
    document.querySelector<HTMLButtonElement>('.mb-print-controls button')!.click()
    await nextTick()
    expect(p.reserve.value).toBe('300')
    p.trip.value = '240'; p.reserve.value = '0'
    expect(p.presentation.value.warnings).toEqual(['Zero margin: exactly the entered arithmetic budget.'])
    p.trip.value = '241'
    expect(assembleMbPrint(source.value, new Date(), true)).toBeNull()
    wrapper.unmount()
  })
  it('preserves unsupported CG reason and mass, omits duration outputs in direct mode', () => {
    const { planning: p, source, store, wrapper } = setup()
    p.method.value = 'direct'; p.directTripFuel.value = '20'
    store.aircraft!.loadPoints[0]!.arm = null
    store.aircraft!.loadPoints[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }, { massOrVolume: 100, moment: 100 }]
    const fuel = assembleMbPrint(source.value, new Date(), true)!.fuel!
    expect(fuel.cgReason).toContain('Variable-arm tanks')
    expect(fuel.rows).toContainEqual({ label: 'Estimated arrival mass', value: '520 kg [UNVERIFIED]' })
    expect(fuel.rows.map(r => r.label)).not.toContain('Total endurance')
    expect(fuel.warnings).toEqual([])
    for (const raw of ['', '-1', 'NaN', '1e2', '40.001']) {
      p.directTripFuel.value = raw
      expect(assembleMbPrint(source.value, new Date(), true)).toBeNull()
    }
    p.directTripFuel.value = '20'
    store.notifications.push({ id: 'block', severity: 'CRITICAL', message: 'Blocked', persistent: false, dismissible: false })
    expect(assembleMbPrint(source.value, new Date(), true)).toBeNull()
    wrapper.unmount()
  })
  it.each(['input', 'method', 'sequence', 'loading'] as const)('synchronously blocks native print on %s before parent render, never silently falls back', async change => {
    const { planning: p, wrapper, store } = setup()
    p.method.value = 'direct'; p.directTripFuel.value = '20'
    await wrapper.get('input').setValue(true)
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('520 kg [UNVERIFIED]')
    if (change === 'input') p.directTripFuel.value = '21'
    if (change === 'method') p.method.value = 'duration'
    if (change === 'sequence') p.sequence.value = 'New sequence'
    if (change === 'loading') store.updateStationWeight(0, 55)
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.querySelector('.mb-print-root')!.getAttribute('data-print-invalid')).toBe('true')
    await nextTick()
    expect(document.body.textContent).not.toContain('520 kg [UNVERIFIED]')
    expect(document.querySelectorAll<HTMLButtonElement>('.mb-print-controls button')[1]!.disabled).toBe(true)
    document.querySelector<HTMLButtonElement>('.mb-print-controls button')!.click()
    await nextTick()
    expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('button').element.disabled).toBe(change === 'method')
    await wrapper.get('input').setValue(false)
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('Mass & Balance only')
    wrapper.unmount()
  })
})
