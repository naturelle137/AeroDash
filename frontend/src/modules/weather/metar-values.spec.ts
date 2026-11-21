import { describe, expect, it } from 'vitest'
import { metarValues } from './metar-values'

describe('METAR values', () => {
  it('extracts only supported, unambiguous fields', () => {
    expect(metarValues('EDDF 211620Z 17004G12KT CAVOK M05/M10 Q1013')).toEqual({ wind: { direction: '170', speed: '4', unit: 'kt' }, temperature: '-5', qnh: '1013' })
    expect(metarValues('EDDF 211620Z 00000MPS 02/01 Q0999')).toEqual({ wind: { direction: '', speed: '0', unit: 'm/s' }, temperature: '2', qnh: '999' })
    expect(metarValues('KJFK 211620Z A2992')).toEqual({ qnh: '1013.21' })
    expect(metarValues('EDDF 211620Z VRB04KT //// Q////')).toEqual({})
    expect(metarValues('EDDF 211620Z 99999KT 02/01 03/02 Q1013 Q1014')).toEqual({})
  })
})
