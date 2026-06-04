/**
 * Integration tests for the performance safety chain inside P1: the Verified
 * aircraft profile drives `computePohDistances`, whose four base distances feed
 * `applySafetyFactors`. Proves the P1↔P1 handshake (POH distances → operational
 * required distances, Go/No-Go, and CRIT-PF-002 / WARN-PF-002) end to end.
 *
 * @see ../performance.safety-factor.ts
 * @see ../performance.poh-distance.ts
 */

// @IT-PF-CORE-002@ (FROM: @IMP-PF-CORE-014@, @IMP-PF-CORE-005@)

import { describe, it, expect } from 'vitest'
import { AircraftProfileSchema, type AircraftProfile } from '../../adapters/aircraft.schema'
import { applySafetyFactors } from '../../adapters/performance.safety-factor.adapter'
import { computePohDistances } from '../performance.poh-distance'
import type { PerformanceDataPoint } from '../../domain/aircraft.types'
import type { PerformanceBaseDistances } from '../../domain/performance.math-types'

function phaseDataPoints(base: number): PerformanceDataPoint[] {
  const out: PerformanceDataPoint[] = []
  for (const t of [0, 20]) {
    for (const a of [0, 2000]) {
      for (const m of [850, 1000]) {
        out.push({
          mass: m,
          pressureAltitude: a,
          temperature: t,
          distance: base * (m / 850) * (1 + a / 10000) * (1 + t / 200),
        })
      }
    }
  }
  return out
}

function buildVerifiedProfile(): AircraftProfile {
  return AircraftProfileSchema.parse({
    id: '00000000-0000-4000-a000-0000000000aa',
    ownerId: 'user-perf',
    registration: 'D-SAFE',
    manufacturer: 'Test',
    model: 'PF Trainer',
    icaoTypeDesignator: 'C172',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Datum',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'verified',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [{ bem: 700, emptyCg: 1.5, weighingDate: '2025-01-01', validFrom: '2025-01-01' }],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 110,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 1157,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.4, mass: 600 },
          { armOrMoment: 1.4, mass: 1157 },
          { armOrMoment: 2.0, mass: 1157 },
          { armOrMoment: 2.0, mass: 600 },
        ],
      },
    ],
    performanceProfiles: [
      { flightPhase: 'TakeoffRoll', dataPoints: phaseDataPoints(210) },
      { flightPhase: 'TakeoffDistance50ft', dataPoints: phaseDataPoints(340) },
      { flightPhase: 'LandingRoll', dataPoints: phaseDataPoints(185) },
      { flightPhase: 'LandingDistance50ft', dataPoints: phaseDataPoints(315) },
    ],
  })
}

function baseFrom(profile: AircraftProfile): PerformanceBaseDistances {
  const poh = computePohDistances(profile, { mass: 850, pressureAltitude: 0, temperature: 0 })
  if (poh.status !== 'success') throw new Error(`expected POH success, got ${poh.status}`)
  return poh.distances
}

describe('safety-factor pipeline composed with computePohDistances', () => {
  it('produces a coherent Go advisory from POH base distances and ample runway', () => {
    const base = baseFrom(buildVerifiedProfile())
    // POH base at (850 kg, 0 ft, 0 °C) is the unscaled cell value.
    expect(base.takeoffRoll).toBeCloseTo(210, 6)
    expect(base.takeoffDistance50ft).toBeCloseTo(340, 6)

    const r = applySafetyFactors({
      base,
      factors: { friction: 1, slope: 1, densityAltitude: 1, wind: 1 },
      osf: { preset: 'easa-standard' },
      available: { takeoff: 500, landing: 500 },
    })

    expect(r.status).toBe('success')
    if (r.status !== 'success') return
    expect(r.takeoff.fullRequired).toBeCloseTo(425, 6)
    expect(r.landing.fullRequired).toBeCloseTo(450.45, 6)
    expect(r.takeoff.marginAbsolute).toBeCloseTo(75, 6)
    expect(r.violations).toEqual([])
    expect(r.goNoGo).toBe(true)
  })

  it('raises CRIT-PF-002 and blocks Go when the POH-derived requirement exceeds the runway', () => {
    const base = baseFrom(buildVerifiedProfile())
    const r = applySafetyFactors({
      base,
      factors: { friction: 1, slope: 1, densityAltitude: 1, wind: 1 },
      osf: { preset: 'easa-standard' },
      available: { takeoff: 400, landing: 500 },
    })
    expect(r.status).toBe('success')
    if (r.status !== 'success') return
    expect(r.takeoff.insufficient).toBe(true)
    expect(r.violations).toContainEqual({
      type: 'RUNWAY_INSUFFICIENT',
      notificationId: 'CRIT-PF-002',
      severity: 'CRITICAL',
      blocking: true,
      operation: 'takeoff',
    })
    expect(r.goNoGo).toBe(false)
  })

  it('raises WARN-PF-002 for a below-baseline OSF while still allowing Go', () => {
    const base = baseFrom(buildVerifiedProfile())
    const r = applySafetyFactors({
      base,
      factors: { friction: 1.1, slope: 1.05, densityAltitude: 1.05, wind: 1 },
      osf: { preset: 'short-field' },
      available: { takeoff: 2000, landing: 2000 },
    })
    expect(r.status).toBe('success')
    if (r.status !== 'success') return
    expect(r.violations).toContainEqual({
      type: 'OSF_BELOW_MINIMUM',
      notificationId: 'WARN-PF-002',
      severity: 'WARNING',
      blocking: false,
      operation: 'landing',
    })
    expect(r.goNoGo).toBe(true)
  })
})
