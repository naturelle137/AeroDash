import { describe, expect, it } from 'vitest'
import {
  CURRENT_FLIGHTPREP_DRAFT_VERSION,
  FlightPrepDraftSchema,
  FlightPrepDraftStoreSchema,
} from './flightprep-draft.schema'

const operation = <T extends object>(v: T) => ({ takeoff: { ...v }, landing: { ...v } })

function validDraft() {
  return {
    aircraftId: 'plane-a',
    savedAt: '2026-01-01T10:00:00.000Z',
    fuel: { method: 'duration', sequence: '', directTripFuel: '', consumption: '10', trip: '120', reserve: '30' },
    performance: {
      temperature: '15',
      pressureAltitude: { method: 'qnh-elevation', direct: '', qnh: '1013', qnhUnit: 'hPa', elevation: '300', elevationUnit: 'ft' },
      corrections: operation({ headwind: '5', slope: '' }),
      safetyFactors: operation({ preset: 'poh-afm', custom: '' }),
      obstacle: { height: '50', heightUnit: 'ft', distance: '200', distanceUnit: 'm' },
    },
  }
}

describe('FlightPrepDraftSchema', () => {
  it('accepts a complete draft of raw entries', () => {
    expect(FlightPrepDraftSchema.safeParse(validDraft()).success).toBe(true)
  })

  it('rejects an empty aircraft id and a malformed timestamp', () => {
    expect(FlightPrepDraftSchema.safeParse({ ...validDraft(), aircraftId: '' }).success).toBe(false)
    expect(FlightPrepDraftSchema.safeParse({ ...validDraft(), savedAt: 'yesterday' }).success).toBe(false)
  })

  it('rejects unknown units, methods and presets', () => {
    const badUnit = validDraft()
    badUnit.performance.pressureAltitude.elevationUnit = 'furlong'
    const badMethod = validDraft()
    badMethod.fuel.method = 'guess'
    const badPreset = validDraft()
    badPreset.performance.safetyFactors.landing.preset = 'optimistic'
    for (const d of [badUnit, badMethod, badPreset]) expect(FlightPrepDraftSchema.safeParse(d).success).toBe(false)
  })

  it('bounds entry text length and rejects non-text entries', () => {
    const long = validDraft()
    long.performance.temperature = '1'.repeat(41)
    const numeric = { ...validDraft(), fuel: { ...validDraft().fuel, trip: 120 } }
    expect(FlightPrepDraftSchema.safeParse(long).success).toBe(false)
    expect(FlightPrepDraftSchema.safeParse(numeric).success).toBe(false)
  })

  it('rejects a draft with a missing section', () => {
    const { performance: _omit, ...rest } = validDraft()
    expect(FlightPrepDraftSchema.safeParse(rest).success).toBe(false)
  })
})

describe('FlightPrepDraftStoreSchema', () => {
  it('accepts the current version with unvalidated entries', () => {
    expect(FlightPrepDraftStoreSchema.safeParse({ version: CURRENT_FLIGHTPREP_DRAFT_VERSION, drafts: { a: { anything: 1 } } }).success).toBe(true)
  })

  it('rejects another version or a missing container', () => {
    expect(FlightPrepDraftStoreSchema.safeParse({ version: 2, drafts: {} }).success).toBe(false)
    expect(FlightPrepDraftStoreSchema.safeParse({ version: 1 }).success).toBe(false)
  })
})
