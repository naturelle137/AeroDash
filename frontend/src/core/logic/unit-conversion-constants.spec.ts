// @UT-SYS-CORE-041@ (FROM: @IMP-SYS-CORE-014@)

import { describe, expect, it } from 'vitest'
import {
  FT_TO_M,
  IMP_GAL_TO_L,
  IN_TO_M,
  LB_TO_KG,
  US_GAL_TO_L,
} from './unit-conversion-constants'

describe('unit-conversion-constants — TECH-014 single-source-of-truth', () => {
  it('US_GAL_TO_L matches the NIST-exact factor 3.785411784', () => {
    expect(US_GAL_TO_L).toBe(3.785411784)
  })

  it('IMP_GAL_TO_L matches the 1985 Weights & Measures Act factor 4.54609', () => {
    expect(IMP_GAL_TO_L).toBe(4.54609)
  })

  it('LB_TO_KG matches the international avoirdupois pound 0.45359237', () => {
    expect(LB_TO_KG).toBe(0.45359237)
  })

  it('IN_TO_M and FT_TO_M match the exact international inch / foot', () => {
    expect(IN_TO_M).toBe(0.0254)
    expect(FT_TO_M).toBe(0.3048)
  })

  it('FT_TO_M is exactly 12 × IN_TO_M (no silent drift)', () => {
    expect(FT_TO_M).toBeCloseTo(IN_TO_M * 12, 12)
  })
})
