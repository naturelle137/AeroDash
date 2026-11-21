import { describe, expect, it } from 'vitest'
import { testPohAircraft } from '../../../../tests/fixtures/poh-aircraft'
import { presentOperationalAssessment, presentPerformance } from './performance-presentation'
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

  it('blocks below the lower edge, and above the extrapolation band, of every axis of every phase', () => {
    for (let phase = 0; phase < 4; phase++) {
      for (const axis of ['mass', 'pressureAltitude', 'temperature'] as const) {
        const p = testPohAircraft()
        const range = axis === 'mass' ? [850, 950] : axis === 'pressureAltitude' ? [500, 1500] : [5, 15]
        const original = axis === 'mass' ? 800 : 0
        p.performanceProfiles![phase]!.dataPoints.forEach((point) => { point[axis] = point[axis] === original ? range[0]! : range[1]! })
        // Below the mass minimum is benefit-capped; upper values past the 10 % band block.
        const beyond = Math.ceil(range[1]! * 1.1) + 1
        const values = axis === 'mass' ? [beyond] : [range[0]! - 1, beyond]
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
      ready(1101),
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

  it('blocks a mass more than 10 % above the table maximum and names the limit', () => {
    const result = assess(ready(1100.01), ready(900))
    expect(result).toMatchObject({ takeoff: { status: 'blocked', reason: 'envelope', massKg: 1100.01 }, landing: { status: 'success' } })
    if (result.status !== 'assessed' || result.takeoff.status !== 'blocked') throw new Error('Expected blocked takeoff')
    expect(result.takeoff.message).toContain('exceeds the table maximum 1000 kg by more than the fixed 10 % extrapolation limit')
  })

  it('blocks an upper excursion when a source prohibits extrapolation', () => {
    const profile = testPohAircraft()
    profile.performanceProfiles![0]!.extrapolation = 'prohibited'
    const result = assessPerformance(profile, { takeoff: ready(1100), landing: ready(900), pressureAltitude: 1000, temperature: '10' }, now)
    if (result.status !== 'assessed') throw new Error('Expected assessed')
    expect(result.takeoff.status).toBe('blocked')
    expect(result.takeoff).not.toHaveProperty('distances')
    expect(result.landing.status).toBe('success')
  })

  it('propagates a source prohibition to a missing sibling and rejects unknown declarations', () => {
    const profile = testPohAircraft()
    profile.performanceProfiles![0]!.extrapolation = 'prohibited'
    profile.performanceProfiles = profile.performanceProfiles!.filter((table) => table.flightPhase !== 'TakeoffDistance50ft')
    expect(assess(ready(1050), ready(900), profile)).toMatchObject({ takeoff: { status: 'blocked' }, landing: { status: 'success' } })
    expect(inspectTables({ ...profile, performanceProfiles: [{ ...profile.performanceProfiles[0], extrapolation: 'allowed' }] })).toMatchObject({ status: 'blocked', reason: 'profile' })
  })

  it('applies the fixed 20 % penalty to the boundary distance for each upper axis within 10 %', () => {
    const at = (mass: number, pressureAltitude: number, temperature: string) =>
      assessPerformance(testPohAircraft(), { takeoff: ready(mass), landing: ready(900), pressureAltitude, temperature }, now)
    for (const [mass, pa, temperature, boundary] of [
      [1100, 1000, '10', { m: 1000, pa: 1000, t: 10 }],
      [900, 2200, '10', { m: 900, pa: 2000, t: 10 }],
      [900, 1000, '22', { m: 900, pa: 1000, t: 20 }],
      [1100, 2200, '22', { m: 1000, pa: 2000, t: 20 }],
    ] as const) {
      const result = at(mass, pa, temperature)
      if (result.status !== 'assessed' || result.takeoff.status !== 'success') throw new Error('Expected takeoff')
      const base = (phase: number) => 100 + phase * 100 + (boundary.m - 800) + boundary.pa / 100 + boundary.t
      expect(result.takeoff.extrapolated).toBe(true)
      expect(result.takeoff.distances.map((row) => row.distance)).toEqual([base(0) * 1.2, base(1) * 1.2])
      expect(result.takeoff.distances.every((row) => row.extrapolation !== null && row.distance > base(0))).toBe(true)
      // The other group stays an ordinary lookup, except where its own axes are also extrapolated.
    }
    const plain = at(900, 1000, '10')
    if (plain.status !== 'assessed' || plain.takeoff.status !== 'success') throw new Error('Expected takeoff')
    expect(plain.takeoff.extrapolated).toBe(false)
  })

  it('accepts exactly 10 % above the maximum and blocks the first value past it', () => {
    expect(assess(ready(1100), ready(900))).toMatchObject({ takeoff: { status: 'success', extrapolated: true } })
    expect(assess(ready(1100.0001), ready(900))).toMatchObject({ takeoff: { status: 'blocked', reason: 'envelope' } })
  })

  it('blocks extrapolation when the table decreases along any axis', () => {
    for (const axis of ['mass', 'pressureAltitude', 'temperature'] as const) {
      const profile = testPohAircraft()
      // Make the highest point on this axis shorter than its neighbour.
      const table = profile.performanceProfiles![0]!
      const top = Math.max(...table.dataPoints.map((point) => point[axis]))
      table.dataPoints.forEach((point) => { if (point[axis] === top) point.distance -= axis === 'mass' ? 250 : 25 })
      const result = assess(ready(1050), ready(900), profile)
      expect({ axis, ...result }).toMatchObject({ takeoff: { status: 'blocked', reason: 'tables' } })
    }
  })

  it('keeps below-minimum mass benefit-capped while extrapolating another axis conservatively', () => {
    const result = assessPerformance(testPohAircraft(), { takeoff: ready(700), landing: ready(900), pressureAltitude: 2100, temperature: '10' }, now)
    if (result.status !== 'assessed' || result.takeoff.status !== 'success') throw new Error('Expected takeoff')
    expect(result.takeoff.distances[0]).toMatchObject({ massTreatment: 'benefit-capped', lookupMass: 800 })
    expect(result.takeoff.distances[0]!.distance).toBe((100 + 0 + 20 + 10) * 1.2)
  })

  it('presents a benefit-capped distance as the documented best case without notice or acknowledgment (REQ-PF-011, §8.4)', () => {
    const assessment = assessPerformance(testPohAircraft(), { takeoff: ready(700), landing: ready(900), pressureAltitude: 1000, temperature: '10' }, now)
    const presentation = presentPerformance({ inputKey: 'k', inputs: [], aircraft: null, takeoff: ready(700), landing: ready(900), assessment, pressureAltitudeBasis: '', pendingReason: 'x',
      runway: { status: 'unavailable', reason: 'x' }, operational: presentOperationalAssessment(null, 'x') })
    const takeoff = presentation.groups[0]!
    expect(takeoff).toMatchObject({ status: 'success', rows: [{ value: '120.0 m', note: null }, expect.anything()] })
    expect(presentation.extrapolation).toBeNull()
    expect(JSON.stringify(presentation.groups)).not.toMatch(/capped|extrapolat/i)
  })

  it('marks an estimated distance derived from an extrapolated sibling as both', () => {
    const profile = testPohAircraft()
    profile.performanceProfiles = profile.performanceProfiles!.filter((table) => table.flightPhase !== 'TakeoffDistance50ft')
    const result = assess(ready(1050), ready(900), profile)
    if (result.status !== 'assessed' || result.takeoff.status !== 'success') throw new Error('Expected takeoff')
    expect(result.takeoff.distances[1]).toMatchObject({ provenance: 'estimated' })
    expect(result.takeoff.distances[1]!.extrapolation).not.toBeNull()
    expect(result.takeoff.distances[1]!.distance).toBeCloseTo((expected(0, 1000)) * 1.2 * 1.9, 9)
  })

  it('evaluates each phase against its own envelope when tables differ', () => {
    const profile = testPohAircraft()
    // Landing tables tabulate 700–900 kg; takeoff tables keep 800–1000 kg.
    for (const index of [2, 3]) profile.performanceProfiles![index]!.dataPoints.forEach((point) => { point.mass -= 100 })
    const tables = inspectTables(profile)
    expect(tables).toMatchObject({ status: 'ready', bounds: { TakeoffRoll: { mass: { min: 800, max: 1000 } }, LandingRoll: { mass: { min: 700, max: 900 } } } })
    expect(assess(ready(950), ready(1000), profile)).toMatchObject({ takeoff: { status: 'success' }, landing: { status: 'blocked', reason: 'envelope' } })
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
    expect(assess(ready(1101), ready(900), profile)).toMatchObject({ takeoff: { status: 'blocked', reason: 'envelope' }, landing: { status: 'success' } })
  })

  it('blocks both groups for nonfinite conditions without a distance', () => {
    expect(assessPerformance(testPohAircraft(), { takeoff: ready(900), landing: ready(900), pressureAltitude: Number.NaN, temperature: '10' }, now))
      .toMatchObject({ status: 'blocked', reason: 'input' })
    expect(assessPerformance(testPohAircraft(), { takeoff: ready(900), landing: ready(900), pressureAltitude: 1000, temperature: '' }, now))
      .toMatchObject({ status: 'blocked', reason: 'input' })
  })
})

describe('missing distance estimates', () => {
  const inputs = {
    takeoff: { status: 'ready' as const, massKg: 900, origin: 'test' },
    landing: { status: 'ready' as const, massKg: 900, origin: 'test' },
    pressureAltitude: '1000', temperature: '10',
  }
  it.each([
    ['TakeoffDistance50ft', 'takeoff', 1, 220 * 1.9],
    ['TakeoffRoll', 'takeoff', 0, 320 / 1.9],
    ['LandingDistance50ft', 'landing', 1, 420 * 1.67],
    ['LandingRoll', 'landing', 0, 520 / 1.67],
  ] as const)('derives missing %s and preserves provenance', (phase, group, index, expected) => {
    const profile = testPohAircraft()
    profile.performanceProfiles = profile.performanceProfiles!.filter(table => table.flightPhase !== phase)
    const result = assessPerformance(profile, inputs, now)
    expect(result.status).toBe('assessed')
    if (result.status !== 'assessed' || result[group].status !== 'success') throw new Error('Expected result')
    expect(result[group].distances[index]).toMatchObject({ provenance: 'estimated' })
    expect(result[group].distances[index]!.distance).toBeCloseTo(expected)
    expect(result[group].distances[1 - index]!.provenance).toBe('poh')
  })
  it('prefers all published values', () => {
    const result = assessPerformance(testPohAircraft(), inputs, now)
    if (result.status !== 'assessed' || result.takeoff.status !== 'success' || result.landing.status !== 'success') throw new Error('Expected result')
    expect(result.takeoff.distances.map(row => [row.distance, row.provenance])).toEqual([[220, 'poh'], [320, 'poh']])
    expect(result.landing.distances.map(row => [row.distance, row.provenance])).toEqual([[420, 'poh'], [520, 'poh']])
  })
})
