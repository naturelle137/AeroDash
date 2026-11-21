import { describe, expect, it } from 'vitest'
import { buildHandoverFile, handoverMismatch, parseHandoverFile } from './handover'
import { MAX_HANDOVER_BYTES } from '../domain/handover.schema'

const entries = {
  fuel: { method: 'duration' as const, sequence: 'A', directTripFuel: '', consumption: '20', trip: '1.5', reserve: '0.75' },
  performance: {
    temperature: '15',
    pressureAltitude: { method: 'direct' as const, direct: '500', qnh: '', qnhUnit: 'hPa' as const, elevation: '', elevationUnit: 'ft' as const },
    corrections: {
      takeoff: { headwind: '5', slope: '' },
      landing: { headwind: '', slope: '' },
    },
    safetyFactors: {
      takeoff: { preset: 'poh-afm' as const, custom: '' },
      landing: { preset: 'poh-afm' as const, custom: '' },
    },
    obstacle: { height: '', heightUnit: 'ft' as const, distance: '', distanceUnit: 'ft' as const },
  },
}
const content = {
  aircraft: { registration: 'D-TEST' },
  massBalance: { activeCategory: 'Normal', stations: [{ name: 'Pilot', unit: 'kg', weight: 80, touched: true }, { name: 'Fuel', unit: 'L', weight: 40, touched: true }] },
  entries,
}
const at = new Date('2026-11-20T10:00:00Z')
const raw = () => JSON.parse(buildHandoverFile(content, at)) as Record<string, unknown>

describe('handover file', () => {
  it('round-trips as unreviewed', () => {
    const result = parseHandoverFile(buildHandoverFile(content, at))
    expect(result.ok && result.file.review).toBe('unreviewed')
    expect(result.ok && result.file.entries).toEqual(entries)
  })

  it('has no approval or verification fields', () => {
    const text = buildHandoverFile(content, at)
    expect(text).not.toMatch(/approv|signature|counter|verified/i)
  })

  it.each([
    ['approval field', { approval: { by: 'FI', at: '2026-11-20T10:00:00Z' } }],
    ['reviewed status', { review: 'approved' }],
    ['verified station flag', { massBalance: { activeCategory: 'Normal', stations: [{ name: 'Pilot', unit: 'kg', weight: 80, touched: true, verified: true }] } }],
    ['negative weight', { massBalance: { activeCategory: 'Normal', stations: [{ name: 'Pilot', unit: 'kg', weight: -1, touched: true }] } }],
    ['wrong format', { format: 'other' }],
  ])('rejects %s', (_label, patch) => {
    expect(parseHandoverFile(JSON.stringify({ ...raw(), ...patch })).ok).toBe(false)
  })

  it.each(['fuel', 'performance', 'performance.pressureAltitude', 'performance.corrections', 'performance.corrections.takeoff', 'performance.corrections.landing', 'performance.safetyFactors', 'performance.safetyFactors.takeoff', 'performance.safetyFactors.landing', 'performance.obstacle'])('rejects nested approval in %s', (path) => {
    const file = JSON.parse(buildHandoverFile(content, at))
    const target = path.split('.').reduce((value, key) => value[key], file.entries)
    target.approval = true
    expect(parseHandoverFile(JSON.stringify(file)).ok).toBe(false)
  })

  it('rejects invalid JSON, newer versions and oversize files', () => {
    expect(parseHandoverFile('{')).toMatchObject({ ok: false })
    expect(parseHandoverFile(JSON.stringify({ ...raw(), version: 3 }))).toMatchObject({ ok: false, error: expect.stringContaining('version') })
    expect(parseHandoverFile(' '.repeat(MAX_HANDOVER_BYTES + 1))).toMatchObject({ ok: false })
  })

  it('applies only to the same aircraft layout', () => {
    const file = (() => { const r = parseHandoverFile(buildHandoverFile(content, at)); if (!r.ok) throw new Error(); return r.file })()
    const own = { registration: 'd-test', stations: [{ name: 'Pilot', unit: 'kg' }, { name: 'Fuel', unit: 'L' }], categories: ['Normal'] }
    expect(handoverMismatch(file, own)).toBeNull()
    expect(handoverMismatch(file, { ...own, registration: 'D-ABCD' })).toContain('D-TEST')
    expect(handoverMismatch(file, { ...own, stations: [{ name: 'Pilot', unit: 'kg' }, { name: 'Baggage', unit: 'L' }] })).toContain('stations')
    expect(handoverMismatch(file, { ...own, stations: [{ name: 'Pilot', unit: 'kg' }] })).toContain('stations')
    expect(handoverMismatch(file, { ...own, stations: [{ name: 'Pilot', unit: 'lb' }, { name: 'Fuel', unit: 'L' }] })).toContain('stations')
    expect(handoverMismatch(file, { ...own, stations: [{ name: 'Pilot', unit: 'kg' }, { name: 'Fuel', unit: 'gal' }] })).toContain('stations')
    expect(handoverMismatch(file, { ...own, categories: ['Utility'] })).toContain('category')
  })
})
