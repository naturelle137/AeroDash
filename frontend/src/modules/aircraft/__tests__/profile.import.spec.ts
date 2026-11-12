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
  validateImportFile,
  isExchangeEnvelope,
  EXCHANGE_FORMAT,
  EXCHANGE_VERSION,
  MAX_IMPORT_FILE_BYTES,
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
  it('creates Draft profile from valid exchange file', () => {
    const json = JSON.stringify(createValidExportedProfile())
    const profile = importProfileFromJson(json)
    expect(profile.status).toBe('draft')
    expect(profile.registration).toBe('D-EBPN')
    expect(profile.manufacturer).toBe('Tecnam')
  })

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

  it('forces status = Draft even when exchange file has status = Verified', () => {
    const data = createValidExportedProfile()
    data.status = 'Verified'
    const json = JSON.stringify(data)
    const profile = importProfileFromJson(json)
    expect(profile.status).toBe('draft')
  })

  it('throws ImportError on malformed JSON, fleet unmodified', () => {
    expect(() => importProfileFromJson('{not valid json')).toThrow(ImportError)
    expect(() => importProfileFromJson('{not valid json')).toThrow(
      'Invalid JSON: could not parse exchange file',
    )
  })

  it('throws ImportError on Zod validation failure (missing required field)', () => {
    const data = createValidExportedProfile()
    delete data.registration
    const json = JSON.stringify(data)
    expect(() => importProfileFromJson(json)).toThrow(ImportError)
    expect(() => importProfileFromJson(json)).toThrow('Profile validation failed')
  })

  it('throws ImportError when certificationCategories is empty array', () => {
    const data = createValidExportedProfile()
    data.certificationCategories = []
    const json = JSON.stringify(data)
    expect(() => importProfileFromJson(json)).toThrow(ImportError)
  })

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

describe('validateImportFile', () => {
  /** Build a File whose reported `.size` is forced to `sizeBytes` regardless of content. */
  function makeFile(sizeBytes: number, type: string, name: string): File {
    const file = new File(['x'], name, { type })
    Object.defineProperty(file, 'size', { value: sizeBytes, configurable: true })
    return file
  }

  it('rejects an oversized file before reading it', () => {
    const tooBig = makeFile(MAX_IMPORT_FILE_BYTES + 1, 'application/json', 'evil.json')
    expect(() => validateImportFile(tooBig)).toThrow(ImportError)
    expect(() => validateImportFile(tooBig)).toThrow('too large')
  })

  it('rejects an empty (0-byte) file', () => {
    const empty = makeFile(0, 'application/json', 'empty.json')
    expect(() => validateImportFile(empty)).toThrow(ImportError)
    expect(() => validateImportFile(empty)).toThrow('empty')
  })

  it('rejects a non-JSON MIME type even with a .json name', () => {
    const spoofed = makeFile(100, 'application/x-msdownload', 'malware.json')
    expect(() => validateImportFile(spoofed)).toThrow(ImportError)
    expect(() => validateImportFile(spoofed)).toThrow('only .json')
  })

  it('rejects a non-.json extension even with a JSON MIME type', () => {
    const wrongExt = makeFile(100, 'application/json', 'profile.txt')
    expect(() => validateImportFile(wrongExt)).toThrow(ImportError)
    expect(() => validateImportFile(wrongExt)).toThrow('only .json')
  })

  it('accepts a well-formed .json file at the size limit', () => {
    const ok = makeFile(MAX_IMPORT_FILE_BYTES, 'application/json', 'D-EBPN.aerodash.json')
    expect(() => validateImportFile(ok)).not.toThrow()
  })

  it('tolerates an empty MIME type when the extension is .json', () => {
    const noMime = makeFile(100, '', 'D-EBPN.aerodash.json')
    expect(() => validateImportFile(noMime)).not.toThrow()
  })
})

