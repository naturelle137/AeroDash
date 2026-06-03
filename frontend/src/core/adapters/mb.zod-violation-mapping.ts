import { z } from 'zod'
import type { Violation } from '../domain/mass-balance.math-types'

// @IMP-SYS-CORE-002@ (FROM: @REQ-SYS-008@, @DES-ARCH-001@)
export const mapZodErrorToViolations = (error: z.ZodError): Violation[] => {
  return error.issues.map((err) => {
    const pArray = err.path || []
    let fieldPath = pArray
      .map((p) => {
        if (typeof p === 'number') return `[${p}]`
        return p.toString().toUpperCase()
      })
      .join('.')
      .replace(/\.\[/g, '[')

    fieldPath = fieldPath
      .replace(/^BASICEMPTYMASS/, 'BEM')
      .replace(/^MAXTAKEOFFMASS/, 'MTOM')
      .replace(/^MAXZEROFUELMASS/, 'MZFM')
      .replace(/^EMPTYCENTEROFGRAVITY/, 'EMPTY_CG')
      .replace(/^FUELSTATIONS/, 'FUEL_STATIONS')

    let code: Violation['code'] = 'REQUIRED'
    if (
      [
        'REQUIRED',
        'NOT_A_NUMBER',
        'NEGATIVE_VALUE',
        'NOT_ALLOWED',
        'OUT_OF_RANGE',
        'TOO_MANY_ITEMS',
        'DUPLICATE_INDEX',
      ].includes(err.message)
    ) {
      code = err.message as Violation['code']
    } else if (err.code === 'invalid_type') {
      const isMissing =
        err.message.includes('received undefined') || err.message.includes('received null')
      code = isMissing ? 'REQUIRED' : 'NOT_A_NUMBER'
    }

    return {
      type: 'INVALID_INPUT',
      field: fieldPath,
      // Surface the structured Zod path so consumers can dispatch on path
      // segments without regex-parsing `field`. Kept alongside the legacy
      // stringified `field` for backwards compatibility.
      //
      // Zod issue paths are `PropertyKey[]` (string | number | symbol); the
      // Violation contract narrows symbols out because they are never used
      // by mass-balance schemas and would lose information when stringified.
      path: pArray.filter((p): p is string | number => typeof p !== 'symbol'),
      code,
    }
  })
}
