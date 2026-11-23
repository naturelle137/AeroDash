import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flightPrepUnits } from '@/modules/export/flight-prep-json'
import { exportPersonalData } from './personal-data-export'

const { profiles } = vi.hoisted(() => ({ profiles: [
  { id: 'a', sourceUnit: 'kg-m', loadPoints: [{}, { unit: 'L' }] },
  { id: 'b', sourceUnit: 'lb-in', loadPoints: [{}] },
] }))
vi.mock('@/modules/aircraft/services/data-rights.service', () => ({
  exportAllProfiles: async () => ({ envelope: { exportSchemaVersion: 1, exportedAt: '2026-01-01T00:00:00Z', profileCount: profiles.length, profiles }, omitted: [] }),
}))

const session = (aircraftId: string) => ({ version: 1, aircraftId, activeCategory: 'Normal', stations: [{ index: 0, weight: 42, touched: true, verified: false }], savedAt: '2026-01-01T00:00:00Z' })

describe('personal data copy', () => {
  beforeEach(() => localStorage.clear())
  it('includes active and per-aircraft sessions and reports malformed entries', async () => {
    localStorage.setItem('aerodash:session:payload', JSON.stringify(session('a')))
    localStorage.setItem('aerodash:session:by-aircraft', JSON.stringify({ b: session('b'), c: session('wrong') }))
    localStorage.setItem('aerodash:flightprep:draft', '{bad')
    localStorage.setItem('aerodash:secret', 'never export')
    const result = await exportPersonalData()
    expect(result.sessions.map((s) => s.aircraftId)).toEqual(['a', 'b'])
    expect(result.sessions.map(s => s.stations[0]?.unit)).toEqual(['kg', 'lb'])
    expect(result.omissions).toHaveLength(2)
    expect(result.complete).toBe(false)
    expect(JSON.stringify(result)).not.toContain('never export')
  })
  it('keeps explicit station units and reports missing profiles', async () => {
    localStorage.setItem('aerodash:session:by-aircraft', JSON.stringify({
      a: { ...session('a'), stations: [{ ...session('a').stations[0], index: 1 }] },
      missing: session('missing'),
    }))
    const result = await exportPersonalData()
    expect(result.sessions.map(s => s.stations[0]?.unit)).toEqual(['L', null])
    expect(result.complete).toBe(false)
  })
  it('exports saved runways with units and provenance', async () => {
    const record = (designator: string, unit: 'm' | 'ft') => ({
      schemaVersion: 3, savedAt: '2026-01-01T00:00:00Z',
      runway: { aerodrome: 'EDXX', designator, source: 'Pilot source', tora: { value: 900, unit }, lda: { value: 800, unit }, fieldElevation: { value: 100, unit }, surface: { type: 'paved', condition: 'dry' } },
      weatherSurface: { station: 'EDXX', time: '2026-01-01T00:00:00Z' },
    })
    const first = record('09', 'm')
    const second = record('27', 'ft')
    localStorage.setItem('aerodash.performance.manual-runway.v1', JSON.stringify(first))
    localStorage.setItem('aerodash.performance.recent-airports.v1', JSON.stringify([first, second]))
    const result = await exportPersonalData()
    expect(result.manualRunway).toEqual(first)
    expect(result.recentRunways).toEqual([first, second])
    expect(result.complete).toBe(true)
  })
  it('includes notes and reports malformed runway and note entries', async () => {
    const note = { id: '1', aircraftId: 'a', anchor: 'takeoff', author: 'Pilot', text: 'Private note', createdAt: 'now', updatedAt: 'now' }
    localStorage.setItem('aerodash:annotations:v1', JSON.stringify([note, { author: 'bad' }]))
    localStorage.setItem('aerodash.performance.manual-runway.v1', '{}')
    localStorage.setItem('aerodash.performance.recent-airports.v1', JSON.stringify([{}]))
    const result = await exportPersonalData()
    expect(result.notes).toEqual([note])
    expect(result.omissions).toHaveLength(3)
    expect(result.complete).toBe(false)
    expect(result.units).toEqual(flightPrepUnits)
  })
  it('reports inaccessible storage and handles absent data', async () => {
    expect((await exportPersonalData()).complete).toBe(true)
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect((await exportPersonalData()).omissions).toHaveLength(6)
    spy.mockRestore()
  })
})
