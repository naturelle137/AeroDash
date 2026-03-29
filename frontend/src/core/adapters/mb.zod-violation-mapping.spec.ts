import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import type { ZodIssue } from 'zod'
import { mapZodErrorToViolations } from './mb.zod-violation-mapping'

// ── Scenarios ─────────────────────────────────────────────────────────────────

const errFieldScenarios = [
  // @UT-SYS-CORE-002@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'BEM',
    path: ['BASICEMPTYMASS'],
    expectedField: 'BEM',
  },
  // @UT-SYS-CORE-003@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'MTOM',
    path: ['MAXTAKEOFFMASS'],
    expectedField: 'MTOM',
  },
  // @UT-SYS-CORE-004@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'MZFM',
    path: ['MAXZEROFUELMASS'],
    expectedField: 'MZFM',
  },
  // @UT-SYS-CORE-005@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'EMPTY_CG',
    path: ['EMPTYCENTEROFGRAVITY'],
    expectedField: 'EMPTY_CG',
  },
  // @UT-SYS-CORE-006@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'FUEL_STATIONS',
    path: ['FUELSTATIONS'],
    expectedField: 'FUEL_STATIONS',
  },
]

const errCodeScenarios = [
  // @UT-SYS-CORE-007@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'required',
    message: 'REQUIRED',
    expectedCode: 'REQUIRED',
  },

  // @UT-SYS-CORE-008@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'not a number',
    message: 'NOT_A_NUMBER',
    expectedCode: 'NOT_A_NUMBER',
  },
  // @UT-SYS-CORE-009@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'negative value',
    message: 'NEGATIVE_VALUE',
    expectedCode: 'NEGATIVE_VALUE',
  },
  // @UT-SYS-CORE-010@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'not allowed',
    message: 'NOT_ALLOWED',
    expectedCode: 'NOT_ALLOWED',
  },
  // @UT-SYS-CORE-011@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'out of range',
    message: 'OUT_OF_RANGE',
    expectedCode: 'OUT_OF_RANGE',
  },
  // @UT-SYS-CORE-012@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'too many items',
    message: 'TOO_MANY_ITEMS',
    expectedCode: 'TOO_MANY_ITEMS',
  },
  // @UT-SYS-CORE-013@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'duplicate index',
    message: 'DUPLICATE_INDEX',
    expectedCode: 'DUPLICATE_INDEX',
  },
]

const invalidTypeScenarios = [
  // @UT-SYS-CORE-014@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'received undefined',
    message: 'received undefined',
    expectedCode: 'REQUIRED',
  },
  // @UT-SYS-CORE-015@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'received null',
    message: 'received null',
    expectedCode: 'REQUIRED',
  },
  // @UT-SYS-CORE-016@ (FROM: @IMP-SYS-CORE-002@)
  {
    name: 'custom message',
    message: 'custom',
    expectedCode: 'NOT_A_NUMBER',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('mapZodErrorToViolations', () => {
  // @UT-SYS-CORE-001@ (FROM: @IMP-SYS-CORE-002@)
  it('uses empty path when issue.path is missing (defensive)', () => {
    const issues: ZodIssue[] = [
      {
        code: 'custom',
        message: 'REQUIRED',
        path: undefined as unknown as ZodIssue['path'],
      },
    ]
    const error = new z.ZodError(issues)
    const violations = mapZodErrorToViolations(error)

    expect(violations).toEqual([
      expect.objectContaining({
        type: 'INVALID_INPUT',
        field: '',
      }),
    ])
  })

  it.each(errFieldScenarios)('maps error field $path to $expectedField', (scenario) => {
    const issues: ZodIssue[] = [
      {
        code: 'custom',
        message: 'REQUIRED',
        path: scenario.path,
      },
    ]
    const error = new z.ZodError(issues)
    const violations = mapZodErrorToViolations(error)

    expect(violations).toEqual([
      expect.objectContaining({
        field: scenario.expectedField,
      }),
    ])
  })

  it.each(errCodeScenarios)('maps error $message to $expectedCode', (scenario) => {
    const issues: ZodIssue[] = [
      {
        code: 'custom',
        message: scenario.message,
        path: ['BASICEMPTYMASS'],
      },
    ]
    const error = new z.ZodError(issues)
    const violations = mapZodErrorToViolations(error)

    expect(violations).toEqual([
      expect.objectContaining({
        code: scenario.expectedCode,
      }),
    ])
  })

  it.each(invalidTypeScenarios)(
    'maps error invalid_type - $message to $expectedCode',
    (scenario) => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'number',
          message: scenario.message,
          path: ['BASICEMPTYMASS'],
        },
      ]
      const error = new z.ZodError(issues)
      const violations = mapZodErrorToViolations(error)

      expect(violations).toEqual([
        expect.objectContaining({
          code: scenario.expectedCode,
        }),
      ])
    },
  )

  // @UT-SYS-CORE-017@ (FROM: @IMP-SYS-CORE-002@)
  it('outputs the field correctly when path is an array', () => {
    const issues: ZodIssue[] = [
      {
        code: 'custom',
        message: 'REQUIRED',
        path: ['STATIONS', 0, 'index'],
      },
    ]
    const error = new z.ZodError(issues)
    const violations = mapZodErrorToViolations(error)

    expect(violations).toEqual([
      expect.objectContaining({
        field: 'STATIONS[0].INDEX',
      }),
    ])
  })

  // @UT-SYS-CORE-018@ (FROM: @IMP-SYS-CORE-002@)
  it('outputs the field correctly when path is an array with nested objects', () => {
    const issues: ZodIssue[] = [
      {
        code: 'custom',
        message: 'REQUIRED',
        path: ['STATIONS', 0, 'armLookup', 0, 'massOrVolume'],
      },
    ]
    const error = new z.ZodError(issues)
    const violations = mapZodErrorToViolations(error)

    expect(violations).toEqual([
      expect.objectContaining({
        field: 'STATIONS[0].ARMLOOKUP[0].MASSORVOLUME',
      }),
    ])
  })

  // @UT-SYS-CORE-019@ (FROM: @IMP-SYS-CORE-002@)
  it('outputs REQUIRED when code and message are unknown', () => {
    const issues: ZodIssue[] = [
      {
        code: 'unknown',
        message: 'unknown',
        path: ['STATIONS', 0, 'index'],
      },
    ] as unknown as ZodIssue[]

    const error = new z.ZodError(issues)
    const violations = mapZodErrorToViolations(error)

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'REQUIRED',
      }),
    ])
  })
})
