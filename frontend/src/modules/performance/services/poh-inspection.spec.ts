import { describe, expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { assessPerformance, inspectTables, massSourceFromText, type PerformanceAssessment } from './poh-inspection'

/** Standalone shape: one entered mass for both groups. */
function inspectPohDistances(profile: unknown, values: { mass: string; pressureAltitude: string; temperature: string }, at: Date) {
  const mass = massSourceFromText(values.mass, 'entered lookup mass')
  return flatten(assessPerformance(profile, { takeoff: mass, landing: mass, pressureAltitude: values.pressureAltitude, temperature: values.temperature }, at))
}
function flatten(result: PerformanceAssessment) {
  if (result.status === 'blocked') return result
  const groups = [result.takeoff, result.landing]
  const failed = groups.find((group) => group.status === 'blocked')
  if (failed?.status === 'blocked') return { status: 'blocked' as const, reason: failed.reason === 'mass' ? 'input' : failed.reason, message: failed.message }
  const distances = Object.fromEntries(groups.flatMap((group) => group.status === 'success'
    ? group.distances.map((row) => [({ TakeoffRoll: 'takeoffRoll', TakeoffDistance50ft: 'takeoffDistance50ft', LandingRoll: 'landingRoll', LandingDistance50ft: 'landingDistance50ft' } as const)[row.phase], row.distance])
    : []))
  const capped = groups.some((group) => group.status === 'success' && group.distances.some((row) => row.massTreatment === 'benefit-capped'))
  return { status: 'success' as const, distances, ...(capped ? { capped } : {}) }
}

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
        // Below the mass minimum is benefit-capped; every other excursion blocks.
        const values = axis === 'mass' ? [range[1]! + 1] : [range[0]! - 1, range[1]! + 1]
        for (const value of values) {
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

  it('rejects unsupported versions', () => {
    const future = testPohAircraft()
    future.schemaVersion = 4
    expect(inspectTables(future)).toMatchObject({ status: 'blocked', reason: 'profile' })
  })

})

it('interpolates the same grid when each phase declares different source units', () => {
  const profile = testPohAircraft()
  profile.sourceUnit = 'lb'
  const declarations = [
    { mass: 'kg', pressureAltitude: 'ft', temperature: '°C', distance: 'm' },
    { mass: 'lb', pressureAltitude: 'ft', temperature: '°F', distance: 'ft' },
    { mass: 'kg', pressureAltitude: 'm', temperature: '°F', distance: 'm' },
    { mass: 'lb', pressureAltitude: 'm', temperature: '°C', distance: 'ft' },
  ] as const
  profile.performanceProfiles!.forEach((table, index) => {
    const units = declarations[index]!
    table.sourceUnits = units
    table.dataPoints = table.dataPoints.map((point) => ({
      mass: units.mass === 'lb' ? point.mass / 0.45359237 : point.mass,
      pressureAltitude: units.pressureAltitude === 'm' ? point.pressureAltitude * 0.3048 : point.pressureAltitude,
      temperature: units.temperature === '°F' ? point.temperature * 1.8 + 32 : point.temperature,
      distance: units.distance === 'ft' ? point.distance / 0.3048 : point.distance,
    }))
  })
  const original = JSON.stringify(profile.performanceProfiles)
  for (let i = 0; i < 2; i++) {
    const result = inspectPohDistances(profile, inputs, now)
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    for (const [key, expected] of Object.entries({ takeoffRoll: 220, takeoffDistance50ft: 320, landingRoll: 420, landingDistance50ft: 520 })) {
      expect(result.distances[key as keyof typeof result.distances]).toBeCloseTo(expected, 10)
    }
  }
  expect(JSON.stringify(profile.performanceProfiles)).toBe(original)
})

