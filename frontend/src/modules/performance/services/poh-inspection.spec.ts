import { describe, expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { inspectPohDistances, inspectTables } from './poh-inspection'

const now = new Date('2026-11-12T12:00:00Z')
const inputs = { mass: '900', pressureAltitude: '1000', temperature: '10' }

describe('raw table inspection service', () => {
  it('interpolates four distinct synthetic values and accepts exact envelope edges', () => {
    expect(inspectPohDistances(testPohAircraft(), inputs, now)).toEqual({ status: 'success', distances: {
      takeoffRoll: 220, takeoffDistance50ft: 320, landingRoll: 420, landingDistance50ft: 520,
    } })
    for (const values of [
      { mass: '800', pressureAltitude: '0', temperature: '0' },
      { mass: '1000', pressureAltitude: '2000', temperature: '20' },
    ]) expect(inspectPohDistances(testPohAircraft(), values, now).status).toBe('success')
  })

  it.each(['', ' ', 'NaN', 'Infinity', '-Infinity', '1e999', 'abc', '0x10'])('blocks unsupported text %j in every field', (text) => {
    for (const axis of ['mass', 'pressureAltitude', 'temperature'] as const) {
      expect(inspectPohDistances(testPohAircraft(), { ...inputs, [axis]: text }, now)).toMatchObject({ status: 'blocked', reason: 'input' })
    }
  })

  it.each(['0', '-1'])('blocks nonpositive mass %s', (mass) => {
    expect(inspectPohDistances(testPohAircraft(), { ...inputs, mass }, now)).toMatchObject({ status: 'blocked', reason: 'input' })
  })

  it('blocks outside either edge of every axis of every phase, even when other grids support it', () => {
    for (let phase = 0; phase < 4; phase++) {
      for (const axis of ['mass', 'pressureAltitude', 'temperature'] as const) {
        const p = testPohAircraft()
        const range = axis === 'mass' ? [850, 950] : axis === 'pressureAltitude' ? [500, 1500] : [5, 15]
        const original = axis === 'mass' ? 800 : 0
        p.performanceProfiles![phase]!.dataPoints.forEach((point) => { point[axis] = point[axis] === original ? range[0]! : range[1]! })
        for (const value of [range[0]! - 1, range[1]! + 1]) {
          expect(inspectPohDistances(p, { ...inputs, [axis]: String(value) }, now)).toMatchObject({ status: 'blocked', reason: 'envelope' })
        }
      }
    }
  })

  it('blocks invalid schema, Draft, expired review, missing and duplicate phases', () => {
    expect(inspectPohDistances({}, inputs, now)).toMatchObject({ status: 'blocked', reason: 'profile' })
    const p = testPohAircraft()
    p.status = 'draft'
    expect(inspectPohDistances(p, inputs, now)).toMatchObject({ status: 'blocked', reason: 'draft' })
    p.status = 'verified'
    p.verification = { verifiedBy: 'TS', verifiedOn: '2026-01-01', pohRevision: 'Test only', sourceWeighingDate: '2026-01-01' }
    expect(inspectPohDistances(p, inputs, now)).toMatchObject({ status: 'blocked', reason: 'draft' })
    delete p.verification
    p.performanceProfiles!.push(p.performanceProfiles![0]!)
    expect(inspectTables(p)).toMatchObject({ status: 'blocked', reason: 'tables' })
    p.performanceProfiles = []
    expect(inspectTables(p)).toMatchObject({ status: 'blocked', reason: 'tables' })
  })

  it('blocks zero/negative/nonfinite distances and malformed coordinates/grids', () => {
    for (const distance of [0, -1, Infinity, NaN]) {
      const p = testPohAircraft()
      p.performanceProfiles![3]!.dataPoints[0]!.distance = distance
      expect(inspectPohDistances(p, inputs, now).status).toBe('blocked')
    }
    const missing = testPohAircraft()
    missing.performanceProfiles![2]!.dataPoints.pop()
    expect(inspectTables(missing)).toMatchObject({ status: 'blocked', reason: 'tables' })
    const duplicate = testPohAircraft()
    duplicate.performanceProfiles![1]!.dataPoints[0] = duplicate.performanceProfiles![1]!.dataPoints[1]!
    expect(inspectTables(duplicate)).toMatchObject({ status: 'blocked', reason: 'tables' })
  })

  it('rejects unsupported versions and grids with no shared envelope', () => {
    const future = testPohAircraft()
    future.schemaVersion = 2
    expect(inspectTables(future)).toMatchObject({ status: 'blocked', reason: 'profile' })
    const disjoint = testPohAircraft()
    disjoint.performanceProfiles![3]!.dataPoints.forEach((point) => { point.mass += 1000 })
    expect(inspectTables(disjoint)).toMatchObject({ status: 'blocked', reason: 'envelope' })
  })

})
