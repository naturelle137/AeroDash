import { describe, expect, it } from 'vitest'
import { calculateFuelEndurance } from './fuel-endurance'

// Synthetic arithmetic only; these are not aircraft or POH values.
const input = { usableFuelKg: 40, consumptionKgPerHour: 10, tripMinutes: 120, reserveMinutes: 30 }
describe('fuel endurance arithmetic', () => {
  it('separates usable fuel, trip, reserve and signed margin', () => {
    expect(calculateFuelEndurance(input)).toEqual({ ok: true, plan: {
      enduranceMinutes: 240, tripFuelKg: 20, reserveFuelKg: 5, requiredFuelKg: 25,
      marginKg: 15, warning: null, reserveShortfall: false,
    } })
  })
  it.each([
    [240, 0, 0, null, false], [240, 1, -1 / 6, 'WARN-FE-001', false],
    [0, 241, -1 / 6, 'WARN-FE-001', true], [0, 0, 40, null, false],
  ])('handles trip %s and reserve %s', (tripMinutes, reserveMinutes, margin, warning, reserveShortfall) => {
    const result = calculateFuelEndurance({ ...input, tripMinutes, reserveMinutes })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected arithmetic result')
    expect(result.plan.marginKg).toBeCloseTo(margin)
    expect(result.plan.warning).toBe(warning)
    expect(result.plan.reserveShortfall).toBe(reserveShortfall)
  })
  it('allows explicitly zero usable fuel and zero durations', () => {
    const result = calculateFuelEndurance({ ...input, usableFuelKg: 0, tripMinutes: 0, reserveMinutes: 0 })
    expect(result).toMatchObject({ ok: true, plan: { enduranceMinutes: 0, marginKg: 0 } })
  })
  for (const field of Object.keys(input)) {
    it.each([undefined, '', NaN, Infinity, -Infinity, -1])(`rejects invalid ${field}: %s`, value => {
      expect(calculateFuelEndurance({ ...input, [field]: value })).toEqual({ ok: false, reason: 'INVALID_INPUT' })
    })
  }
  it('rejects zero consumption', () => {
    expect(calculateFuelEndurance({ ...input, consumptionKgPerHour: 0 })).toEqual({ ok: false, reason: 'INVALID_INPUT' })
  })
  it.each([
    { consumptionKgPerHour: Number.MIN_VALUE },
    { tripMinutes: Number.MAX_VALUE, consumptionKgPerHour: Number.MAX_VALUE },
    { reserveMinutes: Number.MAX_VALUE, consumptionKgPerHour: Number.MAX_VALUE },
  ])('rejects numeric overflow %s', patch => {
    expect(calculateFuelEndurance({ ...input, ...patch })).toEqual({ ok: false, reason: 'NUMERIC_OVERFLOW' })
  })
})
