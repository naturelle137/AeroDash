// @IT-MB-STORE-001@ (FROM: @IMP-MB-STORE-020@)
// @IT-MB-STORE-002@ (FROM: @IMP-MB-STORE-022@)
// @IT-MB-STORE-003@ (FROM: @IMP-MB-STORE-021@)

/**
 * Mass & Balance store ↔ real math-core integration.
 *
 * Unlike mass-balance.store.spec.ts (which mocks the adapter), this suite wires
 * the store to the REAL `calculateMassBalance` adapter so the full
 * unit-normalization → Zod validation → math-core chain is exercised end to
 * end. It covers the v0.3.0-alpha release-audit blockers:
 *
 *   - BUNDLE 1 (TECH-001/002): imperial profile (arms in inches, mass in lb)
 *     produces a CORRECT SI center of gravity and envelope verdict.
 *   - BUNDLE 3 (TECH-004): an adapter validation failure (success:false with
 *     NaN-filled CgPoints) must NOT reach `lastResult`; the store takes the
 *     notifications path so the UI never renders "NaN kg".
 *   - BUNDLE 4 (TECH-013/CS-008): an unknown fuel type fails closed with a
 *     WARNING instead of silently substituting the fallback density.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMassBalanceStore } from '../mass-balance.store'
import type { AircraftContext } from '@/core/domain/aircraft.types'

// ── Conversion constants (mirror the P1 unit-normalization factors) ─────────────
const LB_TO_KG = 0.45359237
const IN_TO_M = 0.0254

// ── Imperial hand-computed vector ───────────────────────────────────────────────
// Cessna-class single, source unit "lb-in" (mass in lb, arm in inches).
//
//   BEM    = 1500 lb @ 40 in
//   Pilot  =  400 lb @ 38 in
//   Fuel   =  200 lb @ 48 in, unusable 10 lb  (mass-unit tank)
//   MTOM   = 2400 lb
//
// Hand-computed SI expectations (raw × conversion factor):
//   ZFM       = (1500+400)·LB                 = 861.825503 kg
//   ZF arm    = (1500·40 + 400·38)·IN / ZFM   = 1.0053052631578947 m
//   TO mass   = ZFM + (200-10)·LB             = 948.0080533 kg
//   TO arm    = … (usable fuel 190 lb @ 48 in)= 1.0247502392344496 m
const imperialProfile: AircraftContext = {
  id: 'imperial-c172-class',
  registration: 'N12345',
  manufacturer: 'TestCo',
  model: 'Imperial One',
  sourceUnit: 'lb-in',
  weighingReports: [
    {
      basicEmptyMass: 1500,
      emptyCg: 40,
      weighingDate: '2025-01-01',
      validFrom: '2025-01-01',
    },
  ],
  loadPoints: [
    {
      name: 'Pilot',
      arm: 38,
      armLookup: [],
      operationalLimit: 500,
      defaultQuantity: 400,
      unit: 'lb',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
    {
      name: 'Fuel',
      arm: 48,
      armLookup: [],
      operationalLimit: 400,
      defaultQuantity: 200,
      unit: 'lb',
      allowableCategories: ['Normal'],
      fuelTank: {
        unusableFuel: 10,
        permissibleFuelTypes: ['AvGas 100LL'],
        burnSequences: [],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      maxTakeoffMass: 2400,
      maxZeroFuelMass: null,
      graphType: 'arm',
      // Envelope in inches: arm 35..45 in, mass 1500..2400 lb. The takeoff CG
      // (≈40.34 in, ≈2090 lb) sits well inside.
      envelope: [
        { armOrMoment: 35, mass: 1500 },
        { armOrMoment: 35, mass: 2400 },
        { armOrMoment: 45, mass: 2400 },
        { armOrMoment: 45, mass: 1500 },
      ],
    },
  ],
}

describe('MassBalance store ↔ real adapter — imperial unit normalization (BUNDLE 1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @IT-MB-STORE-001@
  it('normalizes inches/lb to SI and computes the correct CG (in-envelope, no false Go)', () => {
    const store = useMassBalanceStore()
    store.loadProfile(imperialProfile)

    expect(store.lastResult).not.toBeNull()
    const r = store.lastResult!

    // Zero-fuel CG
    expect(r.zeroFuelCenterOfGravityPoint.mass).toBeCloseTo((1500 + 400) * LB_TO_KG, 6)
    expect(r.zeroFuelCenterOfGravityPoint.arm).toBeCloseTo(1.0053052631578947, 6)

    // Takeoff CG (usable fuel = 190 lb @ 48 in)
    expect(r.takeoffCenterOfGravityPoint.mass).toBeCloseTo((1500 + 400 + 190) * LB_TO_KG, 6)
    expect(r.takeoffCenterOfGravityPoint.arm).toBeCloseTo(1.0247502392344496, 6)

    // Sanity: arm is in the metric ballpark (~1 m), NOT the raw inch value (~40)
    expect(r.takeoffCenterOfGravityPoint.arm).toBeLessThan(2)

    // In-envelope and within MTOM → no violations, VERIFIED_SAFE.
    expect(r.violations).toHaveLength(0)
    expect(store.uiState).toBe('VERIFIED_SAFE')
  })

  // @IT-MB-STORE-001@
  it('flags CG_OUT_OF_ENVELOPE when an imperial arm pushes the CG past the inch-defined envelope', () => {
    // Heavy pilot far forward (800 lb @ 10 in), no fuel. Hand calc:
    //   takeoff mass = 1500+800 = 2300 lb (< 2400 MTOM → NOT a mass violation)
    //   takeoff arm  ≈ 29.57 in (0.751 m) — left of the 35-in (0.889 m) envelope
    //                  edge, so the ARM is genuinely out of the certified box.
    // This only fires if inch→m normalization is applied to BOTH the CG and the
    // envelope; the pre-fix hardcoded-metres path would have left both in inches
    // and mis-judged membership.
    const fwd: AircraftContext = {
      ...imperialProfile,
      id: 'imperial-fwd',
      loadPoints: imperialProfile.loadPoints.map((lp) => {
        if (lp.name === 'Pilot') return { ...lp, arm: 10, defaultQuantity: 800 }
        // drain fuel so MTOM is not the trigger
        return { ...lp, defaultQuantity: lp.fuelTank ? 0 : lp.defaultQuantity }
      }),
    }

    const store = useMassBalanceStore()
    store.loadProfile(fwd)

    const r = store.lastResult!
    expect(r.takeoffCenterOfGravityPoint.mass).toBeLessThan(2400 * LB_TO_KG) // under MTOM
    expect(r.violations.some((v) => v.type === 'MTOM_EXCEEDED')).toBe(false)
    expect(r.violations.some((v) => v.type === 'CG_OUT_OF_ENVELOPE')).toBe(true)
    expect(store.uiState).toBe('ERROR_CRITICAL')
  })

  // @IT-MB-STORE-001@
  it('produces IDENTICAL results to the metric equivalent of the same aircraft', () => {
    // Metric twin: same physical aircraft expressed in kg / m up front.
    const metricTwin: AircraftContext = {
      ...imperialProfile,
      id: 'metric-twin',
      sourceUnit: 'kg',
      weighingReports: [
        {
          basicEmptyMass: 1500 * LB_TO_KG,
          emptyCg: 40 * IN_TO_M,
          weighingDate: '2025-01-01',
          validFrom: '2025-01-01',
        },
      ],
      loadPoints: imperialProfile.loadPoints.map((lp) => ({
        ...lp,
        arm: lp.arm === null ? null : lp.arm * IN_TO_M,
        unit: 'kg',
        defaultQuantity: lp.defaultQuantity * LB_TO_KG,
        operationalLimit: lp.operationalLimit === null ? null : lp.operationalLimit * LB_TO_KG,
        fuelTank: lp.fuelTank
          ? { ...lp.fuelTank, unusableFuel: lp.fuelTank.unusableFuel * LB_TO_KG }
          : null,
      })),
      certificationCategories: imperialProfile.certificationCategories.map((cc) => ({
        ...cc,
        maxTakeoffMass: cc.maxTakeoffMass * LB_TO_KG,
        envelope: cc.envelope.map((p) => ({
          armOrMoment: p.armOrMoment * IN_TO_M,
          mass: p.mass * LB_TO_KG,
        })),
      })),
    }

    const impStore = useMassBalanceStore()
    impStore.loadProfile(imperialProfile)
    const imp = impStore.lastResult!

    setActivePinia(createPinia())
    const metStore = useMassBalanceStore()
    metStore.loadProfile(metricTwin)
    const met = metStore.lastResult!

    expect(imp.takeoffCenterOfGravityPoint.arm).toBeCloseTo(met.takeoffCenterOfGravityPoint.arm, 6)
    expect(imp.takeoffCenterOfGravityPoint.mass).toBeCloseTo(met.takeoffCenterOfGravityPoint.mass, 6)
    expect(imp.violations.map((v) => v.type).sort()).toEqual(met.violations.map((v) => v.type).sort())
  })
})

// ── BUNDLE 3 — NaN result must not reach lastResult / the UI ─────────────────────

const metricBase: AircraftContext = {
  id: 'p2008-metric',
  registration: 'D-EBPN',
  manufacturer: 'Tecnam',
  model: 'P2008 JC',
  sourceUnit: 'kg',
  weighingReports: [
    { basicEmptyMass: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
  ],
  loadPoints: [
    {
      name: 'Pilot & Passenger',
      arm: 1.8,
      armLookup: [],
      operationalLimit: 200,
      defaultQuantity: 90,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: null,
    },
    {
      name: 'Fuel',
      arm: 2.209,
      armLookup: [],
      operationalLimit: 75,
      defaultQuantity: 60,
      unit: 'kg',
      allowableCategories: ['Normal'],
      fuelTank: {
        unusableFuel: 3,
        permissibleFuelTypes: ['AvGas 100LL'],
        burnSequences: [],
      },
    },
  ],
  certificationCategories: [
    {
      category: 'Normal',
      maxTakeoffMass: 650,
      maxZeroFuelMass: null,
      graphType: 'arm',
      envelope: [
        { armOrMoment: 1.841, mass: 432 },
        { armOrMoment: 1.841, mass: 650 },
        { armOrMoment: 1.978, mass: 650 },
        { armOrMoment: 1.978, mass: 432 },
      ],
    },
  ],
}

describe('MassBalance store ↔ real adapter — NaN result is blocked from the UI (BUNDLE 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @IT-MB-STORE-002@
  it('never assigns a NaN-filled failed compute to lastResult; surfaces an ERROR instead', () => {
    const store = useMassBalanceStore()
    // Poison the empty CG with a non-finite value — the adapter rejects it
    // (success:false) and returns NaN CgPoints. The store must NOT keep them.
    const poisoned: AircraftContext = {
      ...metricBase,
      weighingReports: [
        {
          basicEmptyMass: 432,
          emptyCg: Infinity,
          weighingDate: '2025-01-01',
          validFrom: '2025-01-01',
        },
      ],
    }
    store.loadProfile(poisoned)

    // The blocker: lastResult stays null, so no "NaN kg" can render.
    expect(store.lastResult).toBeNull()
    expect(store.hasErrorNotification).toBe(true)
    expect(store.uiState).toBe('ERROR_CRITICAL')
    expect(store.notifications.some((n) => n.id === 'ERR-SYS-001')).toBe(true)
  })

  // @IT-MB-STORE-002@
  it('rejects an absurd out-of-range station mass without rendering a result', () => {
    const store = useMassBalanceStore()
    store.loadProfile(metricBase)
    expect(store.lastResult).not.toBeNull() // baseline computes fine

    store.updateStationWeight(0, 1e30) // absurd kg → OUT_OF_RANGE in adapter
    expect(store.lastResult).toBeNull()
    expect(store.uiState).not.toBe('VERIFIED_SAFE')
  })
})

// ── BUNDLE 4 — unknown fuel type fails closed ───────────────────────────────────

describe('MassBalance store ↔ real adapter — unknown fuel fails closed (BUNDLE 4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // @IT-MB-STORE-003@
  it('raises WARN-FE-001 and does not compute silently for an unknown fuel type', () => {
    const store = useMassBalanceStore()
    // Bypass the context-schema enum (the store consumes a typed AircraftContext
    // directly) to simulate data that slipped through a looser path.
    const unknownFuel: AircraftContext = {
      ...metricBase,
      id: 'unknown-fuel',
      loadPoints: metricBase.loadPoints.map((lp) =>
        lp.fuelTank
          ? {
              ...lp,
              fuelTank: {
                ...lp.fuelTank,
                permissibleFuelTypes: ['Kerosene' as unknown as 'Diesel'],
              },
            }
          : lp,
      ),
    }
    store.loadProfile(unknownFuel)

    expect(store.notifications.some((n) => n.id === 'WARN-FE-001')).toBe(true)
    expect(store.hasWarningNotification).toBe(true)
  })

  // @IT-MB-STORE-003@
  it('does NOT warn for each canonical fuel type', () => {
    for (const fuel of ['MoGas', 'AvGas 100LL', 'Jet A-1', 'AvGas UL91', 'Diesel'] as const) {
      setActivePinia(createPinia())
      const store = useMassBalanceStore()
      const profile: AircraftContext = {
        ...metricBase,
        id: `fuel-${fuel}`,
        loadPoints: metricBase.loadPoints.map((lp) =>
          lp.fuelTank ? { ...lp, fuelTank: { ...lp.fuelTank, permissibleFuelTypes: [fuel] } } : lp,
        ),
      }
      store.loadProfile(profile)
      expect(store.notifications.some((n) => n.id === 'WARN-FE-001')).toBe(false)
    }
  })
})
