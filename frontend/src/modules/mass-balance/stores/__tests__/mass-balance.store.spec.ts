import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMassBalanceStore } from '../mass-balance.store'
import type { AircraftContext } from '@/core/domain/aircraft.types'
import type { MathCoreResult, Violation } from '@/core/domain/mass-balance.math-types'

vi.mock('@/core/adapters/mass-balance.adapter', () => ({
  calculateMassBalance: vi.fn<(input: unknown) => MathCoreResult>(),
}))

import { calculateMassBalance } from '@/core/adapters/mass-balance.adapter'

const mockedCalculate = vi.mocked(calculateMassBalance)

function buildSuccessResult(overrides: Partial<MathCoreResult> = {}): MathCoreResult {
  return {
    success: true,
    violations: [],
    zeroFuelCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    takeoffCenterOfGravityPoint: { arm: 1.91, mass: 530, moment: 1012.3 },
    landingCenterOfGravityPoint: { arm: 1.9, mass: 500, moment: 950 },
    migrationPath: [
      { arm: 1.91, mass: 530, label: 'Takeoff' },
      { arm: 1.9, mass: 500, label: 'Landing' },
    ],
    ...overrides,
  }
}

function buildViolationResult(violations: Violation[]): MathCoreResult {
  return buildSuccessResult({ violations })
}

const mockProfile: AircraftContext = {
  id: 'tecnam-p2008',
  registration: 'D-ELUX',
  manufacturer: 'Tecnam',
  model: 'P2008 JC',
  sourceUnit: 'kg',
  weighingReports: [
    {
      basicEmptyMass: 433,
      emptyCg: 1.877,
      weighingDate: '2025-01-01',
      validFrom: '2025-01-01',
    },
  ],
  loadPoints: [
    {
      name: 'Pilot & Passenger',
      arm: 1.8,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
    {
      name: 'Fuel',
      arm: 2.209,
      armLookup: [],
      operationalLimit: 75,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: {
        unusableFuel: 3,
        permissibleFuelTypes: ['MOGAS', 'AVGAS'],
        burnSequences: [],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      maxTakeoffMass: 630,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.841, mass: 433 },
        { armOrMoment: 1.841, mass: 630 },
        { armOrMoment: 1.978, mass: 630 },
        { armOrMoment: 1.978, mass: 433 },
      ],
    },
  ],
}

const multiCatProfile: AircraftContext = {
  ...mockProfile,
  id: 'klemm-107b',
  loadPoints: [
    {
      name: 'Front Seats',
      arm: 1.5,
      armLookup: [],
      operationalLimit: 170,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: null,
    },
    {
      name: 'Rear Seats',
      arm: 2.4,
      armLookup: [],
      operationalLimit: 170,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: ['Normal', 'Utility'],
      fuelTank: null,
    },
    {
      name: 'Fuel',
      arm: 1.9,
      armLookup: [],
      operationalLimit: 60,
      defaultQuantity: 0,
      unit: 'kg',
      allowableCategories: null,
      fuelTank: {
        unusableFuel: 2,
        permissibleFuelTypes: ['AVGAS'],
        burnSequences: [],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      maxTakeoffMass: 700,
      maxZeroFuelMass: 650,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.6, mass: 400 },
        { armOrMoment: 1.6, mass: 700 },
        { armOrMoment: 2.1, mass: 700 },
        { armOrMoment: 2.1, mass: 400 },
      ],
    },
    {
      category: 'Aerobatic',
      maxTakeoffMass: 600,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.6, mass: 400 },
        { armOrMoment: 1.6, mass: 600 },
        { armOrMoment: 1.9, mass: 600 },
        { armOrMoment: 1.9, mass: 400 },
      ],
    },
  ],
}

