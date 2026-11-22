import { describe, expect, it } from 'vitest'
import { compareWindLimits } from './wind-limits'
import type { AircraftProfileWindLimit } from '../adapters/aircraft.schema'

const limits: AircraftProfileWindLimit[] = [
  { component: 'MaxCrosswind', value: 10, classification: 'Demonstrated' },
  { component: 'MaxTailwind', value: 5, classification: 'Limit' },
  { component: 'MaxTotalWind', value: 20, classification: 'Limit' },
  { component: 'MaxGust', value: 30, classification: 'Limit' },
]
const input = (direction: string, windSpeed = '20', unit = 'kt') => ({ runwayHeading: '90', windDirection: direction, windSpeed, unit })

describe('manual wind limit comparison', () => {
  it('distinguishes both crosswind sides and tailwind from headwind', () => {
    expect(compareWindLimits(input('180'), limits).map(n => n.id)).toEqual(['WARN-WX-001'])
    expect(compareWindLimits(input('360'), limits).map(n => n.id)).toEqual(['WARN-WX-001'])
    expect(compareWindLimits(input('270'), limits).map(n => n.id)).toEqual(['CRIT-WX-001'])
    expect(compareWindLimits(input('90'), limits)).toEqual([])
  })
  it('uses unrounded components, units, strict boundaries and reports multiple exceedances', () => {
    expect(compareWindLimits(input('180', '18.52', 'km/h'), limits)).toEqual([])
    expect(compareWindLimits(input('180', '10.01'), limits)).toHaveLength(1)
    expect(compareWindLimits(input('225', '25'), limits).map(n => n.id)).toEqual(['WARN-WX-001', 'CRIT-WX-001', 'CRIT-WX-001'])
    expect(compareWindLimits(input('180', '6', 'm/s'), limits)).toHaveLength(1)
  })
  it('does not invent results for invalid inputs, missing or invalid limits, or gusts', () => {
    expect(compareWindLimits(input('VRB'), limits)).toEqual([])
    expect(compareWindLimits(input('180'), undefined)).toEqual([])
    expect(compareWindLimits(input('180'), [{ ...limits[0]!, value: NaN }, limits[3]!])).toEqual([])
  })
})

describe('manual gust limit comparison', () => {
  it('compares gust speed with stored gust limits only for valid gusts', () => {
    const gustLimits: AircraftProfileWindLimit[] = [
      { component: 'MaxGust', value: 10, classification: 'Demonstrated' },
      { component: 'MaxGust', value: 20, classification: 'Limit' },
    ]
    expect(compareWindLimits(input('180', '25'), gustLimits)).toEqual([])
    expect(compareWindLimits({ ...input('180', '1', 'km/h'), gustSpeed: '18.52' }, gustLimits)).toEqual([])
    expect(compareWindLimits({ ...input('180', '1'), gustSpeed: '20' }, gustLimits).map(n => n.id)).toEqual(['WARN-WX-001'])
    expect(compareWindLimits({ ...input('180', '1', 'm/s'), gustSpeed: '11' }, gustLimits).map(n => n.id)).toEqual(['WARN-WX-001', 'CRIT-WX-001'])
    expect(compareWindLimits({ ...input('180', '1'), gustSpeed: 'invalid' }, gustLimits)).toEqual([])
  })
  it('compares total, tailwind and crosswind with unrounded boundaries and units', () => {
    const gust = { ...input('225', '5'), gustSpeed: '25' }
    expect(compareWindLimits(gust, limits).map(n => n.id)).toEqual(['WARN-WX-001', 'CRIT-WX-001', 'CRIT-WX-001'])
    expect(compareWindLimits({ ...input('180', '1', 'km/h'), gustSpeed: '18.52' }, limits)).toEqual([])
    expect(compareWindLimits({ ...input('180', '1', 'm/s'), gustSpeed: '6' }, limits)[0]?.message).toContain('manual gust')
  })
  it('does not compare missing or malformed gusts or missing direction, heading or limits', () => {
    for (const gustSpeed of ['', 'VRB', '-1', '201']) expect(compareWindLimits({ ...input('180', '1'), gustSpeed }, limits)).toEqual([])
    expect(compareWindLimits({ ...input('', '0'), gustSpeed: '25' }, limits)).toEqual([])
    expect(compareWindLimits({ ...input('180', '1'), runwayHeading: '', gustSpeed: '25' }, limits)).toEqual([])
    expect(compareWindLimits({ ...input('180', '1'), gustSpeed: '25' })).toEqual([])
  })
})
