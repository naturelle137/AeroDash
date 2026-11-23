import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportPersonalData } from './personal-data-export'

vi.mock('@/modules/aircraft/services/data-rights.service', () => ({
  exportAllProfiles: async () => ({ envelope: { exportSchemaVersion: 1, exportedAt: '2026-01-01T00:00:00Z', profileCount: 0, profiles: [] }, omitted: [] }),
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
    expect(result.omissions).toHaveLength(2)
    expect(result.complete).toBe(false)
    expect(JSON.stringify(result)).not.toContain('never export')
  })
  it('reports inaccessible storage and handles absent data', async () => {
    expect((await exportPersonalData()).complete).toBe(true)
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect((await exportPersonalData()).omissions).toHaveLength(3)
    spy.mockRestore()
  })
})
