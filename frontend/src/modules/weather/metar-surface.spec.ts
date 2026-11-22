import { describe, expect, it } from 'vitest'
import { metarHeavyRain, metarLiquid } from './metar-surface'

describe('METAR surface observation', () => {
  it.each([
    ['17004KT 9999 -RA BR BKN020 10/08 Q1013', true],
    ['AUTO 17004KT 9999 +TSRASN SCT020CB BKN040 10/08 Q1013 RMK RA', true],
    ['17004KT 10SM FZRA OVC020 10/08 A2992 RMK AO2', true],
    ['17004KT 9999 VCSH BKN020 10/08 Q1013', false],
    ['17004KT 9999 VCRA BKN020 10/08 Q1013', null],
    ['17004KT CAVOK 10/08 Q1013', false],
    ['17004KT 1 1/2SM TS BKN020 10/08 A2992 RMK RA', false],
    ['17004KT 9999 BKN020 10/08 Q1013 RERA', false],
    ['17004KT 9999 -RA NSC 10/08 Q1013 NOSIG', true],
    ['17004KT 9999 -RA BKN020 10/08 Q1013 TEMPO TL1200 4000 BR', true],
    ['17004KT 9999 BKN020 10/08 Q1013 BECMG FM1200 -RA BKN010', false],
    ['17004KT 9999 -RA BKN020 10/08 Q1013 R18/090070 NOSIG', true],
    ['17004KT 9999 -RA BKN020 10/08 Q1013 WS ALL RWY NOSIG', true],
    ['17004KT 9999 -RA BKN020 10/08 Q1013 TEMPO GARBAGE', null],
    ['17004KT 9999 -RA BKN020 10/08 Q1013 TEMPO FM9999 RA', null],
    ['17004KT 9999 -RA BKN020 10/08 Q1013 TEMPO', null],
    ['17004KT 9999 BKN020 10/08 Q1013 RMK RA', false],
    ['17004KT 9999 RERA BKN020 10/08 Q1013', null],
    ['17004KT 9999 FZSNRA BKN020 10/08 Q1013', null],
    ['17004KT CAVOK RA 10/08 Q1013', null],
    ['99904KT 9999 RA BKN020 10/08 Q1013', null],
    ['17004KT 9999 RA BKN020 10/08 Q0000', null],
    ['17004KT 9999 RA GARBAGE BKN020 10/08 Q1013', null],
  ])('parses %s', (body, expected) => expect(metarLiquid(body)).toBe(expected))
})


it.each([
  ['17004KT 9999 +RA BKN020 10/08 Q1013', true],
  ['17004KT 9999 +SHRA BKN020 10/08 Q1013', true],
  ['17004KT 9999 RA BKN020 10/08 Q1013', false],
  ['17004KT 9999 +SN BKN020 10/08 Q1013', false],
  ['17004KT 9999 BKN020 10/08 Q1013 TEMPO +RA', false],
  ['17004KT 9999 +RA GARBAGE', null],
])('detects heavy rain: %s', (body, expected) => expect(metarHeavyRain(body)).toBe(expected))
