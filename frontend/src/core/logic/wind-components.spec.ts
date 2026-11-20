import { describe, expect, it } from 'vitest'
import { computeWindComponents } from './wind-components'

const calc = (runwayHeading: string, windDirection: string, windSpeed: string, unit = 'kt') =>
  computeWindComponents({ runwayHeading, windDirection, windSpeed, unit })

// Independent hand-derived vectors (speed 20 unless stated); crosswind > 0 = from the right.
describe('computeWindComponents', () => {
  it.each([
    ['direct headwind', '90', '90', '20', 20, 0],
    ['direct tailwind', '90', '270', '20', -20, 0],
    ['crosswind from right', '90', '180', '20', 0, 20],
    ['crosswind from left', '90', '360', '20', 0, -20],
    ['60 degrees off, from right', '270', '330', '20', 10, 17.3],
    ['120 degrees off, from left', '270', '150', '20', -10, -17.3],
    ['wraparound heading 360, wind 10', '360', '10', '10', 9.8, 1.7],
    ['wraparound heading 10, wind 350', '10', '350', '10', 9.4, -3.4],
    ['heading 360 equals north wind', '360', '360', '15', 15, 0],
    ['calm with direction', '90', '180', '0', 0, 0],
  ])('%s', (_name, hdg, dir, speed, head, cross) => {
    const result = calc(hdg, dir, speed)
    expect(result).toEqual({ status: 'valid', unit: 'kt', headwind: head, crosswind: cross })
  })

  it('accepts calm without a direction and keeps the unit', () => {
    expect(calc('90', '', '0', 'km/h')).toEqual({ status: 'valid', unit: 'km/h', headwind: 0, crosswind: 0 })
  })
  it('accepts a decimal comma', () => {
    expect(calc('90', '90', '12,5', 'm/s')).toMatchObject({ status: 'valid', headwind: 12.5 })
  })
  it('never returns negative zero', () => {
    const result = calc('90', '180', '20')
    expect(Object.is((result as { headwind: number }).headwind, 0)).toBe(true)
  })
  it('is incomplete when nothing is entered', () => {
    expect(calc('', '', '')).toEqual({ status: 'incomplete' })
  })
  it.each([
    ['missing heading', '', '90', '10', 'runwayHeading'],
    ['missing direction', '90', '', '10', 'windDirection'],
    ['missing speed', '90', '90', '', 'windSpeed'],
    ['variable direction', '90', 'VRB', '10', 'windDirection'],
    ['direction 0', '90', '0', '10', 'windDirection'],
    ['direction 361', '90', '361', '10', 'windDirection'],
    ['heading 0', '0', '90', '10', 'runwayHeading'],
    ['runway identifier text', 'RWY 09', '90', '10', 'runwayHeading'],
    ['negative speed', '90', '90', '-5', 'windSpeed'],
    ['non-numeric speed', '90', '90', '1e1', 'windSpeed'],
    ['speed above limit', '90', '90', '201', 'windSpeed'],
    ['unit missing', '90', '90', '10', 'unit'],
  ])('rejects %s', (_name, hdg, dir, speed, field) => {
    const result = calc(hdg, dir, speed, field === 'unit' ? '' : 'kt')
    expect(result.status).toBe('invalid')
    expect(Object.keys((result as { errors: object }).errors)).toContain(field)
  })
  it('rejects variable direction even when calm', () => {
    expect(calc('90', 'VRB', '0').status).toBe('invalid')
  })
})
