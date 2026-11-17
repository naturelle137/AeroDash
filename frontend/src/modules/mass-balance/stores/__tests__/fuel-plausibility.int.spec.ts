import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as mathAdapter from '@/core/adapters/mass-balance.adapter'
import type { AircraftContext } from '@/core/domain/aircraft.types'
import { useMassBalanceStore } from '../mass-balance.store'

// Synthetic software fixture: BEM includes unusable fuel; all loads remain inside the envelope.
function profile(lookup: boolean): AircraftContext {
  const occupant = {
    name: 'Pilot',
    kind: 'occupant' as const,
    occupancy: 'required' as const,
    arm: 2,
    armLookup: [],
    operationalLimit: null,
    defaultQuantity: 0,
    unit: 'kg',
    allowableCategories: null,
    fuelTank: null,
  }
  return {
    id: 'fuel-plausibility',
    registration: 'D-TEST',
    manufacturer: 'Synthetic',
    model: 'Warning coexistence',
    sourceUnit: 'kg-m',
    status: 'draft',
    weighingReports: [
      { basicEmptyMass: 560, emptyCg: 2, weighingDate: '2026-01-01', validFrom: '2026-01-01' },
    ],
    loadPoints: [
      {
        name: 'Tank',
        kind: 'fuel',
        arm: lookup ? null : 3,
        armLookup: lookup
          ? [
              { massOrVolume: 0, moment: 0 },
              { massOrVolume: 50, moment: 150 },
            ]
          : [],
        operationalLimit: null,
        defaultQuantity: 30,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
      },
      occupant,
      { ...occupant, name: 'Optional passenger', occupancy: 'optional' },
      { ...occupant, name: 'Excluded occupant', allowableCategories: ['Utility'] },
      {
        ...occupant,
        name: 'Baggage',
        kind: 'baggage',
        operationalLimit: 100,
        defaultQuantity: 120,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        maxTakeoffMass: 1000,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { mass: 500, armOrMoment: 0 },
          { mass: 1000, armOrMoment: 0 },
          { mass: 1000, armOrMoment: 4 },
          { mass: 500, armOrMoment: 4 },
        ],
      },
    ],
  } as AircraftContext
}

describe.each([true, false])('raw fuel rejection and occupant warnings (lookup: %s)', (lookup) => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('preserves independent notices and clears only the corrected warning', () => {
    const store = useMassBalanceStore()
    store.loadProfile(profile(lookup))
    expect(store.lastResult?.success).toBe(true)
    expect(store.lastResult?.violations).toEqual([
      { type: 'STATION_LIMIT_EXCEEDED', stationIndex: 4 },
    ])
    const calculate = vi.spyOn(mathAdapter, 'calculateMassBalance')
    const warnings = () => store.notifications.filter((n) => n.id === 'WARN-UQ-001')
    const notices = () => {
      expect(store.notifications.filter((n) => n.id === 'WARN-AC-002')).toHaveLength(1)
      expect(store.notifications.filter((n) => n.id === 'WARN-MB-005')).toHaveLength(1)
    }
    const blocked = () => {
      expect(store.lastResult).toBeNull()
      expect(store.uiState).toBe('ERROR_CRITICAL')
      expect(calculate).not.toHaveBeenCalled()
      expect(store.notifications).toContainEqual(
        expect.objectContaining({
          id: 'ERR-SYS-001',
          severity: 'ERROR',
          message: expect.stringContaining('Tank (BELOW_UNUSABLE)'),
        }),
      )
      notices()
    }
    store.updateStationWeight(0, 9)
    blocked()
    expect(warnings()).toEqual([
      expect.objectContaining({
        severity: 'WARNING',
        message: 'Implausible mass on required station: Pilot — verify input',
      }),
    ])
    store.updateStationWeight(1, 80)
    blocked()
    expect(warnings()).toEqual([])
    store.updateStationWeight(1, 0)
    blocked()
    expect(warnings()).toHaveLength(1)
    store.updateStationWeight(0, 30)
    expect(calculate).toHaveBeenCalledTimes(1)
    expect(store.lastResult?.success).toBe(true)
    expect(warnings()).toHaveLength(1)
    notices()
    store.updateStationWeight(1, 80)
    expect(store.lastResult?.success).toBe(true)
    expect(warnings()).toEqual([])
    notices()
  })
})


describe('adapter validation failure and independent warnings', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('retains and independently clears warnings through failure and recovery', () => {
    const store = useMassBalanceStore()
    const fixture = profile(false)
    fixture.loadPoints[3]!.operationalLimit = 1
    fixture.loadPoints[3]!.defaultQuantity = 2
    store.loadProfile(fixture)
    expect(store.lastResult?.success).toBe(true)
    const calculate = vi.spyOn(mathAdapter, 'calculateMassBalance')
    store.aircraft!.weighingReports[0]!.emptyCg = Infinity
    store.changeCertificationCategory('Normal')
    expect(calculate).toHaveBeenCalled()
    expect(store.lastResult).toBeNull()
    expect(store.uiState).toBe('ERROR_CRITICAL')
    expect(store.notifications).toContainEqual(expect.objectContaining({ id: 'ERR-SYS-001', severity: 'ERROR', message: expect.stringContaining('EMPTY_CG') }))
    const warnings = (id: string) => store.notifications.filter((n) => n.id === id)
    expect(warnings('WARN-UQ-001')).toEqual([expect.objectContaining({ message: expect.stringContaining('Pilot') })])
    expect(warnings('WARN-UQ-001')[0]!.message).not.toContain('Optional passenger')
    expect(warnings('WARN-UQ-001')[0]!.message).not.toContain('Excluded occupant')
    expect(warnings('WARN-MB-005')).toEqual([expect.objectContaining({ message: 'Station 4 limit exceeded' })])
    store.updateStationWeight(1, 80)
    expect(warnings('WARN-UQ-001')).toHaveLength(0)
    expect(warnings('WARN-MB-005')).toHaveLength(1)
    store.updateStationWeight(4, 100)
    expect(warnings('WARN-MB-005')).toHaveLength(0)
    expect(store.lastResult).toBeNull()
    store.updateStationWeight(1, 0)
    store.updateStationWeight(4, 120)
    store.aircraft!.weighingReports[0]!.emptyCg = 2
    store.changeCertificationCategory('Normal')
    expect(store.lastResult?.success).toBe(true)
    expect(warnings('WARN-UQ-001')).toHaveLength(1)
    expect(warnings('WARN-MB-005')).toHaveLength(1)
  })
})
