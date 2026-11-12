import { AircraftProfileSchema } from '../../src/core/adapters/aircraft.schema'

/** Fictional Test aircraft: synthetic wiring vectors, never operational POH data. */
export function testPohAircraft() {
  return AircraftProfileSchema.parse({
    id: '00000000-0000-4000-a000-000000000428', ownerId: 'test-owner',
    registration: 'D-TEST', manufacturer: 'Test', model: 'Test POH wiring only',
    icaoTypeDesignator: 'TEST', sourceUnit: 'kg',
    referenceDatumDescription: 'Test datum', referenceDatumLocation: 'Test zero',
    shareCode: null, status: 'verified', schemaVersion: 1,
    weighingReports: [{ bem: 500, emptyCg: 1, weighingDate: '2026-01-01', validFrom: '2026-01-01' }],
    loadPoints: [],
    certificationCategories: [{ category: 'Normal', mtom: 1200, maxZeroFuelMass: null,
      graphType: 'arm', envelope: [
        { mass: 500, armOrMoment: 0.5 }, { mass: 1200, armOrMoment: 0.5 },
        { mass: 1200, armOrMoment: 1.5 }, { mass: 500, armOrMoment: 1.5 },
      ] }],
    performanceProfiles: ['TakeoffRoll', 'TakeoffDistance50ft', 'LandingRoll', 'LandingDistance50ft']
      .map((flightPhase, index) => ({ flightPhase, dataPoints: [800, 1000].flatMap((mass) =>
        [0, 2000].flatMap((pressureAltitude) => [0, 20].map((temperature) => ({
          mass, pressureAltitude, temperature,
          distance: 100 + index * 100 + (mass - 800) + pressureAltitude / 100 + temperature,
        })))),
      })),
  })
}
