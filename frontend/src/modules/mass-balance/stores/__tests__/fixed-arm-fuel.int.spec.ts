import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import type { AircraftContext } from '@/core/domain/aircraft.types'
import { useMassBalanceStore } from '../mass-balance.store'
import MassStationInput from '../../components/MassStationInput.vue'
import vectors from './lookup-fuel.vectors.json'

type Row = (typeof vectors.rows)[number]
const LB_IN = 0.45359237 * 0.0254

function profile(row: Row, graphType: 'arm' | 'moment' = 'arm'): AircraftContext {
  const imperial = row.sourceUnit === 'lb-in'
  // BEM 560 kg at 2 m, expressed in the profile source unit.
  const bem = imperial ? 560 / 0.45359237 : 560
  const emptyCg = imperial ? 2 / 0.0254 : 2
  const toMass = (kg: number) => (imperial ? kg / 0.45359237 : kg)
  const toX = (si: number) =>
    graphType === 'arm' ? (imperial ? si / 0.0254 : si) : imperial ? si / LB_IN : si
  const [lo, hi] = graphType === 'arm' ? [0, 4] : [0, 4000]
  return {
    id: `lookup-${row.id}`,
    registration: 'D-TEST',
    manufacturer: 'Synthetic',
    model: 'Lookup tank',
    sourceUnit: row.sourceUnit,
    weighingReports: [
      { basicEmptyMass: bem, emptyCg, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Lookup tank',
        arm: null,
        armLookup: row.table.map(([massOrVolume, moment]) => ({
          massOrVolume: massOrVolume!,
          moment: moment!,
        })),
        operationalLimit: null,
        defaultQuantity: row.currentQuantity,
        unit: row.tankUnit,
        allowableCategories: null,
        fuelTank: {
          unusableFuel: row.unusable,
          permissibleFuelTypes: [row.fuelType],
          burnSequences: [],
        },
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        maxTakeoffMass: toMass(1000),
        maxZeroFuelMass: null,
        graphType,
        envelope: [
          { mass: toMass(500), armOrMoment: toX(lo) },
          { mass: toMass(1000), armOrMoment: toX(lo) },
          { mass: toMass(1000), armOrMoment: toX(hi) },
          { mass: toMass(500), armOrMoment: toX(hi) },
        ],
      },
    ],
  } as unknown as AircraftContext
}


function fixedProfile(imperial = false) {
  const p = profile(vectors.rows.find(r => r.id === (imperial ? 'normalized-USG' : 'nonzero-u-burn-0'))!)
  p.loadPoints[0]!.name = 'Fixed tank'
  p.loadPoints[0]!.arm = imperial ? 3 / 0.0254 : 3
  p.loadPoints[0]!.armLookup = []
  return p
}

describe('fixed-arm raw boundary through the real store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it.each([false, true])('recovers at and above u without mutating profile (imperial=%s)', (imperial) => {
    const p = fixedProfile(imperial)
    const original = JSON.stringify(p)
    const store = useMassBalanceStore()
    store.loadProfile(p)
    const unitKg = imperial ? 3.785411784 * 0.72 : 1
    store.updateStationWeight(0, 9 / unitKg)
    expect(store.stations[0]!.weight).toBe(9 / unitKg)
    expect(store.lastResult).toBeNull()
    expect(store.stations[0]!.hasError).toBe(true)
    expect(store.notifications).toContainEqual(expect.objectContaining({
      severity: 'ERROR', message: expect.stringContaining(`Fixed tank (BELOW_UNUSABLE)`),
    }))
    expect(store.notifications[0]!.message).toContain(`Minimum total load is ${p.loadPoints[0]!.fuelTank!.unusableFuel} ${p.loadPoints[0]!.unit}`)
    store.updateStationWeight(0, p.loadPoints[0]!.fuelTank!.unusableFuel)
    expect(store.stations[0]!.hasError).toBe(false)
    expect(store.lastResult!.violations).toEqual([])
    expect(store.lastResult!.takeoffCenterOfGravityPoint.mass).toBeCloseTo(560, 9)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.moment).toBeCloseTo(1120, 9)
    store.updateStationWeight(0, 30 / unitKg)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.mass).toBeCloseTo(580, 9)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.moment).toBeCloseTo(1180, 9)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1180 / 580, 9)
    expect(store.lastResult!.violations).toEqual([])
    expect(JSON.stringify(p)).toBe(original)
  })

  it.each([-1, NaN, Infinity, -Infinity])('blocks raw load and unusable %s before normalization', (value) => {
    const store = useMassBalanceStore()
    store.loadProfile(fixedProfile())
    store.updateStationWeight(0, value)
    expect(store.lastResult).toBeNull()
    expect(store.hasErrorNotification).toBe(true)
    expect(store.stations[0]!.hasError).toBe(true)
    const p = fixedProfile()
    p.loadPoints[0]!.fuelTank!.unusableFuel = value
    store.loadProfile(p)
    expect(store.lastResult).toBeNull()
    expect(store.hasErrorNotification).toBe(true)
  })

  it('blocks a persisted invalid default and ignores category-excluded tanks', () => {
    const store = useMassBalanceStore()
    const p = fixedProfile()
    p.loadPoints[0]!.defaultQuantity = 0
    store.loadProfile(p)
    expect(store.stations[0]!.weight).toBe(0)
    expect(store.lastResult).toBeNull()
    p.loadPoints[0]!.allowableCategories = ['Utility']
    store.loadProfile(p)
    expect(store.lastResult!.takeoffCenterOfGravityPoint).toEqual({ mass: 560, moment: 1120, arm: 2 })
    expect(store.hasErrorNotification).toBe(false)
  })

  it('retains independent errors and station warnings on correction', () => {
    const store = useMassBalanceStore()
    const p = fixedProfile()
    p.loadPoints.push({ ...p.loadPoints[0]!, name: 'Second tank', defaultQuantity: 9 }, {
      ...p.loadPoints[0]!, name: 'Over limit', fuelTank: null, operationalLimit: 1, defaultQuantity: 2,
    })
    store.loadProfile(p)
    store.updateStationWeight(0, 9)
    expect(store.notifications.filter(n => n.severity === 'ERROR')).toHaveLength(2)
    store.updateStationWeight(0, 10)
    expect(store.lastResult).toBeNull()
    expect(store.stations.map(s => s.hasError)).toEqual([false, true, false])
    expect(store.notifications.filter(n => n.severity === 'ERROR')).toHaveLength(1)
    expect(store.notifications.some(n => n.id === 'WARN-MB-005')).toBe(true)
    store.updateStationWeight(1, 10)
    expect(store.lastResult).not.toBeNull()
    expect(store.notifications.some(n => n.id === 'WARN-MB-005')).toBe(true)
  })

  it('retains typed below-minimum quantity for correction through the real field', async () => {
    const store = useMassBalanceStore()
    store.loadProfile(fixedProfile())
    const wrapper = mount(MassStationInput, { props: {
      station: store.stations[0]!, unit: 'kg', unusableFuel: 10,
      'onUpdate:weight': (q: number) => store.updateStationWeight(0, q),
    } })
    await wrapper.get('input[type=text]').setValue('9')
    await wrapper.get('input[type=text]').trigger('blur')
    expect(store.stations[0]!.weight).toBe(9)
    expect(store.lastResult).toBeNull()
    expect(wrapper.get('input[type=text]').attributes('aria-invalid')).toBe('true')
    await wrapper.get('input[type=text]').setValue('10')
    expect(store.lastResult!.takeoffCenterOfGravityPoint).toEqual({ mass: 560, moment: 1120, arm: 2 })
    wrapper.unmount()
  })
})