describe('takeoff and landing assessment with separate masses', () => {
  const ready = (massKg: number, origin = 'test mass') => ({ status: 'ready' as const, massKg, origin })
  const assess = (takeoff: Parameters<typeof assessPerformance>[1]['takeoff'], landing: Parameters<typeof assessPerformance>[1]['landing'], profile: unknown = testPohAircraft()) =>
    assessPerformance(profile, { takeoff, landing, pressureAltitude: 1000, temperature: '10' }, now)
  // Fixture distance = 100 + phase × 100 + (mass − 800) + PA / 100 + temperature.
  const expected = (phase: number, mass: number) => 100 + phase * 100 + (mass - 800) + 10 + 10

  it('looks up takeoff tables with the takeoff mass and landing tables with the landing mass', () => {
    const result = assess(ready(950), ready(870))
    expect(result.status).toBe('assessed')
    if (result.status !== 'assessed') return
    expect(result.takeoff).toMatchObject({ status: 'success', massKg: 950 })
    expect(result.landing).toMatchObject({ status: 'success', massKg: 870 })
    if (result.takeoff.status !== 'success' || result.landing.status !== 'success') return
    expect(result.takeoff.distances.map((row) => row.distance)).toEqual([expected(0, 950), expected(1, 950)])
    expect(result.landing.distances.map((row) => row.distance)).toEqual([expected(2, 870), expected(3, 870)])
    expect([...result.takeoff.distances, ...result.landing.distances].every((row) => row.massTreatment === 'tabulated')).toBe(true)
  })

  it('keeps a valid takeoff result when the landing mass is missing, invalid or above the table', () => {
    for (const landing of [
      { status: 'unavailable' as const, reason: 'No trip-arrival mass.' },
      massSourceFromText('abc', 'x'),
      ready(1000.5),
    ]) {
      const result = assess(ready(900), landing)
      expect(result).toMatchObject({ status: 'assessed', takeoff: { status: 'success' }, landing: { status: 'blocked' } })
    }
    expect(assess(ready(900), { status: 'unavailable', reason: 'No trip-arrival mass.' }))
      .toMatchObject({ landing: { status: 'blocked', reason: 'mass', massKg: null, message: 'No trip-arrival mass.' } })
  })

  it('caps a below-minimum mass and labels it, never returning less than the minimum-mass distance', () => {
    const result = assess(ready(900), ready(640.25))
    if (result.status !== 'assessed' || result.landing.status !== 'success') throw new Error('expected landing')
    expect(result.landing.distances.map((row) => [row.distance, row.massTreatment, row.lookupMass])).toEqual([
      [expected(2, 800), 'benefit-capped', 800], [expected(3, 800), 'benefit-capped', 800],
    ])
  })

  it('blocks a mass above the table maximum with the upper-bound reason, even by a fraction', () => {
    const result = assess(ready(1000.01), ready(900))
    expect(result).toMatchObject({ takeoff: { status: 'blocked', reason: 'envelope', massKg: 1000.01 }, landing: { status: 'success' } })
    if (result.status !== 'assessed' || result.takeoff.status !== 'blocked') throw new Error('Expected blocked takeoff')
    expect(result.takeoff.message).toContain('above the table maximum 1000 kg')
    expect(result.takeoff.message).toContain('Upper-bound extrapolation is unsupported')
  })

  it('evaluates each phase against its own envelope when tables differ', () => {
    const profile = testPohAircraft()
    // Landing tables tabulate 700–900 kg; takeoff tables keep 800–1000 kg.
    for (const index of [2, 3]) profile.performanceProfiles![index]!.dataPoints.forEach((point) => { point.mass -= 100 })
    const tables = inspectTables(profile)
    expect(tables).toMatchObject({ status: 'ready', bounds: { TakeoffRoll: { mass: { min: 800, max: 1000 } }, LandingRoll: { mass: { min: 700, max: 900 } } } })
    expect(assess(ready(950), ready(950), profile)).toMatchObject({ takeoff: { status: 'success' }, landing: { status: 'blocked', reason: 'envelope' } })
    const capped = assess(ready(750), ready(750), profile)
    if (capped.status !== 'assessed' || capped.takeoff.status !== 'success' || capped.landing.status !== 'success') throw new Error('expected both')
    expect(capped.takeoff.distances[0]).toMatchObject({ massTreatment: 'benefit-capped', lookupMass: 800 })
    expect(capped.landing.distances[0]).toMatchObject({ massTreatment: 'tabulated', lookupMass: 750 })
  })

  it('normalizes lb mass tables before the mass policy is applied', () => {
    const profile = testPohAircraft()
    profile.performanceProfiles!.forEach((table) => {
      table.sourceUnits = { mass: 'lb', pressureAltitude: 'ft', temperature: '°C', distance: 'm' }
      table.dataPoints.forEach((point) => { point.mass = point.mass / 0.45359237 })
    })
    const result = assess(ready(900), ready(799), profile)
    if (result.status !== 'assessed' || result.takeoff.status !== 'success' || result.landing.status !== 'success') throw new Error('expected both')
    expect(result.takeoff.distances[0]!.distance).toBeCloseTo(expected(0, 900), 9)
    expect(result.landing.distances[0]!.massTreatment).toBe('benefit-capped')
    expect(result.landing.distances[0]!.lookupMass).toBeCloseTo(800, 9)
    expect(assess(ready(1000.001), ready(900), profile)).toMatchObject({ takeoff: { status: 'blocked', reason: 'envelope' }, landing: { status: 'success' } })
  })

  it('blocks both groups for nonfinite conditions without a distance', () => {
    expect(assessPerformance(testPohAircraft(), { takeoff: ready(900), landing: ready(900), pressureAltitude: Number.NaN, temperature: '10' }, now))
      .toMatchObject({ status: 'blocked', reason: 'input' })
    expect(assessPerformance(testPohAircraft(), { takeoff: ready(900), landing: ready(900), pressureAltitude: 1000, temperature: '' }, now))
      .toMatchObject({ status: 'blocked', reason: 'input' })
  })
})
