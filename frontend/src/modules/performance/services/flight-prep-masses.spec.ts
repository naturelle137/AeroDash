import { describe, expect, it } from 'vitest'
import { calculateMassBalance } from '@/core/adapters/mass-balance.adapter'
import { flightPrepMassSources, type FlightPrepMassInput } from './flight-prep-masses'

// Synthetic loading: takeoff 900 kg, trip arrival 880 kg, zero-usable endpoint 850 kg.
function input(): FlightPrepMassInput {
  return {
    hasAircraft: true, uiState: 'VERIFIED_SAFE', hasErrorNotification: false, electric: false,
    arrival: { ok: true, arrivalMassKg: 880 }, fuelReason: null,
    lastResult: calculateMassBalance({
      basicEmptyMass: 850, emptyCenterOfGravity: 1, maxTakeoffMass: 1200, maxZeroFuelMass: null,
      graphType: 'arm', envelope: [{ mass: 500, armOrMoment: 0 }, { mass: 1200, armOrMoment: 0 }, { mass: 1200, armOrMoment: 2 }, { mass: 500, armOrMoment: 2 }],
      stations: [], fuelStations: [{ index: 0, mass: 50, unusableFuel: 0, arm: 1, armLookup: [], burnSequences: [] }],
    }),
  }
}

describe('current Flight Prep phase masses', () => {
  it('uses takeoff and trip arrival independently, never the zero-usable endpoint', () => {
    const data = input()
    expect(data.lastResult!.landingCenterOfGravityPoint.mass).toBe(850)
    expect(flightPrepMassSources(data)).toMatchObject({ takeoff: { status: 'ready', massKg: 900 }, landing: { status: 'ready', massKg: 880 } })
  })
  it.each([null, { ok: false as const, reason: 'impossible trip' }, { ok: true as const, arrivalMassKg: NaN }, { ok: true as const, arrivalMassKg: 0 }])('retains takeoff when arrival is unavailable %j', (arrival) => {
    expect(flightPrepMassSources({ ...input(), arrival })).toMatchObject({ takeoff: { status: 'ready', massKg: 900 }, landing: { status: 'unavailable' } })
  })
  it.each(['INITIAL', 'LOADING', 'UNCONFIGURED', 'UNVERIFIED', 'ERROR_CRITICAL'] as const)('blocks both masses for M&B state %s', (uiState) => {
    expect(flightPrepMassSources({ ...input(), uiState })).toMatchObject({ takeoff: { status: 'unavailable' }, landing: { status: 'unavailable' } })
  })
  it('retains warning-state takeoff but rejects electric arrival and current M&B errors', () => {
    expect(flightPrepMassSources({ ...input(), uiState: 'WARNING', electric: true })).toMatchObject({ takeoff: { status: 'ready' }, landing: { status: 'unavailable' } })
    expect(flightPrepMassSources({ ...input(), hasErrorNotification: true })).toMatchObject({ takeoff: { status: 'unavailable' }, landing: { status: 'unavailable' } })
    expect(flightPrepMassSources({ ...input(), hasAircraft: false }).takeoff.status).toBe('unavailable')
  })
})
