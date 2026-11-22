import { describe, expect, it } from 'vitest'
import { tafLiquid } from './taf-surface'

const start = Date.parse('2026-11-30T12:00:00Z')
const end = Date.parse('2026-12-01T18:00:00Z')
const base = '21005KT 9999 BKN020'
const rain = '21005KT 9999 -RA BKN020'
const at = (time: string) => Date.parse(time)

describe('synthetic current-time TAF precipitation', () => {
  it.each([
    [rain, start - 1, null], [rain, start, true], [rain, end - 1, true], [rain, end, null],
    [base, start, false], ['21005KT CAVOK', start, false],
    ['21005KT 9999 FZDZ BKN020', start, true],
    ['21005KT 9999 SHRASN BKN020', start, true],
    ['21005KT 9999 SN BKN020', start, false],
    [`${base} TEMPO 3014/3016 4000 RA BKN010`, at('2026-11-30T13:59:59Z'), false],
    [`${base} TEMPO 3014/3016 4000 RA BKN010`, at('2026-11-30T14:00:00Z'), true],
    [`${base} TEMPO 3014/3016 4000 RA BKN010`, at('2026-11-30T16:00:00Z'), false],
    [`${base} PROB30 TEMPO 3014/3016 RA`, at('2026-11-30T14:00:00Z'), true],
    [`${base} FM010000 ${rain}`, at('2026-11-30T23:59:59Z'), false],
    [`${base} FM010000 ${rain}`, at('2026-12-01T00:00:00Z'), true],
    [`${rain} FM010000 ${base}`, at('2026-12-01T00:00:00Z'), false],
    [`${base} TEMPO 3014/3018 RA FM301600 ${base}`, at('2026-11-30T16:00:00Z'), false],
    [`${base} BECMG 3014/3016 RA`, at('2026-11-30T14:00:00Z'), null],
    [`${base} BECMG 3014/3016 RA`, at('2026-11-30T16:00:00Z'), true],
    [`${rain} BECMG 3014/3016 NSW`, at('2026-11-30T16:00:00Z'), false],
    [`${rain} BECMG 3014/3016 25010KT`, at('2026-11-30T16:00:00Z'), true],
    [`${base} TEMPO 3023/3024 RA`, at('2026-12-01T00:00:00Z'), false],
  ] as const)('interprets %s at %s', (body, now, expected) => {
    expect(tafLiquid(body, start, end, now)).toBe(expected)
  })

  it.each([
    `${rain} UNKNOWN RA`, `${rain} INTER 3014/3016 RA`, `${rain} TEMPO 3014/3016 RA GARBAGE`,
    `${rain} TEMPO 3016/3014 RA`, `${rain} TEMPO 3014/3014 RA`, `${rain} TEMPO 3025/3101 RA`,
    `${rain} FM312400 ${base}`, `${rain} FM010060 ${base}`, `${rain} FM291200 ${base}`,
    `${rain} PROB50 3014/3016 RA`, `${rain} TEMPO`, `${rain} RMK RA`,
    '99904KT 9999 RA BKN020', '21005KT CAVOK RA', '21005KT 9999 RA',
    '21005KT 9999 FZSNRA BKN020', '21005KT 9999 VCRA BKN020',
    `${rain} FM301600 ${base} TEMPO 3014/3018 RA`, `${rain} FM010000 RA`, `${rain} TEMPO 3014/3016 NSW RA`,
  ])('does not infer weather from unsupported/malformed groups: %s', body => {
    expect(tafLiquid(body, start, end, start)).toBeNull()
  })
})


it.each([
  [`${base} TEMPO 3014/3016 RA`, false],
  [`${base} TEMPO 3014/3017 RA`, false],
  [`${base} TEMPO 3014/3017 SN`, false],
  [`${base} TEMPO 3014/3016 +RA`, false],
  [`${base} TEMPO 3014/3017 RA GARBAGE`, null],
  [`${rain} FM301400 ${base}`, false],
  [rain, true],
  ['21005KT 9999 SN BKN020', true],
  [`${rain} FM301400 ${base}`, false],
])('detects applicable long or heavy precipitation: %s', (body, expected) => {
  expect(tafLiquid(body, start, end, at('2026-11-30T14:30:00Z'), 'soft')).toBe(expected)
})
