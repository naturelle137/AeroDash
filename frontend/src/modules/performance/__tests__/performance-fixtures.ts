/**
 * Shared test fixtures for the performance module.
 *
 * Builds a schema-valid, Verified aircraft whose POH performance tables form a
 * regular linear 3-D grid. The envelope maxima are chosen to match the UJ-C-001
 * narrative numbers (temperature 50 °C, pressure altitude 10 000 ft) so the
 * extrapolation thresholds in the journey hold exactly: 54 °C is inside the 10%
 * band (extrapolated), 57 °C and 11 100 ft are beyond it (blocked).
 */

import { AircraftProfileSchema, type AircraftProfile } from '@/core/adapters/aircraft.schema'
import type { FlightPhase, PerformanceDataPoint } from '@/core/domain/aircraft.types'

export const MASS_AXIS = [600, 1000] as const
export const ALT_AXIS = [0, 10_000] as const
export const TEMP_AXIS = [0, 50] as const

/** Linear distance model per phase: B + M·(massFrac) + A·(altFrac) + T·(tempFrac). */
interface PhaseModel {
  base: number
  mass: number
  alt: number
  temp: number
}

const PHASE_MODELS: Record<FlightPhase, PhaseModel> = {
  TakeoffRoll: { base: 250, mass: 150, alt: 200, temp: 100 },
  TakeoffDistance50ft: { base: 450, mass: 200, alt: 350, temp: 150 },
  LandingRoll: { base: 200, mass: 80, alt: 120, temp: 60 },
  LandingDistance50ft: { base: 380, mass: 120, alt: 220, temp: 100 },
}

/** Exact (interpolation-faithful) distance for the linear grid model. */
export function modelDistance(phase: FlightPhase, mass: number, pa: number, temp: number): number {
  const m = PHASE_MODELS[phase]
  const massFrac = (mass - MASS_AXIS[0]) / (MASS_AXIS[1] - MASS_AXIS[0])
  const altFrac = (pa - ALT_AXIS[0]) / (ALT_AXIS[1] - ALT_AXIS[0])
  const tempFrac = (temp - TEMP_AXIS[0]) / (TEMP_AXIS[1] - TEMP_AXIS[0])
  return m.base + m.mass * massFrac + m.alt * altFrac + m.temp * tempFrac
}

function buildDataPoints(phase: FlightPhase): PerformanceDataPoint[] {
  const points: PerformanceDataPoint[] = []
  for (const temperature of TEMP_AXIS) {
    for (const pressureAltitude of ALT_AXIS) {
      for (const mass of MASS_AXIS) {
        points.push({
          mass,
          pressureAltitude,
          temperature,
          distance: modelDistance(phase, mass, pressureAltitude, temperature),
        })
      }
    }
  }
  return points
}

const ALL_PHASES: FlightPhase[] = [
  'TakeoffRoll',
  'TakeoffDistance50ft',
  'LandingRoll',
  'LandingDistance50ft',
]

export interface BuildOptions {
  status?: 'draft' | 'verified'
  registration?: string
  /** Phases to include — omit one to exercise the `profile_incomplete` path. */
  phases?: FlightPhase[]
  /** Optional POH-mandated safety factors (drives the `poh-afm` preset / WARN threshold). */
  safetyFactors?: { takeoff: number; landing: number }
}

/** Construct a schema-valid performance-capable aircraft profile. */
export function buildPerformanceAircraft(opts: BuildOptions = {}): AircraftProfile {
  const phases = opts.phases ?? ALL_PHASES
  const raw = {
    id: '00000000-0000-4000-a000-000000000311',
    ownerId: '00000000-0000-4000-a000-0000000003ff',
    registration: opts.registration ?? 'D-EPER',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge of wing root',
    referenceDatumLocation: 'Station 0 m',
    shareCode: null,
    status: opts.status ?? 'verified',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot & Passenger',
        arm: 1.145,
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
        mtom: 630,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.841, mass: 432 },
          { armOrMoment: 1.841, mass: 630 },
          { armOrMoment: 1.978, mass: 630 },
          { armOrMoment: 1.978, mass: 432 },
        ],
      },
    ],
    safetyFactors: opts.safetyFactors,
    performanceProfiles: phases.map((flightPhase) => ({
      flightPhase,
      dataPoints: buildDataPoints(flightPhase),
    })),
  }
  return AircraftProfileSchema.parse(raw)
}

/** Mid-envelope conditions that stay inside the POH grid (no extrapolation). */
export const WITHIN_ENVELOPE_CONDITIONS = { mass: 800, pressureAltitude: 5000, temperature: 25 }

/** Hot conditions inside the 10% extrapolation band (requires acknowledgment). */
export const EXTRAPOLATED_CONDITIONS = { mass: 800, pressureAltitude: 5000, temperature: 54 }

/** Conditions beyond the 10% temperature cap (computation blocked). */
export const BLOCKED_TEMP_CONDITIONS = { mass: 800, pressureAltitude: 5000, temperature: 57 }
