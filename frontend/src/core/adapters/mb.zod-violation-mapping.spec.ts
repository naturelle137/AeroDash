import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import type { ZodIssue } from 'zod'
import { mapZodErrorToViolations } from './mb.zod-violation-mapping'

// ── Scenarios ─────────────────────────────────────────────────────────────────

const errFieldScenarios = [
  {
    name: 'BEM',
    path: ['BASICEMPTYMASS'],
    expectedField: 'BEM',
  },
  {
    name: 'MTOM',
    path: ['MAXTAKEOFFMASS'],
    expectedField: 'MTOM',
  },
  {
    name: 'MZFM',
    path: ['MAXZEROFUELMASS'],
    expectedField: 'MZFM',
  },
  {
    name: 'EMPTY_CG',
    path: ['EMPTYCENTEROFGRAVITY'],
    expectedField: 'EMPTY_CG',
  },
  {
    name: 'FUEL_STATIONS',
    path: ['FUELSTATIONS'],
    expectedField: 'FUEL_STATIONS',
  },
]

const errCodeScenarios = [
  {
    name: 'required',
    message: 'REQUIRED',
    expectedCode: 'REQUIRED',
  },

  {
    name: 'not a number',
    message: 'NOT_A_NUMBER',
    expectedCode: 'NOT_A_NUMBER',
  },
  {
    name: 'negative value',
    message: 'NEGATIVE_VALUE',
    expectedCode: 'NEGATIVE_VALUE',
  },
  {
    name: 'not allowed',
    message: 'NOT_ALLOWED',
    expectedCode: 'NOT_ALLOWED',
  },
  {
    name: 'out of range',
    message: 'OUT_OF_RANGE',
    expectedCode: 'OUT_OF_RANGE',
  },
  {
    name: 'too many items',
    message: 'TOO_MANY_ITEMS',
    expectedCode: 'TOO_MANY_ITEMS',
  },
  {
    name: 'duplicate index',
    message: 'DUPLICATE_INDEX',
    expectedCode: 'DUPLICATE_INDEX',
  },
]

const invalidTypeScenarios = [
  {
    name: 'received undefined',
    message: 'received undefined',
    expectedCode: 'REQUIRED',
  },
  {
    name: 'received null',
    message: 'received null',
    expectedCode: 'REQUIRED',
  },
  {
    name: 'custom message',
    message: 'custom',
    expectedCode: 'NOT_A_NUMBER',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('mapZodErrorToViolations', () => {
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

  // The structured `path` accompanies the legacy stringified `field` so
  // consumers can dispatch on path segments without regex-parsing.
  it('emits a structured `path` array alongside the stringified `field`', () => {
    const issues: ZodIssue[] = [
      {
        code: 'custom',
        message: 'REQUIRED',
        path: ['stations', 2, 'mass'],
      },
    ]
    const error = new z.ZodError(issues)
    const violations = mapZodErrorToViolations(error)

    expect(violations).toHaveLength(1)
    expect(violations[0]!.field).toBe('STATIONS[2].MASS')
    expect(violations[0]!.path).toEqual(['stations', 2, 'mass'])
  })

  it('preserves an empty `path` array when the Zod issue path is empty', () => {
    const issues: ZodIssue[] = [
      {
        code: 'custom',
        message: 'REQUIRED',
        path: [],
      },
    ]
    const error = new z.ZodError(issues)
    const violations = mapZodErrorToViolations(error)

    expect(violations[0]!.path).toEqual([])
  })

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