describe('MassBalance Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedCalculate.mockReturnValue(buildSuccessResult())
  })

  // ─── Initialization ───────────────────────────────────────────────────

  // @UT-MB-STORE-001@ (FROM: @IMP-MB-STORE-012@)
  it('starts in INITIAL state with null aircraft', () => {
    const store = useMassBalanceStore()
    expect(store.uiState).toBe('INITIAL')
    expect(store.aircraft).toBeNull()
    expect(store.activeCategory).toBeNull()
    expect(store.stations).toEqual([])
    expect(store.notifications).toEqual([])
    expect(store.lastResult).toBeNull()
  })

  // ─── loadProfile ──────────────────────────────────────────────────────

  // @UT-MB-STORE-002@ (FROM: @IMP-MB-STORE-005@, @IMP-MB-STORE-014@)
  it('transitions to VERIFIED_SAFE after loading profile with zero-weight mandatory defaults', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.aircraft).toStrictEqual(mockProfile)
    expect(store.activeCategory).toBe('Normal')
    expect(store.stations).toHaveLength(2)
    expect(store.uiState).toBe('VERIFIED_SAFE')
    expect(store.allMandatoryFieldsPopulated).toBe(true)
  })

  // @UT-MB-STORE-003@ (FROM: @IMP-MB-STORE-005@, @IMP-MB-STORE-014@)
  it('initializes station inputs from load point definitions', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.stations[0]).toEqual({
      index: 0,
      name: 'Pilot & Passenger',
      weight: 0,
      verified: false,
      mandatory: true,
      touched: true,
      hasError: false,
    })
    expect(store.stations[1]).toEqual({
      index: 1,
      name: 'Fuel',
      weight: 0,
      verified: false,
      mandatory: false,
      touched: false,
      hasError: false,
    })
  })

  // @UT-MB-STORE-004@ (FROM: @IMP-MB-STORE-005@)
  it('defaults to the first certification category', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)

    expect(store.activeCategory).toBe('Normal')
  })

  // @UT-MB-STORE-005@ (FROM: @IMP-MB-STORE-005@)
  it('sets activeCategory to null when profile has no certification categories', () => {
    const emptyCatProfile: AircraftContext = {
      ...mockProfile,
      certificationCategories: [],
    }
    const store = useMassBalanceStore()
    store.loadProfile(emptyCatProfile)

    expect(store.activeCategory).toBeNull()
    expect(store.uiState).toBe('INITIAL')
  })

  // @UT-MB-STORE-006@ (FROM: @IMP-MB-STORE-005@)
  it('shows CRITICAL notification when calculation throws during profile load', () => {
    mockedCalculate.mockImplementation(() => {
      throw new Error('Corrupted data')
    })

    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.uiState).toBe('ERROR_CRITICAL')
    expect(store.aircraft).not.toBeNull()
    expect(store.lastResult).toBeNull()
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]!.severity).toBe('CRITICAL')
    expect(store.notifications[0]!.message).toContain('Calculation failed')
  })

  // @UT-MB-STORE-007@ (FROM: @IMP-MB-STORE-005@, @IMP-MB-STORE-013@)
  it('runs initial calculation on profile load', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(mockedCalculate).toHaveBeenCalledTimes(1)
  })

  // ─── updateStationWeight ──────────────────────────────────────────────

  // @UT-MB-STORE-008@ (FROM: @IMP-MB-STORE-006@, @IMP-MB-STORE-012@)
  it('transitions to VERIFIED_SAFE after mandatory fields are populated', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.stations[0]!.weight).toBe(80)
    expect(store.allMandatoryFieldsPopulated).toBe(true)
    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // @UT-MB-STORE-009@ (FROM: @IMP-MB-STORE-006@)
  it('ignores updateStationWeight for invalid station index', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    const callCountBefore = mockedCalculate.mock.calls.length
    store.updateStationWeight(99, 80)
    expect(mockedCalculate.mock.calls.length).toBe(callCountBefore)
  })

  // @UT-MB-STORE-010@ (FROM: @IMP-MB-STORE-006@, @IMP-MB-STORE-013@)
  it('recalculates after weight change', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    mockedCalculate.mockClear()

    store.updateStationWeight(0, 80)
    expect(mockedCalculate).toHaveBeenCalledTimes(1)
  })

  // ─── changeCertificationCategory ──────────────────────────────────────

  // @UT-MB-STORE-011@ (FROM: @IMP-MB-STORE-007@)
  it('changes category and recalculates', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)
    mockedCalculate.mockClear()

    store.changeCertificationCategory('Aerobatic')
    expect(store.activeCategory).toBe('Aerobatic')
    expect(mockedCalculate).toHaveBeenCalledTimes(1)
  })

  // @UT-MB-STORE-012@ (FROM: @IMP-MB-STORE-007@)
  it('ignores changeCertificationCategory for non-existent category', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    mockedCalculate.mockClear()

    store.changeCertificationCategory('NonExistent')
    expect(store.activeCategory).toBe('Normal')
    expect(mockedCalculate).not.toHaveBeenCalled()
  })

  // @UT-MB-STORE-013@ (FROM: @IMP-MB-STORE-007@)
  it('ignores changeCertificationCategory when no aircraft loaded', () => {
    const store = useMassBalanceStore()
    store.changeCertificationCategory('Normal')
    expect(store.activeCategory).toBeNull()
  })

  // ─── markFieldVerified / markAllVerified ───────────────────────────────

  // @UT-MB-STORE-014@ (FROM: @IMP-MB-STORE-008@)
  it('marks a single field verified', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    store.markFieldVerified(0)
    expect(store.stations[0]!.verified).toBe(true)
    expect(store.stations[1]!.verified).toBe(false)
  })

  // @UT-MB-STORE-015@ (FROM: @IMP-MB-STORE-008@)
  it('ignores markFieldVerified for invalid station index', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.markFieldVerified(99)
    expect(store.stations.every((s) => !s.verified)).toBe(true)
  })

  // @UT-MB-STORE-016@ (FROM: @IMP-MB-STORE-009@)
  it('markAllVerified sets verified flag on all available mandatory stations', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.allFieldsVerified).toBe(false)
    store.markAllVerified()
    expect(store.allFieldsVerified).toBe(true)
    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // @UT-MB-STORE-017@ (FROM: @IMP-MB-STORE-009@)
  it('markAllVerified only affects available stations', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)
    store.changeCertificationCategory('Aerobatic')

    store.markAllVerified()
    const aerobStations = store.availableStations
    expect(aerobStations.every((s) => s.verified)).toBe(true)
    expect(store.stations[1]!.verified).toBe(false)
  })

  // ─── resetPayload ─────────────────────────────────────────────────────

  // @UT-MB-STORE-018@ (FROM: @IMP-MB-STORE-010@)
  it('resets all weights to zero, re-runs calculation, and keeps results visible', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    store.resetPayload()
    expect(store.stations.every((s) => s.weight === 0)).toBe(true)
    expect(store.stations.every((s) => !s.verified)).toBe(true)
    expect(store.stations.every((s) => s.touched)).toBe(true)
    expect(store.lastResult).not.toBeNull()
    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // ─── _runCalculation ──────────────────────────────────────────────────

  // @UT-MB-STORE-019@ (FROM: @IMP-MB-STORE-013@)
  it('clears results when no active category definition exists', () => {
    const noCatProfile: AircraftContext = {
      ...mockProfile,
      certificationCategories: [],
    }
    const store = useMassBalanceStore()
    store.loadProfile(noCatProfile)

    expect(store.notifications).toEqual([])
    expect(store.lastResult).toBeNull()
  })

  // @UT-MB-STORE-020@ (FROM: @IMP-MB-STORE-013@)
  it('emits CRIT-SYS-001 and clears lastResult when no weighing reports exist', () => {
    const noReportProfile: AircraftContext = {
      ...mockProfile,
      weighingReports: [],
    }
    const store = useMassBalanceStore()
    store.loadProfile(noReportProfile)

    expect(store.notifications).toContainEqual({
      id: 'CRIT-SYS-001',
      severity: 'CRITICAL',
      message: 'No valid weighing report found',
      context: 'System',
      dismissible: true,
      persistent: false,
    })
    expect(store.lastResult).toBeNull()
  })

  // @UT-MB-STORE-021@ (FROM: @IMP-MB-STORE-013@)
  it('selects the most recent weighing report by validFrom', () => {
    const multiReportProfile: AircraftContext = {
      ...mockProfile,
      weighingReports: [
        { basicEmptyMass: 430, emptyCg: 1.87, weighingDate: '2024-01-01', validFrom: '2024-01-01' },
        { basicEmptyMass: 435, emptyCg: 1.88, weighingDate: '2025-06-01', validFrom: '2025-06-01' },
      ],
    }
    const store = useMassBalanceStore()
    store.loadProfile(multiReportProfile)

    expect(mockedCalculate).toHaveBeenCalledWith(
      expect.objectContaining({
        basicEmptyMass: 435,
        emptyCenterOfGravity: 1.88,
      }),
    )
  })

  // ─── Notification Mapping ─────────────────────────────────────────────

  // @UT-MB-STORE-022@ (FROM: @IMP-MB-STORE-011@)
  it('maps MTOM_EXCEEDED violation to CRIT-MB-002 notification', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'MTOM_EXCEEDED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.notifications).toContainEqual({
      id: 'CRIT-MB-002',
      severity: 'CRITICAL',
      message: 'MTOM Exceeded',
      context: 'MassBalance.TotalMass',
      dismissible: true,
      persistent: false,
    })
  })

  // @UT-MB-STORE-023@ (FROM: @IMP-MB-STORE-011@)
  it('maps MZFM_EXCEEDED violation to CRIT-MB-004 notification', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'MZFM_EXCEEDED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.notifications).toContainEqual({
      id: 'CRIT-MB-004',
      severity: 'CRITICAL',
      message: 'MZFM Exceeded',
      context: 'MassBalance.ZFM',
      dismissible: true,
      persistent: false,
    })
  })

  // @UT-MB-STORE-024@ (FROM: @IMP-MB-STORE-011@)
  it('maps CG_OUT_OF_ENVELOPE violation to CRIT-MB-001 notification', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'CG_OUT_OF_ENVELOPE' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.notifications).toContainEqual({
      id: 'CRIT-MB-001',
      severity: 'CRITICAL',
      message: 'CG Out of Envelope',
      context: 'MassBalance.CG',
      dismissible: true,
      persistent: false,
    })
  })

  // @UT-MB-STORE-025@ (FROM: @IMP-MB-STORE-011@)
  it('maps CG_MIGRATION_EXCEEDED violation to CRIT-MB-003 notification', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'CG_MIGRATION_EXCEEDED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.notifications).toContainEqual({
      id: 'CRIT-MB-003',
      severity: 'CRITICAL',
      message: 'CG Migration Limit Exceeded',
      context: 'MassBalance.CG',
      dismissible: true,
      persistent: false,
    })
  })

  // @UT-MB-STORE-026@ (FROM: @IMP-MB-STORE-011@)
  it('maps STATION_LIMIT_EXCEEDED violation to WARN-MB-005 warning', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'STATION_LIMIT_EXCEEDED', stationIndex: 2 }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.notifications).toContainEqual({
      id: 'WARN-MB-005',
      severity: 'WARNING',
      message: 'Station 2 limit exceeded',
      context: 'MassBalance.Stations',
      dismissible: true,
      persistent: false,
    })
  })

  // @UT-MB-STORE-027@ (FROM: @IMP-MB-STORE-011@)
  it('maps STATION_LIMIT_EXCEEDED without stationIndex gracefully', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'STATION_LIMIT_EXCEEDED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.notifications).toContainEqual({
      id: 'WARN-MB-005',
      severity: 'WARNING',
      message: 'Station  limit exceeded',
      context: 'MassBalance.Stations',
      dismissible: true,
      persistent: false,
    })
  })

  // @UT-MB-STORE-028@ (FROM: @IMP-MB-STORE-011@)
  it('maps INVALID_INPUT violation to ERR-SYS-001 error notification', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'INVALID_INPUT', field: 'STATIONS[0].ARM', code: 'REQUIRED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.notifications).toContainEqual({
      id: 'ERR-SYS-001',
      severity: 'ERROR',
      message: 'Invalid input: STATIONS[0].ARM (REQUIRED)',
      context: 'MassBalance.Validation',
      dismissible: true,
      persistent: false,
    })
  })

  // ─── evaluateState (State Machine) ────────────────────────────────────

  // @UT-MB-STORE-029@ (FROM: @IMP-MB-STORE-012@)
  it('evaluates to INITIAL when no aircraft is loaded', () => {
    const store = useMassBalanceStore()
    store.evaluateState()
    expect(store.uiState).toBe('INITIAL')
  })

  // @UT-MB-STORE-030@ (FROM: @IMP-MB-STORE-012@)
  it('evaluates to UNCONFIGURED when mandatory fields are missing', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.stations[0]!.touched = false
    store.evaluateState()
    expect(store.uiState).toBe('UNCONFIGURED')
  })

  // @UT-MB-STORE-031@ (FROM: @IMP-MB-STORE-012@)
  it('evaluates to ERROR_CRITICAL when critical notifications exist', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'MTOM_EXCEEDED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.hasCriticalNotification).toBe(true)
    expect(store.uiState).toBe('ERROR_CRITICAL')
  })

  // @UT-MB-STORE-032@ (FROM: @IMP-MB-STORE-012@)
  it('evaluates to WARNING when only warning notifications exist', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'STATION_LIMIT_EXCEEDED', stationIndex: 0 }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.hasWarningNotification).toBe(true)
    expect(store.hasCriticalNotification).toBe(false)
    expect(store.uiState).toBe('WARNING')
  })

  // @UT-MB-STORE-033@ (FROM: @IMP-MB-STORE-012@)
  it('evaluates to VERIFIED_SAFE when all mandatory fields populated and no violations (no explicit verification required for M&B inputs)', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.allMandatoryFieldsPopulated).toBe(true)
    // allFieldsVerified is false — station was not explicitly marked; the state
    // machine intentionally does not gate on this for manually-entered M&B fields.
    expect(store.allFieldsVerified).toBe(false)
    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // @UT-MB-STORE-034@ (FROM: @IMP-MB-STORE-012@)
  it('evaluates to VERIFIED_SAFE when all mandatory fields populated and no violations', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // @UT-MB-STORE-035@ (FROM: @IMP-MB-STORE-012@)
  it('ERROR_CRITICAL takes priority over WARNING', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([
        { type: 'MTOM_EXCEEDED' },
        { type: 'STATION_LIMIT_EXCEEDED', stationIndex: 0 },
      ]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.hasCriticalNotification).toBe(true)
    expect(store.hasWarningNotification).toBe(true)
    expect(store.uiState).toBe('ERROR_CRITICAL')
  })

  // ─── Getters ──────────────────────────────────────────────────────────

  // @UT-MB-STORE-036@ (FROM: @IMP-MB-STORE-003@)
  it('activeCategoryDef returns null when no aircraft loaded', () => {
    const store = useMassBalanceStore()
    expect(store.activeCategoryDef).toBeNull()
  })

  // @UT-MB-STORE-037@ (FROM: @IMP-MB-STORE-003@)
  it('activeCategoryDef returns null when activeCategory is null', () => {
    const store = useMassBalanceStore()
    store.loadProfile({ ...mockProfile, certificationCategories: [] })
    expect(store.activeCategoryDef).toBeNull()
  })

  // @UT-MB-STORE-038@ (FROM: @IMP-MB-STORE-003@)
  it('activeCategoryDef returns the category matching activeCategory, not just the first', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)

    expect(store.activeCategoryDef!.category).toBe('Normal')
    expect(store.activeCategoryDef!.maxTakeoffMass).toBe(700)

    store.changeCertificationCategory('Aerobatic')
    expect(store.activeCategoryDef!.category).toBe('Aerobatic')
    expect(store.activeCategoryDef!.maxTakeoffMass).toBe(600)
  })

  // @UT-MB-STORE-039@ (FROM: @IMP-MB-STORE-004@)
  it('availableStations returns empty when no aircraft loaded', () => {
    const store = useMassBalanceStore()
    expect(store.availableStations).toEqual([])
  })

  // @UT-MB-STORE-040@ (FROM: @IMP-MB-STORE-004@)
  it('availableStations filters by active category', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)

    store.changeCertificationCategory('Aerobatic')
    const available = store.availableStations
    expect(available).toHaveLength(2)
    expect(available.map((s) => s.name)).toEqual(['Front Seats', 'Fuel'])
  })

  // @UT-MB-STORE-041@ (FROM: @IMP-MB-STORE-004@)
  it('availableStations includes stations with null allowableCategories', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)

    const available = store.availableStations
    const frontSeats = available.find((s) => s.name === 'Front Seats')
    expect(frontSeats).toBeDefined()
  })

  // @UT-MB-STORE-042@ (FROM: @IMP-MB-STORE-004@)
  it('availableStations includes stations in Normal and Utility category', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)

    const available = store.availableStations
    expect(available).toHaveLength(3)
    expect(available.map((s) => s.name)).toEqual(['Front Seats', 'Rear Seats', 'Fuel'])
  })

  // @UT-MB-STORE-051@ (FROM: @IMP-MB-STORE-004@)
  it('availableStations returns empty when aircraft is loaded but activeCategory is null', () => {
    const store = useMassBalanceStore()
    store.loadProfile({ ...mockProfile, certificationCategories: [] })
    expect(store.activeCategory).toBeNull()
    expect(store.availableStations).toEqual([])
  })

  // @UT-MB-STORE-052@ (FROM: @IMP-MB-STORE-004@, @IMP-MB-STORE-014@)
  it('allMandatoryFieldsPopulated is false when only some mandatory stations are touched', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)
    store.stations[1]!.touched = false

    store.updateStationWeight(0, 80)
    expect(store.stations[0]!.touched).toBe(true)
    expect(store.stations[1]!.touched).toBe(false)
    expect(store.allMandatoryFieldsPopulated).toBe(false)

    store.updateStationWeight(1, 70)
    expect(store.stations[1]!.touched).toBe(true)
    expect(store.allMandatoryFieldsPopulated).toBe(true)
  })

  // @UT-MB-STORE-053@ (FROM: @IMP-MB-STORE-004@)
  it('allFieldsVerified only requires mandatory stations to be verified', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    // Before any verification: mandatory station[0] unverified → false
    expect(store.allFieldsVerified).toBe(false)

    // Verifying only the mandatory station (Pilot & Passenger) is sufficient
    store.markFieldVerified(0)
    expect(store.allFieldsVerified).toBe(true)

    // Optional station (Fuel) is still unverified — allFieldsVerified remains true
    expect(store.stations[1]!.verified).toBe(false)
    expect(store.allFieldsVerified).toBe(true)
  })

  // @UT-MB-STORE-054@ (FROM: @IMP-MB-STORE-012@)
  it('hasWarningNotification is false when only CRITICAL notifications exist', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'MTOM_EXCEEDED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.hasCriticalNotification).toBe(true)
    expect(store.hasWarningNotification).toBe(false)
  })

  // @UT-MB-STORE-055@ (FROM: @IMP-MB-STORE-012@)
  it('hasCriticalNotification is false when only WARNING notifications exist', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'STATION_LIMIT_EXCEEDED', stationIndex: 0 }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.hasCriticalNotification).toBe(false)
    expect(store.hasWarningNotification).toBe(true)
  })

  // @UT-MB-STORE-056@ (FROM: @IMP-MB-STORE-011@, @IMP-MB-STORE-012@)
  it('hasErrorNotification is true when INVALID_INPUT violations exist', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'INVALID_INPUT', field: 'BEM', code: 'REQUIRED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.hasErrorNotification).toBe(true)
    expect(store.hasCriticalNotification).toBe(false)
    expect(store.hasWarningNotification).toBe(false)
  })

  // @UT-MB-STORE-057@ (FROM: @IMP-MB-STORE-012@)
  it('evaluates to ERROR_CRITICAL when only ERROR notifications exist', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'INVALID_INPUT', field: 'BEM', code: 'REQUIRED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.hasErrorNotification).toBe(true)
    expect(store.hasCriticalNotification).toBe(false)
    expect(store.uiState).toBe('ERROR_CRITICAL')
  })

  // @UT-MB-STORE-058@ (FROM: @IMP-MB-STORE-012@)
  it('ERROR_CRITICAL takes priority: CRITICAL > ERROR > WARNING', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([
        { type: 'INVALID_INPUT', field: 'BEM', code: 'REQUIRED' },
        { type: 'STATION_LIMIT_EXCEEDED', stationIndex: 0 },
      ]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)

    expect(store.hasErrorNotification).toBe(true)
    expect(store.hasWarningNotification).toBe(true)
    expect(store.hasCriticalNotification).toBe(false)
    expect(store.uiState).toBe('ERROR_CRITICAL')
  })

  // ─── State Transitions (Full Cycle) ───────────────────────────────────

  // @UT-MB-STORE-043@ (FROM: @IMP-MB-STORE-005@, @IMP-MB-STORE-006@, @IMP-MB-STORE-009@, @IMP-MB-STORE-010@)
  it('full lifecycle: INITIAL → VERIFIED_SAFE (load) → VERIFIED_SAFE (edit) → reset → VERIFIED_SAFE', () => {
    const store = useMassBalanceStore()
    expect(store.uiState).toBe('INITIAL')

    store.loadProfile(mockProfile)
    expect(store.uiState).toBe('VERIFIED_SAFE')

    store.updateStationWeight(0, 80)
    expect(store.uiState).toBe('VERIFIED_SAFE')

    store.resetPayload()
    expect(store.uiState).toBe('VERIFIED_SAFE')
    expect(store.stations.every((s) => s.weight === 0)).toBe(true)
    expect(store.lastResult).not.toBeNull()
  })

  // @UT-MB-STORE-044@ (FROM: @IMP-MB-STORE-012@)
  it('VERIFIED_SAFE → ERROR_CRITICAL when violation appears on weight change', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)
    expect(store.uiState).toBe('VERIFIED_SAFE')

    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'MTOM_EXCEEDED' }]),
    )
    store.updateStationWeight(0, 250)
    expect(store.uiState).toBe('ERROR_CRITICAL')
  })

  // @UT-MB-STORE-045@ (FROM: @IMP-MB-STORE-012@)
  it('ERROR_CRITICAL → VERIFIED_SAFE when violation clears', () => {
    mockedCalculate.mockReturnValue(
      buildViolationResult([{ type: 'MTOM_EXCEEDED' }]),
    )
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 250)
    expect(store.uiState).toBe('ERROR_CRITICAL')

    mockedCalculate.mockReturnValue(buildSuccessResult())
    store.updateStationWeight(0, 80)
    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // @UT-MB-STORE-046@ (FROM: @IMP-MB-STORE-006@, @IMP-MB-STORE-012@)
  it('remains VERIFIED_SAFE when mandatory field set to 0 (touched stays true)', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)
    expect(store.uiState).toBe('VERIFIED_SAFE')

    store.updateStationWeight(0, 0)
    expect(store.stations[0]!.touched).toBe(true)
    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // @UT-MB-STORE-047@ (FROM: @IMP-MB-STORE-007@, @IMP-MB-STORE-012@)
  it('category change recalculates and re-evaluates state', () => {
    const store = useMassBalanceStore()
    store.loadProfile(multiCatProfile)
    store.updateStationWeight(0, 80)
    store.updateStationWeight(1, 70)
    expect(store.uiState).toBe('VERIFIED_SAFE')

    store.changeCertificationCategory('Aerobatic')
    expect(store.activeCategory).toBe('Aerobatic')
    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // ─── _runCalculation input assembly ───────────────────────────────────

  // @UT-MB-STORE-048@ (FROM: @IMP-MB-STORE-013@)
  it('assembles correct math-core input from store state', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)
    store.updateStationWeight(1, 50)

    const lastCall = mockedCalculate.mock.calls[mockedCalculate.mock.calls.length - 1]!
    const input = lastCall[0] as Record<string, unknown>
    expect(input).toHaveProperty('basicEmptyMass', 433)
    expect(input).toHaveProperty('emptyCenterOfGravity', 1.877)
    expect(input).toHaveProperty('maxTakeoffMass', 630)
    expect(input).toHaveProperty('graphType', 'arm')
  })

  // @UT-MB-STORE-049@ (FROM: @IMP-MB-STORE-013@)
  it('excludes fuel stations from payload stations in math-core input', () => {
    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)
    store.updateStationWeight(0, 80)
    store.updateStationWeight(1, 50)

    const lastCall = mockedCalculate.mock.calls[mockedCalculate.mock.calls.length - 1]!
    const input = lastCall[0] as { fuelStations: { index: number }[]; stations: { index: number }[] }
    expect(input.stations).toHaveLength(1)
    expect(input.stations[0]!.index).toBe(0)
    expect(input.fuelStations).toHaveLength(1)
    expect(input.fuelStations[0]!.index).toBe(1)
  })

  // @UT-MB-STORE-050@ (FROM: @IMP-MB-STORE-013@)
  it('stores the lastResult from calculation', () => {
    const expectedResult = buildSuccessResult()
    mockedCalculate.mockReturnValue(expectedResult)

    const store = useMassBalanceStore()
    store.loadProfile(mockProfile)

    expect(store.lastResult).toStrictEqual(expectedResult)
  })
})
