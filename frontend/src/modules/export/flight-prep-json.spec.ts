import { describe, expect, it } from 'vitest'
import { EMPTY_MANUAL_RUNWAY_DRAFT, createManualRunwayRecord, validateManualRunway } from '@/core/logic/manual-runway'
import { buildFlightPrepJson, type FlightPrepExport } from './flight-prep-json'

describe('flight preparation JSON runway dates', () => {
  it('exports both date checks without treating an edited declaration as current', () => {
    const validation = validateManualRunway({ ...EMPTY_MANUAL_RUNWAY_DRAFT, aerodrome: 'TEST', designator: '09', tora: '1000', toraUnit: 'm', lda: '900', ldaUnit: 'm', fieldElevation: '10', fieldElevationUnit: 'm', surfaceType: 'paved', surfaceCondition: 'dry', effectiveDate: '2026-07-01', expiryDate: '2026-07-31' })
    if (validation.status !== 'valid') throw new Error('Invalid synthetic runway')
    const runway: FlightPrepExport['runway'] = { draft: { ...EMPTY_MANUAL_RUNWAY_DRAFT }, saved: createManualRunwayRecord(validation.runway, new Date('2026-07-01T00:00:00Z')), weatherSurface: null, assessmentDate: '2026-07-01', deviceDate: '2026-08-01', automaticDate: false }
    const data = { runway } as FlightPrepExport
    const check = () => JSON.parse(buildFlightPrepJson(data, new Date('2026-08-01T12:00:00Z'))).runway.dateCheck
    expect(check()).toMatchObject({ selected: 'within-declared-dates', device: 'expired', notice: expect.stringContaining('NOTAM/SUP coverage is unknown') })
    expect(check().intervals).toMatchObject({ selected: { effect: 0, expiry: 30 }, device: { effect: -31, expiry: -1 } })
    runway.saved = null
    runway.draft.effectiveDate = '2026-07-01'
    runway.draft.expiryDate = '2026-07-31'
    expect(check()).toMatchObject({ selected: 'unknown', device: 'unknown', draft: { selected: 'within-declared-dates', device: 'expired' } })
    expect(check().intervals).toMatchObject({ selected: { effect: null, expiry: null }, draft: { device: { effect: -31, expiry: -1 } } })
    runway.draft.effectiveDate = '2026-08-02'
    expect(check().intervals.draft.device).toEqual({ effect: null, expiry: null })
    expect(check().draft).toEqual({ selected: 'unknown', device: 'unknown' })
  })
})