describe('exportProfileToJson', () => {
  it('produces valid JSON that round-trips through importProfileFromJson', () => {
    const data = createValidExportedProfile() as AircraftProfile
    const json = exportProfileToJson(data)
    expect(() => JSON.parse(json)).not.toThrow()
    const reimported = importProfileFromJson(json)
    expect(reimported.registration).toBe(data.registration)
  })

  it('wraps the profile in an aerodash-aircraft envelope', () => {
    const data = createValidExportedProfile() as AircraftProfile
    const json = exportProfileToJson(data)
    const parsed = JSON.parse(json) as Record<string, unknown>
    expect(parsed.format).toBe(EXCHANGE_FORMAT)
    expect(parsed.version).toBe(EXCHANGE_VERSION)
    expect(parsed.profile).toBeDefined()
    expect((parsed.profile as Record<string, unknown>).registration).toBe('D-EBPN')
  })

  it('excludes operating-cost fields from the default export', () => {
    const data = {
      ...createValidExportedProfile(),
      costPerHour: 185.5,
      fuelCostIncluded: false,
    } as unknown as AircraftProfile
    const json = exportProfileToJson(data)
    const profile = (JSON.parse(json) as { profile: Record<string, unknown> }).profile
    expect(profile).not.toHaveProperty('costPerHour')
    expect(profile).not.toHaveProperty('fuelCostIncluded')
    // Non-cost data is retained.
    expect(profile.registration).toBe('D-EBPN')
  })

  it('retains operating-cost fields when includeOperatingCost is set', () => {
    const data = {
      ...createValidExportedProfile(),
      costPerHour: 185.5,
      fuelCostIncluded: false,
    } as unknown as AircraftProfile
    const json = exportProfileToJson(data, { includeOperatingCost: true })
    const profile = (JSON.parse(json) as { profile: Record<string, unknown> }).profile
    expect(profile.costPerHour).toBe(185.5)
    expect(profile.fuelCostIncluded).toBe(false)
  })

  it('does not mutate the source profile when minimising the export', () => {
    const data = {
      ...createValidExportedProfile(),
      costPerHour: 185.5,
      fuelCostIncluded: true,
    } as unknown as AircraftProfile
    exportProfileToJson(data)
    expect(data.costPerHour).toBe(185.5)
    expect(data.fuelCostIncluded).toBe(true)
  })
})

// ─── Envelope detection + back-compat ────────────────────────────────────────

describe('isExchangeEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    expect(
      isExchangeEnvelope({ format: 'aerodash-aircraft', version: 1, profile: {} }),
    ).toBe(true)
  })

  it('rejects a bare-profile JSON tree (no envelope keys)', () => {
    expect(isExchangeEnvelope(createValidExportedProfile())).toBe(false)
  })

  it('rejects a tree with wrong `format` marker', () => {
    expect(
      isExchangeEnvelope({ format: 'something-else', version: 1, profile: {} }),
    ).toBe(false)
  })

  it('rejects a tree with non-numeric or non-positive `version`', () => {
    expect(isExchangeEnvelope({ format: EXCHANGE_FORMAT, version: '1', profile: {} })).toBe(false)
    expect(isExchangeEnvelope({ format: EXCHANGE_FORMAT, version: 0, profile: {} })).toBe(false)
    expect(isExchangeEnvelope({ format: EXCHANGE_FORMAT, version: 1.5, profile: {} })).toBe(false)
  })

  it('rejects a tree without a `profile` key', () => {
    expect(isExchangeEnvelope({ format: EXCHANGE_FORMAT, version: 1 })).toBe(false)
  })

  it('rejects null, arrays, and primitives', () => {
    expect(isExchangeEnvelope(null)).toBe(false)
    expect(isExchangeEnvelope(undefined)).toBe(false)
    expect(isExchangeEnvelope([1, 2, 3])).toBe(false)
    expect(isExchangeEnvelope('aerodash-aircraft')).toBe(false)
  })
})

