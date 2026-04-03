import type { MathCoreInput } from '@/core/domain/mass-balance.math-types'
import type { EnvelopePoint } from '@/core/domain/aircraft.types'

const defaultEnvelope: EnvelopePoint[] = [
  { armOrMoment: 1.841, mass: 433 },
  { armOrMoment: 1.978, mass: 433 },
  { armOrMoment: 1.978, mass: 650 },
  { armOrMoment: 1.841, mass: 650 },
]

const defaultStations = [
  { index: 0, mass: 0, arm: 1.8, armLookup: [] }, // Seats
  { index: 1, mass: 0, arm: 2.417, armLookup: [] }, // Baggage
]

const defaultFuelStations = [
  {
    index: 2,
    mass: 3,
    arm: 2.209,
    armLookup: [],
    unusableFuel: 3,
    burnSequences: [],
  },
]

export function createMathCoreInput(overrides?: Partial<MathCoreInput>): MathCoreInput {
  const baseInput: MathCoreInput = {
    basicEmptyMass: 433,
    emptyCenterOfGravity: 1.877,
    maxTakeoffMass: 650,
    maxZeroFuelMass: null,
    envelope: structuredClone(defaultEnvelope),
    graphType: 'arm',
    fuelStations: structuredClone(defaultFuelStations),
    stations: structuredClone(defaultStations),
  }

  return {
    ...baseInput,
    ...overrides,
  }
}
