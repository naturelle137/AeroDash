import { describe, expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { MAX_FLEET_IMPORT_BYTES, previewFleetRestore, validateFleetImportFile } from '../services/fleet.import'

const backup = (changes = {}) => JSON.stringify({
  exportSchemaVersion: 1, exportedAt: '2026-01-01T00:00:00Z', profileCount: 1,
  profiles: [testPohAircraft()], ...changes,
})

describe('fleet backup validation', () => {
  it('migrates every profile, generates fresh identities and removes verification only', () => {
    const source = testPohAircraft()
    source.verification = { verifiedOn: '2026-01-01', verifiedBy: 'TS', pohRevision: 'Synthetic', sourceWeighingDate: '2026-01-01' }
    const [profile] = previewFleetRestore(backup({ profiles: [source] }))
    expect(profile!.id).not.toBe(source.id)
    expect(profile).toEqual({ ...source, schemaVersion: 2, id: profile!.id, status: 'draft', verification: undefined })
  })

  it.each([
    ['future envelope', { exportSchemaVersion: 2 }],
    ['missing version', { exportSchemaVersion: null }],
    ['mismatched count', { profileCount: 2 }],
    ['fractional count', { profileCount: 1.5 }],
    ['empty batch', { profileCount: 0, profiles: [] }],
    ['excessive count', { profileCount: 101 }],
    ['bad timestamp', { exportedAt: 'never' }],
    ['invalid profile', { profiles: [{ ...testPohAircraft(), weighingReports: [] }] }],
    ['future profile', { profiles: [{ ...testPohAircraft(), schemaVersion: 999 }] }],
    ['duplicate registrations', { profileCount: 2, profiles: [testPohAircraft(), { ...testPohAircraft(), registration: 'd-test' }] }],
    ['invalid registration', { profiles: [{ ...testPohAircraft(), registration: 'A------' }] }],
  ])('rejects %s', (_name, changes) => {
    expect(() => previewFleetRestore(backup(changes))).toThrow(/failed|conflict/i)
  })

  it.each(['{', 'null', '[]', 'true'])('rejects malformed envelope %s', (text) => {
    expect(() => previewFleetRestore(text)).toThrow(/failed|conflict/i)
  })

  it('checks file bounds/type before reading', () => {
    for (const size of [0, MAX_FLEET_IMPORT_BYTES + 1, Infinity, NaN]) {
      expect(() => validateFleetImportFile({ size, name: 'backup.json', type: 'application/json' } as File)).toThrow(/failed|conflict/i)
    }
    for (const [name, type] of [['backup.txt', 'application/json'], ['backup.json', 'text/html']]) {
      expect(() => validateFleetImportFile({ size: 10, name, type } as File)).toThrow(/failed|conflict/i)
    }
    expect(() => validateFleetImportFile({ size: MAX_FLEET_IMPORT_BYTES, name: 'backup.JSON', type: '' } as File)).not.toThrow(/failed|conflict/i)
    expect(() => previewFleetRestore(' '.repeat(MAX_FLEET_IMPORT_BYTES + 1))).toThrow('5 MB')
  })
})
