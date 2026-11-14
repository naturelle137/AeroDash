/**
 * Store ↔ real adapter for variable-geometry fuel tanks. Imported lookup moments are
 * total tank moments; unusable fuel stays in BEM, so the usable contribution is
 * F(q) − F(u). Vectors are synthetic software references, not aircraft data.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMassBalanceStore } from '../mass-balance.store'
import type { AircraftContext } from '@/core/domain/aircraft.types'
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

const row = (id: string) => vectors.rows.find((r) => r.id === id)!

describe('lookup fuel tank total-moment M&B in the store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it.each(vectors.rows.map((r) => [r.id, r] as const))(
    '%s gives the reviewed SI takeoff mass and moment',
    (_id, r) => {
      const store = useMassBalanceStore()
      store.loadProfile(profile(r))
      const takeoff = store.lastResult!.takeoffCenterOfGravityPoint
      expect(takeoff.mass).toBeCloseTo(r.expectedMassKg, 9)
      expect(takeoff.moment).toBeCloseTo(r.expectedMomentKgM, 9)
      // Nonzero unusable fuel with a nonlinear table differs from the legacy (q − u)·F(q)/q.
      const legacyGap = Math.abs(takeoff.moment - r.legacyMomentKgM)
      expect(r.legacyMomentKgM === r.expectedMomentKgM || legacyGap > 1).toBe(true)
      expect(store.lastResult!.landingCenterOfGravityPoint.moment).toBeCloseTo(1120, 9)
      expect(store.notifications.filter((n) => n.severity === 'ERROR')).toEqual([])
    },
  )

  it('renders the corrected moment on a moment-graph envelope in lb·in', () => {
    const store = useMassBalanceStore()
    store.loadProfile(profile(row('normalized-USG'), 'moment'))
    expect(store.activeEnvelopeSI[2]!.armOrMoment).toBeCloseTo(4000, 9)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.moment).toBeCloseTo(1170, 9)
    expect(store.lastResult!.violations).toEqual([])
  })

  it('blocks q < u visibly, without a stale result, and recovers on correction', () => {
    const store = useMassBalanceStore()
    store.loadProfile(profile(row('nonzero-u-burn-0')))
    expect(store.lastResult).not.toBeNull()
    store.updateStationWeight(0, 9)
    expect(store.lastResult).toBeNull()
    expect(store.uiState).toBe('ERROR_CRITICAL')
    expect(store.stations[0]!.hasError).toBe(true)
    expect(store.notifications).toContainEqual(
      expect.objectContaining({
        id: 'ERR-SYS-001',
        severity: 'ERROR',
        message: expect.stringContaining('Lookup tank (BELOW_UNUSABLE)'),
      }),
    )
    store.updateStationWeight(0, 30)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.moment).toBe(1170)
    expect(store.stations[0]!.hasError).toBe(false)
  })

  it('accepts q = u as zero usable fuel and resets to the unusable floor', () => {
    const store = useMassBalanceStore()
    store.loadProfile(profile(row('nonzero-u-burn-0')))
    store.updateStationWeight(0, 10)
    expect(store.lastResult!.takeoffCenterOfGravityPoint).toEqual({
      arm: 2,
      mass: 560,
      moment: 1120,
    })
    store.updateStationWeight(0, 9)
    store.resetPayload()
    expect(store.stations[0]!.weight).toBe(50)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.moment).toBe(1260)
  })

  it('blocks a load beyond the table without clamping', () => {
    const store = useMassBalanceStore()
    store.loadProfile(profile(row('nonzero-u-burn-0')))
    store.updateStationWeight(0, 60)
    expect(store.lastResult).toBeNull()
    expect(store.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('(LOOKUP_OUT_OF_RANGE)') }),
    )
  })

  it.each([
    [
      'unknown tank unit',
      (p: AircraftContext) => (p.loadPoints[0]!.unit = 'bucket'),
      'UNSUPPORTED_UNIT',
    ],
    [
      'unknown fuel type',
      (p: AircraftContext) => (p.loadPoints[0]!.fuelTank!.permissibleFuelTypes = ['Mystery']),
      'UNSUPPORTED_UNIT',
    ],
    [
      'unknown source unit',
      (p: AircraftContext) => (p.sourceUnit = 'kg-furlong'),
      'UNSUPPORTED_UNIT',
    ],
    [
      'negative raw knot',
      (p: AircraftContext) => (p.loadPoints[0]!.armLookup[0]!.massOrVolume = -1),
      'INVALID_GEOMETRY',
    ],
    [
      'unsorted knots',
      (p: AircraftContext) => p.loadPoints[0]!.armLookup.reverse(),
      'INVALID_GEOMETRY',
    ],
    [
      'singleton table',
      (p: AircraftContext) => p.loadPoints[0]!.armLookup.splice(0, 3),
      'INVALID_GEOMETRY',
    ],
    [
      'table missing unusable coverage',
      (p: AircraftContext) => p.loadPoints[0]!.armLookup.splice(0, 2),
      'LOOKUP_OUT_OF_RANGE',
    ],
    ['fixed arm plus lookup', (p: AircraftContext) => (p.loadPoints[0]!.arm = 1), 'NOT_ALLOWED'],
  ])('blocks %s with a visible validation error', (_label, mutate, code) => {
    const store = useMassBalanceStore()
    const p = profile(row('nonzero-u-burn-20'))
    mutate(p)
    store.loadProfile(p)
    expect(store.lastResult).toBeNull()
    expect(store.uiState).toBe('ERROR_CRITICAL')
    expect(store.notifications).toContainEqual(
      expect.objectContaining({ id: 'ERR-SYS-001', message: expect.stringContaining(`(${code})`) }),
    )
  })

  it('leaves a fixed-arm tank with q < u on its existing behaviour', () => {
    const store = useMassBalanceStore()
    const p = profile(row('nonzero-u-burn-0'))
    p.loadPoints[0]!.arm = 1
    p.loadPoints[0]!.armLookup = []
    store.loadProfile(p)
    expect(store.lastResult!.takeoffCenterOfGravityPoint.moment).toBe(1160)
  })
})
