/**
 * Unit tests for profile.import.ts
 *
 * @see frontend/src/modules/aircraft/services/profile.import.ts
 */

import { describe, it, expect } from 'vitest'
import { importProfileFromJson, exportProfileToJson, ImportError } from '../services/profile.import'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'

/** Minimal valid profile for import testing. */
function createValidExportedProfile(): Record<string, unknown> {
  return {
    id: '00000000-0000-4000-a000-000000000099',
    ownerId: 'user-test',
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'Verified',
    schemaVersion: 1,
    passengerProfiles: [],
    weighingReports: [
      { bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
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
        mtom: 650,
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
}

describe('importProfileFromJson', () => {
  // @UT-AC-STORE-017@ (FROM: @IMP-AC-STORE-004@)
  it('creates Draft profile from valid exchange file', () => {
    const json = JSON.stringify(createValidExportedProfile())
    const profile = importProfileFromJson(json)
    expect(profile.status).toBe('draft')
    expect(profile.registration).toBe('D-EBPN')
    expect(profile.manufacturer).toBe('Tecnam')
  })

  // @UT-AC-STORE-018@ (FROM: @IMP-AC-STORE-004@)
  it('assigns a new UUID on import (does not reuse the original id)', () => {
    const original = createValidExportedProfile()
    const json = JSON.stringify(original)
    const profile = importProfileFromJson(json)
    expect(profile.id).not.toBe(original.id)
    // Must be a valid UUID v4 format
    expect(profile.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  // @UT-AC-STORE-019@ (FROM: @IMP-AC-STORE-004@)
  it('forces status = Draft even when exchange file has status = Verified', () => {
    const data = createValidExportedProfile()
    data.status = 'Verified'
    const json = JSON.stringify(data)
    const profile = importProfileFromJson(json)
    expect(profile.status).toBe('draft')
  })

  // @UT-AC-STORE-020@ (FROM: @IMP-AC-STORE-004@)
  it('throws ImportError on malformed JSON, fleet unmodified', () => {
    expect(() => importProfileFromJson('{not valid json')).toThrow(ImportError)
    expect(() => importProfileFromJson('{not valid json')).toThrow(
      'Invalid JSON: could not parse exchange file',
    )
  })

  // @UT-AC-STORE-021@ (FROM: @IMP-AC-STORE-004@)
  it('throws ImportError on Zod validation failure (missing required field)', () => {
    const data = createValidExportedProfile()
    delete data.registration
    const json = JSON.stringify(data)
    expect(() => importProfileFromJson(json)).toThrow(ImportError)
    expect(() => importProfileFromJson(json)).toThrow('Profile validation failed')
  })

  // @UT-AC-STORE-022@ (FROM: @IMP-AC-STORE-004@)
  it('throws ImportError when certificationCategories is empty array', () => {
    const data = createValidExportedProfile()
    data.certificationCategories = []
    const json = JSON.stringify(data)
    expect(() => importProfileFromJson(json)).toThrow(ImportError)
  })

  // @UT-AC-STORE-023@ (FROM: @IMP-AC-STORE-004@)
  it('round-trip: export → import → equality (excluding id and status)', () => {
    const original = createValidExportedProfile()
    // Create an AircraftProfile-like object for export
    const profileForExport: AircraftProfile = {
      ...(original as AircraftProfile),
      id: '00000000-0000-4000-a000-000000000099',
      status: 'draft',
      schemaVersion: 1,
      passengerProfiles: [],
    }

    const exported = exportProfileToJson(profileForExport)
    const reimported = importProfileFromJson(exported)

    // All fields except id (reassigned) and status (forced Draft) must match
    expect(reimported.registration).toBe(profileForExport.registration)
    expect(reimported.manufacturer).toBe(profileForExport.manufacturer)
    expect(reimported.model).toBe(profileForExport.model)
    expect(reimported.icaoTypeDesignator).toBe(profileForExport.icaoTypeDesignator)
    expect(reimported.weighingReports).toEqual(profileForExport.weighingReports)
    expect(reimported.loadPoints).toEqual(profileForExport.loadPoints)
    expect(reimported.certificationCategories).toEqual(profileForExport.certificationCategories)
    expect(reimported.status).toBe('draft')
  })
})

describe('exportProfileToJson', () => {
  // @UT-AC-STORE-024@ (FROM: @IMP-AC-STORE-004@)
  it('produces valid JSON that round-trips through importProfileFromJson', () => {
    const data = createValidExportedProfile() as AircraftProfile
    const json = exportProfileToJson(data)
    expect(() => JSON.parse(json)).not.toThrow()
    const reimported = importProfileFromJson(json)
    expect(reimported.registration).toBe(data.registration)
  })
})
