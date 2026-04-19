/**
 * Unit tests for the AircraftProfile → AircraftContext mapper.
 *
 * @see fleet-profile.mapper.ts
 */

// @UT-MB-SVC-001@ (FROM: @IMP-MB-SVC-001@)

import { describe, it, expect } from 'vitest'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { mapFleetProfileToContext } from './fleet-profile.mapper'

function buildCombustionProfile(): AircraftProfile {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    ownerId: 'owner-1',
    registration: 'D-EBPN',
    manufacturer: 'Cessna',
    model: 'C172S Skyhawk SP',
    icaoTypeDesignator: 'C172',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge of wing root',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'verified',
    schemaVersion: 1,
    passengerProfiles: [],
    weighingReports: [
      { bem: 760, emptyCg: 1.01, weighingDate: '2024-01-01', validFrom: '2024-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 0.94,
        armLookup: [],
        operationalLimit: 200,
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
          { armOrMoment: 0.9, mass: 800 },
          { armOrMoment: 0.9, mass: 1157 },
          { armOrMoment: 1.1, mass: 1157 },
          { armOrMoment: 1.1, mass: 800 },
        ],
      },
    ],
    powertrain: 'combustion',
  } satisfies AircraftProfile
}

function buildElectricProfile(): AircraftProfile {
  const base = buildCombustionProfile()
  return {
    ...base,
    manufacturer: 'Pipistrel',
    model: 'Velis Electro',
    icaoTypeDesignator: 'PIVE',
    powertrain: 'electric',
    batteryPack: {
      usableEnergyKwh: 24.8,
      reserveFloorKwh: 4.0,
      nominalVoltage: 345,
      chemistry: 'LiFePO4',
    },
  }
}

describe('mapFleetProfileToContext', () => {
  it('maps a combustion profile without touching the battery pack field', () => {
    const ctx = mapFleetProfileToContext(buildCombustionProfile())
    expect(ctx.powertrain).toBe('combustion')
    expect('batteryPack' in ctx).toBe(false)
  })

  it('maps an electric profile and forwards its battery pack', () => {
    const ctx = mapFleetProfileToContext(buildElectricProfile())
    expect(ctx.powertrain).toBe('electric')
    expect(ctx.batteryPack).toEqual({
      usableEnergyKwh: 24.8,
      reserveFloorKwh: 4.0,
      nominalVoltage: 345,
      chemistry: 'LiFePO4',
    })
  })

  it('preserves identity fields across the mapping', () => {
    const ctx = mapFleetProfileToContext(buildElectricProfile())
    expect(ctx.registration).toBe('D-EBPN')
    expect(ctx.manufacturer).toBe('Pipistrel')
    expect(ctx.model).toBe('Velis Electro')
  })

  it('converts bem → basicEmptyMass on weighing reports', () => {
    const ctx = mapFleetProfileToContext(buildCombustionProfile())
    expect(ctx.weighingReports[0]!.basicEmptyMass).toBe(760)
  })

  it('converts mtom → maxTakeoffMass on certification categories', () => {
    const ctx = mapFleetProfileToContext(buildCombustionProfile())
    expect(ctx.certificationCategories[0]!.maxTakeoffMass).toBe(1157)
  })
})
