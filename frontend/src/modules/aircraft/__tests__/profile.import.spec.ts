/**
 * Unit tests for profile.import.ts
 *
 * @see frontend/src/modules/aircraft/services/profile.import.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  importProfileFromJson,
  exportProfileToJson,
  buildExchangeFilename,
  downloadProfileAsJson,
  ImportError,
} from '../services/profile.import'
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

describe('buildExchangeFilename', () => {
  // @UT-AC-STORE-025@ (FROM: @IMP-AC-STORE-004@)
  it('returns `<registration>.aerodash.json` for a normal registration', () => {
    expect(buildExchangeFilename('D-EBPN')).toBe('D-EBPN.aerodash.json')
    expect(buildExchangeFilename('N123AB')).toBe('N123AB.aerodash.json')
  })

  // @UT-AC-STORE-026@ (FROM: @IMP-AC-STORE-004@)
  it('sanitises unsafe filesystem characters', () => {
    expect(buildExchangeFilename('A/B:C*?')).toBe('A_B_C.aerodash.json')
  })

  // @UT-AC-STORE-027@ (FROM: @IMP-AC-STORE-004@)
  it('falls back to `aircraft` when registration has no safe characters', () => {
    expect(buildExchangeFilename('///')).toBe('aircraft.aerodash.json')
    expect(buildExchangeFilename('')).toBe('aircraft.aerodash.json')
  })
})

describe('downloadProfileAsJson', () => {
  const createObjectURL = vi.fn<(arg: Blob) => string>(() => 'blob:fake')
  const revokeObjectURL = vi.fn<(url: string) => void>()
  const originalCreate = globalThis.URL.createObjectURL
  const originalRevoke = globalThis.URL.revokeObjectURL

  beforeEach(() => {
    createObjectURL.mockClear()
    createObjectURL.mockImplementation(() => 'blob:fake')
    revokeObjectURL.mockClear()
    globalThis.URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
  })

  afterEach(() => {
    globalThis.URL.createObjectURL = originalCreate
    globalThis.URL.revokeObjectURL = originalRevoke
  })

  // @UT-AC-STORE-028@ (FROM: @IMP-AC-STORE-004@)
  it('creates and revokes a blob URL and clicks a download anchor', () => {
    const profile = createValidExportedProfile() as unknown as AircraftProfile
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadProfileAsJson(profile)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const firstCall = createObjectURL.mock.calls[0]
    expect(firstCall).toBeDefined()
    const blob = firstCall![0]
    expect(blob.type).toBe('application/json')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')

    clickSpy.mockRestore()
  })

  // @UT-AC-STORE-029@ (FROM: @IMP-AC-STORE-004@)
  it('downloaded blob content re-imports successfully (round-trip safe)', async () => {
    const profile = createValidExportedProfile() as unknown as AircraftProfile
    let capturedBlob: Blob | null = null
    createObjectURL.mockImplementation((arg: Blob) => {
      capturedBlob = arg
      return 'blob:capture'
    })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadProfileAsJson(profile)

    expect(capturedBlob).not.toBeNull()
    const blob = capturedBlob as unknown as Blob
    const text = await blob.text()
    const reimported = importProfileFromJson(text)
    expect(reimported.registration).toBe(profile.registration)
    expect(reimported.status).toBe('draft')

    clickSpy.mockRestore()
  })
})
