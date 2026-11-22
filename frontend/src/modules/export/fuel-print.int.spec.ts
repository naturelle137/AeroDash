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

function setup(variable = false) {
  setActivePinia(createPinia())
  const profile = testPohAircraft()
  profile.status = 'draft'
  profile.loadPoints = [{ name: 'Synthetic tank', arm: 1, armLookup: [], operationalLimit: 100,
    defaultQuantity: 50, unit: 'kg', allowableCategories: null,
    fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } }]
  if (variable) {
    // Synthetic nonlinear total-moment table with zero unusable fuel.
    profile.loadPoints[0]!.arm = null
    profile.loadPoints[0]!.fuelTank!.unusableFuel = 0
    profile.loadPoints[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }, { massOrVolume: 10, moment: 10 },
      { massOrVolume: 30, moment: 60 }, { massOrVolume: 50, moment: 150 }]
  }
  const store = useMassBalanceStore()
  store.loadProfile(mapFleetProfileToContext(profile))
  let planning: FuelPlanning
  let source: ComputedRef<MbPrintSource>
  const wrapper = mount(defineComponent({ setup() {
    planning = useFuelPlanning()
    source = computed(() => ({ state: store.uiState, ready: true, aircraft: store.aircraft,
      profile, category: store.activeCategoryDef, result: store.lastResult, chartEnvelope: store.activeEnvelopeSI,
      stations: store.availableStations, notifications: store.notifications,
      fuel: planning.presentation.value }))
    return () => h(MbPrintPreview, { source: source.value, readSource: () => source.value })
  } }), { attachTo: document.body })
  return { store, wrapper, planning: planning!, source: source! }
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
describe('shared current fuel print presentation', () => {
  it('includes current plan, retains reserve shortages and markers, cancels without clearing inputs', async () => {
    const { planning: p, source, wrapper } = setup()
    expect(assembleMbPrint(source.value, new Date())!.fuelReason).toContain('Choose a planning method')
    p.method.value = 'duration'
    p.consumption.value = '10'; p.trip.value = '120'; p.reserve.value = '300'
    const fuel = assembleMbPrint(source.value, new Date())!.fuel!
    expect(fuel.warnings).toEqual(['Insufficient fuel for the entered trip plus reserve.', 'Usable fuel is insufficient even for the reserve alone.'])
    expect(fuel.rows).toContainEqual(expect.objectContaining({ label: 'Fuel shortfall', value: '30 kg [UNVERIFIED]', warnings: fuel.warnings }))
    expect(fuel.rows).toContainEqual(expect.objectContaining({ label: 'Estimated arrival mass', value: '520 kg [UNVERIFIED]' }))
    expect(fuel.rows).toContainEqual(expect.objectContaining({ label: 'Usable fuel remaining on arrival', value: '20 kg [UNVERIFIED]' }))
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('Insufficient fuel for the entered trip plus reserve.')
    expect(document.body.textContent).not.toContain('WARN-FE-001')
    document.querySelector<HTMLButtonElement>('.mb-print-controls button')!.click()
    await nextTick()
    expect(p.reserve.value).toBe('300')
    p.trip.value = '240'; p.reserve.value = '0'
    expect(p.presentation.value.warnings).toEqual(['Zero margin: exactly the entered arithmetic budget.'])
    p.trip.value = '241'
    expect(assembleMbPrint(source.value, new Date())!.fuelReason).toBeTruthy()
    wrapper.unmount()
  })
  it('attaches fuel density warnings to available dependent values only', () => {
    const { planning: p, source, store, wrapper } = setup()
    p.method.value = 'duration'; p.consumption.value = '10'; p.trip.value = '120'; p.reserve.value = '30'
    store.notifications.push({ id: 'WARN-FE-002', severity: 'WARNING', message: 'Verify fuel mass', context: 'FuelEndurance.Density', persistent: false, dismissible: true })
    const rows = assembleMbPrint(source.value, new Date())!.fuel!.rows
    expect(rows.find(r => r.label === 'Estimated arrival mass')!.warnings).toContain('Verify fuel mass')
    expect(rows.find(r => r.label === 'Usable fuel')!.warnings).toContain('Verify fuel mass')
    expect(rows.find(r => r.label === 'Trip fuel')!.warnings).not.toContain('Verify fuel mass')
    p.method.value = ''
    expect(assembleMbPrint(source.value, new Date())!.fuel!.rows.map(r => r.label)).toEqual(['Usable fuel', 'Excluded unusable fuel'])
    wrapper.unmount()
  })
  it('includes lookup CG and mass, omits duration outputs in direct mode', () => {
    const { planning: p, source, store, wrapper } = setup()
    p.method.value = 'direct'; p.directTripFuel.value = '20'
    store.aircraft!.loadPoints[0]!.arm = null
    store.aircraft!.loadPoints[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }, { massOrVolume: 100, moment: 100 }]
    const fuel = assembleMbPrint(source.value, new Date())!.fuel!
    expect(fuel.cgReason).toBeNull()
    expect(fuel.rows).toContainEqual(expect.objectContaining({ label: 'Estimated arrival mass', value: '520 kg [UNVERIFIED]' }))
    expect(fuel.rows.map(r => r.label)).not.toContain('Total endurance')
    expect(fuel.warnings).toEqual([])
    for (const raw of ['', '-1', 'NaN', '1e2', '40.001']) {
      p.directTripFuel.value = raw
      expect(assembleMbPrint(source.value, new Date())!.fuelReason).toBeTruthy()
    }
    p.directTripFuel.value = '20'
    store.notifications.push({ id: 'block', severity: 'CRITICAL', message: 'Blocked', persistent: false, dismissible: false })
    expect(assembleMbPrint(source.value, new Date())).toBeNull()
    wrapper.unmount()
  })
  it('prints the same single lookup-tank arrival CG as the screen with profile markers', () => {
    const { planning: p, source, store, wrapper } = setup(true)
    p.method.value = 'direct'; p.directTripFuel.value = '20'
    const result = p.arrivalCg.value
    if (!result?.ok) throw new Error('expected supported lookup arrival CG')
    const takeoff = store.lastResult!.takeoffCenterOfGravityPoint
    expect(result.arrivalMomentKgM).toBeCloseTo(takeoff.moment - (150 - 60), 9)
    const screen = p.presentation.value.rows.find(r => r.label === 'Estimated arrival CG')!
    expect(screen.value).toBe(`${p.format(result.arrivalCgM)} m`)
    const fuel = assembleMbPrint(source.value, new Date())!.fuel!
    expect(fuel.cgReason).toBeNull()
    expect(fuel.rows).toContainEqual(expect.objectContaining({ label: 'Estimated arrival CG', value: `${screen.value} [UNVERIFIED]` }))
    // A load beyond the table blocks M&B, so neither screen CG nor print remains.
    store.updateStationWeight(0, 60)
    expect(store.lastResult).toBeNull()
    expect(p.arrivalCg.value?.ok).not.toBe(true)
    expect(assembleMbPrint(source.value, new Date())).toBeNull()
    store.updateStationWeight(0, 50)
    expect(assembleMbPrint(source.value, new Date())!.fuel!.rows).toContainEqual(expect.objectContaining({ label: 'Estimated arrival CG', value: `${screen.value} [UNVERIFIED]` }))
    wrapper.unmount()
  })
  it.each(['input', 'method', 'sequence', 'loading', 'below-unusable'] as const)('synchronously blocks native print on %s before parent render, never silently falls back', async change => {
    const { planning: p, wrapper, store } = setup()
    p.method.value = 'direct'; p.directTripFuel.value = '20'
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('520 kg [UNVERIFIED]')
    if (change === 'input') p.directTripFuel.value = '21'
    if (change === 'method') p.method.value = 'duration'
    if (change === 'sequence') p.sequence.value = 'New sequence'
    if (change === 'loading') store.updateStationWeight(0, 55)
    if (change === 'below-unusable') {
      store.updateStationWeight(0, 9)
    }
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.querySelector('.mb-print-root')!.getAttribute('data-print-invalid')).toBe('true')
    await nextTick()
    expect(document.body.textContent).not.toContain('520 kg [UNVERIFIED]')
    expect(document.querySelectorAll<HTMLButtonElement>('.mb-print-controls button')[1]!.disabled).toBe(true)
    document.querySelector<HTMLButtonElement>('.mb-print-controls button')!.click()
    await nextTick()
    expect(wrapper.get<HTMLButtonElement>('button').element.disabled).toBe(change === 'below-unusable')
    expect(wrapper.find('[aria-describedby]').exists()).toBe(false)
    if (change === 'below-unusable') store.updateStationWeight(0, 10)
    await nextTick()
    expect(wrapper.get<HTMLButtonElement>('button').element.disabled).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(document.body.textContent).toContain('Flight Preparation Briefing Pack')
    expect(document.body.textContent?.includes('Fuel plan / trip arrival unavailable')).toBe(change === 'method' || change === 'below-unusable')
    wrapper.unmount()
  })
})
