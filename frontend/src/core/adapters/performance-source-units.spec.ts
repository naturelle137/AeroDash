import { describe, expect, it } from 'vitest'
import { normalizePerformanceTable } from './performance-source-units'
import { migrateProfileDocument } from '../logic/profile-migrations'
import { computePohDistances } from '../logic/performance.poh-distance'
import { testPohAircraft } from '../../../tests/fixtures/poh-aircraft'

const sourceUnits = { mass: 'lb', pressureAltitude: 'm', temperature: '°F', distance: 'ft' } as const
const point = { mass: 2000, pressureAltitude: 304.8, temperature: 50, distance: 1000 }
const raw = { flightPhase: 'TakeoffRoll', sourceUnits, dataPoints: [point] }

describe('performance source units', () => {
  it.each([
    [point, { mass: 907.18474, pressureAltitude: 1000, temperature: 10, distance: 304.8 }],
    [{ mass: 1, pressureAltitude: -30.48, temperature: -40, distance: 1 },
      { mass: 0.45359237, pressureAltitude: -100, temperature: -40, distance: 0.3048 }],
    [{ mass: 100, pressureAltitude: 0, temperature: 32, distance: 100 },
      { mass: 45.359237, pressureAltitude: 0, temperature: 0, distance: 30.48 }],
    [{ mass: 100, pressureAltitude: 609.6, temperature: 212, distance: 0 },
      { mass: 45.359237, pressureAltitude: 2000, temperature: 100, distance: 0 }],
  ])('matches independent definition-based vector %j', (input, expected) => {
    const result = normalizePerformanceTable({ ...raw, dataPoints: [input] })
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    for (const axis of ['mass', 'pressureAltitude', 'temperature', 'distance'] as const) {
      expect(result.table.dataPoints[0]![axis]).toBeCloseTo(expected[axis], 10)
    }
  })

  it('preserves identity for declared normalized and undeclared legacy tables', () => {
    for (const units of [undefined, { mass: 'kg', pressureAltitude: 'ft', temperature: '°C', distance: 'm' }]) {
      expect(normalizePerformanceTable({ ...raw, sourceUnits: units })).toMatchObject({
        status: 'success', table: { dataPoints: [point] },
      })
    }
  })

  it('handles every mixed unit combination independently without mutation or double conversion', () => {
    for (const mass of ['kg', 'lb']) for (const pressureAltitude of ['ft', 'm']) {
      for (const temperature of ['°C', '°F']) for (const distance of ['m', 'ft']) {
        const input = { ...raw, sourceUnits: { mass, pressureAltitude, temperature, distance } }
        const snapshot = JSON.stringify(input)
        const first = normalizePerformanceTable(input)
        expect(normalizePerformanceTable(input)).toEqual(first)
        expect(JSON.stringify(input)).toBe(snapshot)
        expect(first).toMatchObject({ status: 'success', table: { dataPoints: [{
          mass: mass === 'kg' ? 2000 : 907.18474,
          pressureAltitude: pressureAltitude === 'ft' ? 304.8 : 1000,
          temperature: temperature === '°C' ? 50 : 10,
          distance: distance === 'm' ? 1000 : 304.8,
        }] } })
      }
    }
  })

  it.each([
    { sourceUnits: {} }, { sourceUnits: { mass: 'kg' } }, { sourceUnits: null },
    { sourceUnits: { ...sourceUnits, distance: 'yd' } },
    { sourceUnits: { ...sourceUnits, temperature: 'K' } },
    { sourceUnits: { ...sourceUnits, mass: 'lbs' } },
    { sourceUnits: { ...sourceUnits, pressureAltitude: 'FL' } },
    { sourceUnits: { ...sourceUnits, altitude: 'ft' } },
    { units: sourceUnits }, { sourceUnit: 'kg' },
    { dataPoints: [{ ...point, unit: 'm' }] },
    { dataPoints: [{ ...point, distance: Infinity }] },
    { dataPoints: [{ ...point, temperature: NaN }] },
    { dataPoints: [{ ...point, pressureAltitude: Number.MAX_VALUE }] },
  ])('rejects unsupported, incomplete, conflicting or nonfinite source %j', (patch) => {
    expect(normalizePerformanceTable({ ...raw, ...patch }).status).toBe('failure')
  })

  it('migrates legacy points unchanged and rejects bad declarations at rest', () => {
    const legacy = testPohAircraft()
    legacy.sourceUnit = 'lb'
    const result = migrateProfileDocument(legacy)
    expect(result).toMatchObject({ kind: 'migrated', versionsApplied: [1], profile: {
      schemaVersion: 2, performanceProfiles: legacy.performanceProfiles,
    } })
    const bad = { ...legacy, performanceProfiles: [{ ...raw, sourceUnits: { mass: 'kg' } }] }
    expect(migrateProfileDocument(bad).kind).toBe('corrupt')
  })

  it('normalizes in the core facade for every caller, retaining source data across repeated lookups', () => {
    const profile = testPohAircraft()
    profile.performanceProfiles!.forEach((table) => {
      table.sourceUnits = sourceUnits
      table.dataPoints = [{ ...point }]
    })
    const snapshot = JSON.stringify(profile)
    for (let i = 0; i < 2; i++) {
      const result = computePohDistances(profile, { mass: 907.18474, pressureAltitude: 1000, temperature: 10 })
      expect(result).toMatchObject({ status: 'success', distances: {
        takeoffRoll: 304.8, takeoffDistance50ft: 304.8, landingRoll: 304.8, landingDistance50ft: 304.8,
      } })
    }
    expect(JSON.stringify(profile)).toBe(snapshot)
  })
})
