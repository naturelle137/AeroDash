/**
 * Integration tests for the POH distance facade — exercises the full path
 * through the Zod-validated AircraftProfile aggregate, the schemaVersion
 * migration walker, and the trilinear interpolation engine.
 *
 * The unit specs live next to the source; this file proves the **flow**:
 *   raw IndexedDB document → migrateProfileDocument → computePohDistances
 *
 * The integration boundary is intentionally inside the P1 core (no Vue/Pinia
 * imports — the boundary is P1 modules talking to each other, not P1↔P2).
 *
 * @see ../performance.poh-distance.ts
 */

// @IT-PF-CORE-001@ (FROM: @IMP-PF-CORE-005@, @IMP-AC-CORE-003@)

import { describe, it, expect } from 'vitest'
import {
  migrateProfileDocument,
  type ProfileMigrationOutcome,
} from '../profile-migrations'
import {
  computePohDistances,
  type PohDistanceConditions,
} from '../performance.poh-distance'
import type { PerformanceDataPoint } from '../../domain/aircraft.types'

const conditions = (
  mass: number,
  pa: number,
  temperature: number,
): PohDistanceConditions => ({ mass, pressureAltitude: pa, temperature })

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

function rawDocument(status: 'draft' | 'verified'): Record<string, unknown> {
  return {
    id: '00000000-0000-4000-a000-000000000200',
    ownerId: 'pilot-int-test',
    registration: 'D-EAEX',
    manufacturer: 'Test',
    model: 'PF Integration',
    icaoTypeDesignator: 'C172',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Datum',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status,
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 700, emptyCg: 1.5, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
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
  }
}

function expectMigrated(outcome: ProfileMigrationOutcome) {
  expect(outcome.kind).toBe('migrated')
  if (outcome.kind !== 'migrated') {
    throw new Error('migration did not yield a profile')
  }
  return outcome
}

describe('integration: raw doc → migration → POH distance computation', () => {
  it('a Verified profile produces all four distances at an exact grid point', () => {
    const out = expectMigrated(migrateProfileDocument(rawDocument('verified')))
    const result = computePohDistances(out.profile, conditions(850, 0, 0))
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.distances.takeoffRoll).toBeCloseTo(210, 5)
    expect(result.distances.takeoffDistance50ft).toBeCloseTo(340, 5)
    expect(result.distances.landingRoll).toBeCloseTo(185, 5)
    expect(result.distances.landingDistance50ft).toBeCloseTo(315, 5)
  })

  it('a Draft profile is blocked from performance computation', () => {
    const out = expectMigrated(migrateProfileDocument(rawDocument('draft')))
    expect(out.profile.status).toBe('draft')
    const result = computePohDistances(out.profile, conditions(900, 1000, 15))
    expect(result.status).toBe('failure')
    if (result.status !== 'failure') return
    expect(result.reason).toBe('profile_unverified')
    expect(result.message).toContain('Verified')
  })

  it('a legacy v0 document is upgraded then computation respects its status', () => {
    const raw = rawDocument('verified')
    delete (raw as { schemaVersion?: number }).schemaVersion
    const out = expectMigrated(migrateProfileDocument(raw))
    expect(out.profile.schemaVersion).toBe(1)
    const result = computePohDistances(out.profile, conditions(925, 1000, 10))
    expect(result.status).toBe('success')
  })
})
