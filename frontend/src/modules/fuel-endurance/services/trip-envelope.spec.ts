import { describe, expect, it } from 'vitest'
import { calculateMassBalance } from '@/core/adapters/mass-balance.adapter'
import { syntheticFuelContext, stations } from './synthetic-fuel.fixture'
import { assessTripEnvelope } from './trip-envelope'

const envelope = [
  { mass: 500, armOrMoment: 0 }, { mass: 700, armOrMoment: 0 },
  { mass: 700, armOrMoment: 4 }, { mass: 500, armOrMoment: 4 },
]
const mb = calculateMassBalance({ basicEmptyMass: 560, emptyCenterOfGravity: 2, maxTakeoffMass: 1000,
  maxZeroFuelMass: null, graphType: 'arm', envelope, stations: [],
  fuelStations: [{ index: 0, mass: 50, unusableFuel: 10, arm: 1, armLookup: [], burnSequences: [] }] })
describe('trip envelope adapter', () => {
  it('assesses a fixed-arm trip and rejects excess fuel', () => {
    expect(assessTripEnvelope(syntheticFuelContext(), 'Normal', stations, mb, 20, '', envelope, 'arm')).toBe('Inside envelope')
    expect(assessTripEnvelope(syntheticFuelContext(), 'Normal', stations, mb, 41, '', envelope, 'arm')).toContain('Unavailable')
  })
  it('leaves lookup tank paths unavailable', () => {
    const aircraft = syntheticFuelContext()
    aircraft.loadPoints[0]!.arm = null
    aircraft.loadPoints[0]!.armLookup = [{ massOrVolume: 0, moment: 0 }, { massOrVolume: 50, moment: 50 }]
    expect(assessTripEnvelope(aircraft, 'Normal', stations, mb, 20, '', envelope, 'arm')).toContain('Variable-arm')
  })
  it('drains in the selected order through a tank switch', () => {
    const aircraft = syntheticFuelContext()
    aircraft.loadPoints[0]!.defaultQuantity = 30
    aircraft.loadPoints.push(structuredClone(aircraft.loadPoints[0]!))
    aircraft.loadPoints[1]!.arm = 3
    aircraft.loadPoints.forEach((tank, index) => { tank.fuelTank!.burnSequences = [
      { sequenceName: 'A', ordinalPosition: index + 1 }, { sequenceName: 'B', ordinalPosition: 2 - index },
    ] })
    const loads = [{ ...stations[0]!, weight: 30 }, { ...stations[0]!, index: 1, weight: 30 }]
    const box = [{ mass: 550, armOrMoment: 1140 }, { mass: 650, armOrMoment: 1140 },
      { mass: 650, armOrMoment: 1250 }, { mass: 550, armOrMoment: 1250 }]
    const result = calculateMassBalance({ basicEmptyMass: 560, emptyCenterOfGravity: 2,
      maxTakeoffMass: 1000, maxZeroFuelMass: null, graphType: 'moment', envelope: box, stations: [],
      fuelStations: aircraft.loadPoints.map((tank, index) => ({ index, mass: 30, unusableFuel: 10,
        arm: tank.arm, armLookup: [], burnSequences: tank.fuelTank!.burnSequences })) })
    expect(assessTripEnvelope(aircraft, 'Normal', loads, result, 30, 'A', box, 'moment')).toBe('Inside envelope')
    expect(assessTripEnvelope(aircraft, 'Normal', loads, result, 30, 'B', box, 'moment')).toBe('Outside envelope')
    expect(assessTripEnvelope(aircraft, 'Normal', loads, result, 30, '', box, 'moment')).toContain('Unavailable')
  })

})