describe('importProfileFromJson — exchange envelope and back-compat', () => {
  it('imports a profile wrapped in the current-version envelope', () => {
    const envelope = {
      format: EXCHANGE_FORMAT,
      version: EXCHANGE_VERSION,
      profile: createValidExportedProfile(),
    }
    const profile = importProfileFromJson(JSON.stringify(envelope))
    expect(profile.registration).toBe('D-EBPN')
    expect(profile.status).toBe('draft')
  })

  it('imports a legacy bare-profile JSON (back-compat with older exports)', () => {
    // No envelope: the entire tree IS the profile (the v0.3.0-alpha export shape).
    const bare = createValidExportedProfile()
    const profile = importProfileFromJson(JSON.stringify(bare))
    expect(profile.registration).toBe('D-EBPN')
    expect(profile.status).toBe('draft')
  })

  it('rejects an envelope with version > EXCHANGE_VERSION (future build)', () => {
    const envelope = {
      format: EXCHANGE_FORMAT,
      version: EXCHANGE_VERSION + 1,
      profile: createValidExportedProfile(),
    }
    expect(() => importProfileFromJson(JSON.stringify(envelope))).toThrow(ImportError)
    expect(() => importProfileFromJson(JSON.stringify(envelope))).toThrow(/newer than/)
  })

  it('rejects an envelope whose inner profile fails Zod validation', () => {
    const bad = createValidExportedProfile()
    delete bad.registration
    const envelope = { format: EXCHANGE_FORMAT, version: EXCHANGE_VERSION, profile: bad }
    expect(() => importProfileFromJson(JSON.stringify(envelope))).toThrow(ImportError)
    expect(() => importProfileFromJson(JSON.stringify(envelope))).toThrow('Profile validation failed')
  })

  it('round-trip: export → import via envelope preserves the registration', () => {
    const profile = createValidExportedProfile() as AircraftProfile
    const exported = exportProfileToJson(profile)
    // exported MUST be envelope-shaped (assertion above), and reimport MUST succeed.
    const parsed = JSON.parse(exported)
    expect(parsed.format).toBe(EXCHANGE_FORMAT)
    const reimported = importProfileFromJson(exported)
    expect(reimported.registration).toBe(profile.registration)
  })
})

describe('buildExchangeFilename', () => {
  it('returns `<registration>.aerodash.json` for a normal registration', () => {
    expect(buildExchangeFilename('D-EBPN')).toBe('D-EBPN.aerodash.json')
    expect(buildExchangeFilename('N123AB')).toBe('N123AB.aerodash.json')
  })

  it('sanitises unsafe filesystem characters', () => {
    expect(buildExchangeFilename('A/B:C*?')).toBe('A_B_C.aerodash.json')
  })

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

  it('downloaded blob omits operating-cost data by default', async () => {
    const profile = {
      ...createValidExportedProfile(),
      costPerHour: 185.5,
      fuelCostIncluded: false,
    } as unknown as AircraftProfile
    let capturedBlob: Blob | null = null
    createObjectURL.mockImplementation((arg: Blob) => {
      capturedBlob = arg
      return 'blob:capture'
    })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadProfileAsJson(profile)

    expect(capturedBlob).not.toBeNull()
    const text = await (capturedBlob as unknown as Blob).text()
    const exportedProfile = (JSON.parse(text) as { profile: Record<string, unknown> }).profile
    expect(exportedProfile).not.toHaveProperty('costPerHour')
    expect(exportedProfile).not.toHaveProperty('fuelCostIncluded')

    clickSpy.mockRestore()
  })
})

describe('occupancy exchange contract', () => {
  it.each(['required', 'optional', undefined] as const)('roundtrips %s occupancy', (occupancy) => {
    const raw = createValidExportedProfile()
    Object.assign((raw.loadPoints as Record<string, unknown>[])[0]!, { occupancy })
    const parsed = importProfileFromJson(JSON.stringify(raw))
    const restored = importProfileFromJson(exportProfileToJson(parsed))
    expect(restored.loadPoints[0]!.occupancy).toBe(occupancy)
  })
})
