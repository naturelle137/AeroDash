import { describe, expect, it } from 'vitest'
import { syntheticFuelContext, stations } from './synthetic-fuel.fixture'
import { usableFuelForPlanning } from './usable-fuel'

describe('existing tank inventory for fuel planning', () => {
  it('subtracts unusable quantity before canonical conversion', () => {
    const aircraft = syntheticFuelContext()
    expect(
      usableFuelForPlanning(aircraft, aircraft.certificationCategories[0]!.category, stations),
    ).toEqual({
      ok: true,
      usableFuelKg: 40,
      excludedUnusableKg: 10,
      tanks: [{ index: 0, usableFuelKg: 40 }],
    })
    aircraft.loadPoints[0]!.unit = 'L'
    const converted = usableFuelForPlanning(
      aircraft,
      aircraft.certificationCategories[0]!.category,
      stations,
    )
    expect(converted.ok).toBe(true)
    if (!converted.ok) throw new Error('Expected converted fuel')
    expect(converted.usableFuelKg).toBeCloseTo(28.8)
    expect(converted.excludedUnusableKg).toBeCloseTo(7.2)
    aircraft.loadPoints[0]!.unit = 'lb'
    expect(
      usableFuelForPlanning(aircraft, aircraft.certificationCategories[0]!.category, stations),
    ).toMatchObject({ ok: true, usableFuelKg: 40 * 0.45359237 })
  })
  it.each([NaN, Infinity, -1, 9, 101, undefined])('blocks invalid tank load %s', (weight) => {
    const aircraft = syntheticFuelContext()
    expect(
      usableFuelForPlanning(aircraft, aircraft.certificationCategories[0]!.category, [
        { ...stations[0]!, weight: weight as number },
      ]).ok,
    ).toBe(false)
  })
  it('blocks missing tank, invalid aircraft/category, electric and unknown types/units', () => {
    const aircraft = syntheticFuelContext()
    const category = aircraft.certificationCategories[0]!.category
    expect(usableFuelForPlanning(null, category, stations).ok).toBe(false)
    expect(usableFuelForPlanning(aircraft, null, stations).ok).toBe(false)
    expect(usableFuelForPlanning(aircraft, category, []).ok).toBe(false)
    expect(
      usableFuelForPlanning({ ...aircraft, powertrain: 'electric' }, category, stations).ok,
    ).toBe(false)
    aircraft.loadPoints[0]!.unit = 'unknown'
    expect(usableFuelForPlanning(aircraft, category, stations).ok).toBe(false)
    aircraft.loadPoints[0]!.unit = 'L'
    aircraft.loadPoints[0]!.fuelTank!.permissibleFuelTypes = ['unknown']
    expect(usableFuelForPlanning(aircraft, category, stations).ok).toBe(false)
    aircraft.loadPoints[0]!.fuelTank!.permissibleFuelTypes = []
    expect(usableFuelForPlanning(aircraft, category, stations).ok).toBe(false)
  })
  it('sums mixed mass and volume tanks without counting non-fuel loads', () => {
    const aircraft = syntheticFuelContext()
    const category = aircraft.certificationCategories[0]!.category
    aircraft.loadPoints.push({ ...structuredClone(aircraft.loadPoints[0]!), unit: 'L' })
    aircraft.loadPoints.push({ ...structuredClone(aircraft.loadPoints[0]!), fuelTank: null })
    const result = usableFuelForPlanning(aircraft, category, [
      ...stations,
      { ...stations[0]!, index: 1, weight: 60 },
      { ...stations[0]!, index: 2, weight: 90 },
    ])
    expect(result).toMatchObject({ ok: true, usableFuelKg: 76 })
  })
  it('accepts a tank with only unusable fuel as zero usable', () => {
    const aircraft = syntheticFuelContext()
    expect(
      usableFuelForPlanning(aircraft, aircraft.certificationCategories[0]!.category, [
        { ...stations[0]!, weight: 10 },
      ]),
    ).toMatchObject({ ok: true, usableFuelKg: 0 })
  })
  it('blocks mixed valid and invalid tanks but excludes unavailable tanks', () => {
    const aircraft = syntheticFuelContext()
    const category = aircraft.certificationCategories[0]!.category
    aircraft.loadPoints.push({ ...structuredClone(aircraft.loadPoints[0]!), name: 'Other tank' })
    expect(usableFuelForPlanning(aircraft, category, stations).ok).toBe(false)
    aircraft.loadPoints[1]!.allowableCategories = []
    expect(usableFuelForPlanning(aircraft, category, stations)).toMatchObject({
      ok: true,
      usableFuelKg: 40,
    })
    aircraft.loadPoints[0]!.allowableCategories = []
    expect(usableFuelForPlanning(aircraft, category, stations).ok).toBe(false)
  })
})
