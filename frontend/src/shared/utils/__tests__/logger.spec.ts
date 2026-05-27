import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createLogger,
  safeSerialize,
  redactPayload,
  PII_REDACTED_MARKER,
  DEFAULT_SAFE_FIELDS,
} from '../logger'
import type { TelemetryPayload } from '../logger'

describe('safeSerialize', () => {
  // @UT-SYS-SHARED-001@ (FROM: @IMP-SYS-SHARED-001@)
  it('returns primitives unchanged', () => {
    expect(safeSerialize(null)).toBeNull()
    expect(safeSerialize(undefined)).toBeUndefined()
    expect(safeSerialize(42)).toBe(42)
    expect(safeSerialize(true)).toBe(true)
    expect(safeSerialize('hello')).toBe('hello')
  })

  // @UT-SYS-SHARED-002@ (FROM: @IMP-SYS-SHARED-001@)
  it('truncates strings exceeding MAX_STRING_LENGTH', () => {
    const longString = 'x'.repeat(15_000)
    const result = safeSerialize(longString) as string
    expect(result).toHaveLength(10_000 + '...[+5000]'.length)
    expect(result).toContain('...[+5000]')
  })

  // @UT-SYS-SHARED-003@ (FROM: @IMP-SYS-SHARED-001@)
  it('serializes nested objects up to MAX_DEPTH', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } }
    const result = safeSerialize(deep) as Record<string, unknown>
    const level5 = (result.a as Record<string, unknown>).b as Record<string, unknown>
    const level4 = (level5.c as Record<string, unknown>).d as Record<string, unknown>
    const level3 = (level4.e as Record<string, unknown>)
    expect(level3.f).toBe('[MAX_DEPTH]')
  })

  // @UT-SYS-SHARED-004@ (FROM: @IMP-SYS-SHARED-001@)
  it('truncates arrays exceeding MAX_ARRAY_LENGTH', () => {
    const bigArray = Array.from({ length: 150 }, (_, i) => i)
    const result = safeSerialize(bigArray) as unknown[]
    expect(result).toHaveLength(101)
    expect(result[100]).toBe('[...+50 items]')
  })

  // @UT-SYS-SHARED-005@ (FROM: @IMP-SYS-SHARED-001@)
  it('converts non-standard types to string representation', () => {
    const sym = Symbol('test')
    expect(safeSerialize(sym)).toBe('Symbol(test)')
  })

  // @UT-SYS-SHARED-006@ (FROM: @IMP-SYS-SHARED-001@)
  it('handles objects with non-enumerable or throwing getters gracefully', () => {
    const tricky = Object.create(null)
    Object.defineProperty(tricky, 'boom', {
      get() {
        throw new Error('getter exploded')
      },
      enumerable: true,
    })
    const result = safeSerialize(tricky)
    expect(result).toBe('[UNSERIALIZABLE]')
  })
})

// Issue #263 (DP-004 / CS-012) — field-allow-list redaction.
describe('redactPayload', () => {
  // @UT-SYS-SHARED-021@ (FROM: @IMP-SYS-SHARED-008@)
  it('replaces values for keys outside the allow-list with [REDACTED]', () => {
    const result = redactPayload({ password: 'hunter2', email: 'pilot@example.com' }) as Record<
      string,
      unknown
    >
    expect(result).toEqual({
      password: PII_REDACTED_MARKER,
      email: PII_REDACTED_MARKER,
    })
  })

  // @UT-SYS-SHARED-022@ (FROM: @IMP-SYS-SHARED-008@)
  it('preserves values for keys in the default allow-list', () => {
    const result = redactPayload({
      code: 'OK',
      durationMs: 12,
      swUrl: '/sw.js',
      scope: '/',
    }) as Record<string, unknown>
    expect(result).toEqual({
      code: 'OK',
      durationMs: 12,
      swUrl: '/sw.js',
      scope: '/',
    })
  })

  // @UT-SYS-SHARED-023@ (FROM: @IMP-SYS-SHARED-008@)
  it('redacts nested object keys not in the allow-list', () => {
    const result = redactPayload({
      code: 'OK',
      payload: { tailNumber: 'D-EABC', latitude: 50.03 },
    }) as Record<string, unknown>
    expect(result).toEqual({
      code: 'OK',
      payload: PII_REDACTED_MARKER,
    })
  })

  // @UT-SYS-SHARED-024@ (FROM: @IMP-SYS-SHARED-008@)
  it('redacts PII embedded in arrays of objects', () => {
    const result = redactPayload({
      count: 1,
      stations: [
        { mass: 80, arm: 2.4 },
        { mass: 90, arm: 2.6 },
      ],
    }) as Record<string, unknown>
    expect(result.count).toBe(1)
    expect(result.stations).toBe(PII_REDACTED_MARKER)
  })

  // @UT-SYS-SHARED-025@ (FROM: @IMP-SYS-SHARED-008@)
  it('walks arrays redacting unknown keys per element', () => {
    const arr = [
      { code: 'OK', tailNumber: 'D-EXYZ' },
      { code: 'FAIL', tailNumber: 'D-EZZZ' },
    ]
    const result = redactPayload(arr) as Array<Record<string, unknown>>
    expect(result).toEqual([
      { code: 'OK', tailNumber: PII_REDACTED_MARKER },
      { code: 'FAIL', tailNumber: PII_REDACTED_MARKER },
    ])
  })

  // @UT-SYS-SHARED-026@ (FROM: @IMP-SYS-SHARED-008@)
  it('passes primitives, null and undefined through unchanged', () => {
    expect(redactPayload(null)).toBeNull()
    expect(redactPayload(undefined)).toBeUndefined()
    expect(redactPayload(42)).toBe(42)
    expect(redactPayload('a plain string')).toBe('a plain string')
    expect(redactPayload(true)).toBe(true)
  })

  // @UT-SYS-SHARED-027@ (FROM: @IMP-SYS-SHARED-008@)
  it('accepts a custom allow-list', () => {
    const allow = new Set(['onlyMe'])
    const result = redactPayload({ onlyMe: 'ok', code: 'also-not-allowed' }, allow) as Record<
      string,
      unknown
    >
    expect(result).toEqual({
      onlyMe: 'ok',
      code: PII_REDACTED_MARKER,
    })
  })

  // @UT-SYS-SHARED-028@ (FROM: @IMP-SYS-SHARED-008@)
  it('exposes the documented default allow-list members', () => {
    // Spot-check load-bearing keys — drift here would silently leak PII.
    expect(DEFAULT_SAFE_FIELDS.has('code')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('swUrl')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('durationMs')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('errorName')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('fallbackPath')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('advisoryReason')).toBe(true)
    // Envelope keys (added by the logger itself) must NOT be present —
    // otherwise a caller could smuggle PII into `data.message` (MAJOR-1, PR #361).
    expect(DEFAULT_SAFE_FIELDS.has('message')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('timestamp')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('level')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('context')).toBe(false)
    // Generic names that previously collided with domain-object fields
    // (MAJOR-2, PR #361) must NOT be members.
    expect(DEFAULT_SAFE_FIELDS.has('name')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('type')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('status')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('reason')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('fallback')).toBe(false)
    // …and known-bad keys are still NOT members.
    expect(DEFAULT_SAFE_FIELDS.has('password')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('email')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('tailNumber')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('latitude')).toBe(false)
  })

  // @UT-SYS-SHARED-045@ (FROM: @IMP-SYS-SHARED-008@)
  it('redacts a caller-supplied data.message even though the envelope uses that key (MAJOR-1)', () => {
    // err.message can echo template-interpolated pilot input; passing it as a
    // data key must not bypass redaction merely because the log envelope also
    // happens to use a top-level `message` field.
    const result = redactPayload({ message: 'crash near tail D-EABC' }) as Record<string, unknown>
    expect(result.message).toBe(PII_REDACTED_MARKER)
  })

  // @UT-SYS-SHARED-046@ (FROM: @IMP-SYS-SHARED-008@)
  it('redacts allow-listed-parent + non-allow-listed-child paths (MAJOR-2)', () => {
    // A future maintainer writing `{ code: { pilotName: 'Anna' } }` must not
    // silently leak `pilotName` just because `code` is allow-listed.
    const result = redactPayload({
      code: { pilotName: 'Anna', tailNumber: 'D-EABC' },
    }) as Record<string, unknown>
    expect(result.code).toEqual({
      pilotName: PII_REDACTED_MARKER,
      tailNumber: PII_REDACTED_MARKER,
    })
  })

  // @UT-SYS-SHARED-047@ (FROM: @IMP-SYS-SHARED-008@)
  it('guards against unbounded recursion when called outside the safeSerialize pipeline (NIT-9)', () => {
    // Build a circular structure where each link uses an allow-listed key
    // (`code`) — without that, the recursion is short-circuited by redaction
    // at the first hop. A `code → code → code → …` cycle is the only path
    // that can stack-overflow the redactor, so it's the only path the depth
    // guard actually has to defend against.
    type Cycle = { code: { code?: unknown } }
    const cyclic: Cycle = { code: {} }
    cyclic.code.code = cyclic.code
    const result = redactPayload(cyclic) as Record<string, unknown>
    expect(JSON.stringify(result)).toContain('[MAX_DEPTH]')
  })
})

describe('createLogger', () => {
  let consoleSpy: {
    info: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
    debug: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    consoleSpy = {
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T10:30:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // @UT-SYS-SHARED-007@ (FROM: @IMP-SYS-SHARED-002@)
  it('info() outputs structured JSON to console.info', () => {
    const logger = createLogger('TestContext')
    logger.info('test message')

    expect(consoleSpy.info).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output).toEqual({
      timestamp: '2026-01-15T10:30:00.000Z',
      level: 'INFO',
      context: 'TestContext',
      message: 'test message',
    })
  })

  // @UT-SYS-SHARED-008@ (FROM: @IMP-SYS-SHARED-002@)
  it('warn() outputs structured JSON to console.warn with allow-listed data preserved', () => {
    const logger = createLogger('TestContext')
    logger.warn('warning message', { code: 'WARN_X', durationMs: 4 })

    expect(consoleSpy.warn).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string)
    expect(output).toMatchObject({
      level: 'WARN',
      context: 'TestContext',
      message: 'warning message',
      data: { code: 'WARN_X', durationMs: 4 },
    })
  })

  // @UT-SYS-SHARED-009@ (FROM: @IMP-SYS-SHARED-002@)
  it('error() outputs structured JSON to console.error', () => {
    const logger = createLogger('TestContext')
    logger.error('error message')

    expect(consoleSpy.error).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(output).toMatchObject({
      level: 'ERROR',
      context: 'TestContext',
      message: 'error message',
    })
  })

  // @UT-SYS-SHARED-010@ (FROM: @IMP-SYS-SHARED-002@)
  it('debug() outputs structured JSON to console.debug when VITE_LOG_DEBUG=true', () => {
    vi.stubEnv('VITE_LOG_DEBUG', 'true')
    const logger = createLogger('TestContext')
    logger.debug('debug message')

    expect(consoleSpy.debug).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.debug.mock.calls[0][0] as string)
    expect(output).toMatchObject({
      level: 'DEBUG',
      context: 'TestContext',
      message: 'debug message',
    })
  })

  // @UT-SYS-SHARED-011@ (FROM: @IMP-SYS-SHARED-002@)
  it('redacts non-allow-listed data fields on WARN', () => {
    const logger = createLogger('Adapter')
    logger.warn('input received', {
      code: 'EVAL',
      stations: [{ mass: 80, arm: 2.4 }],
      pilotName: 'Anna',
    })

    const output = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string)
    expect(output.data).toEqual({
      code: 'EVAL',
      stations: PII_REDACTED_MARKER,
      pilotName: PII_REDACTED_MARKER,
    })
  })

  // @UT-SYS-SHARED-048@ (FROM: @IMP-SYS-SHARED-002@)
  it('redacts non-allow-listed data fields on ERROR', () => {
    // Split from UT-SYS-SHARED-011 (NIT-10, PR #361) so a future refactor
    // that diverges the ERROR path from the shared `emit()` is caught.
    const logger = createLogger('Adapter')
    logger.error('input rejected', {
      code: 'EVAL_FAIL',
      stations: [{ mass: 80, arm: 2.4 }],
      pilotName: 'Anna',
    })

    const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(output.data).toEqual({
      code: 'EVAL_FAIL',
      stations: PII_REDACTED_MARKER,
      pilotName: PII_REDACTED_MARKER,
    })
  })

  // @UT-SYS-SHARED-012@ (FROM: @IMP-SYS-SHARED-002@)
  it('omits data field when no data is provided', () => {
    const logger = createLogger('Core')
    logger.info('no data')

    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output).not.toHaveProperty('data')
  })

  // @UT-SYS-SHARED-013@ (FROM: @IMP-SYS-SHARED-002@)
  it('telemetryTrace() emits raw inputs/outputs when VITE_LOG_TELEMETRY=true', () => {
    vi.stubEnv('VITE_LOG_TELEMETRY', 'true')
    const logger = createLogger('MassBalance.Core')
    const telemetry: TelemetryPayload = {
      inputs: { stations: [{ mass: 80 }] },
      outputs: { totalMass: 1200, cg: 2.31 },
      durationMs: 4.2,
    }
    logger.telemetryTrace(telemetry)

    expect(consoleSpy.info).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output).toMatchObject({
      level: 'INFO',
      context: 'MassBalance.Core',
      message: 'TELEMETRY_TRACE',
      data: {
        inputs: telemetry.inputs,
        outputs: telemetry.outputs,
        durationMs: 4.2,
      },
    })
  })

  // @UT-SYS-SHARED-014@ (FROM: @IMP-SYS-SHARED-002@)
  it('telemetryTrace() omits durationMs when not provided', () => {
    vi.stubEnv('VITE_LOG_TELEMETRY', 'true')
    const logger = createLogger('Core')
    logger.telemetryTrace({ inputs: {}, outputs: {} })

    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output.data).not.toHaveProperty('durationMs')
  })

  // @UT-SYS-SHARED-015@ (FROM: @IMP-SYS-SHARED-001@, @IMP-SYS-SHARED-002@)
  it('safely serializes large aircraft schematic objects without choking (raw on telemetry)', () => {
    vi.stubEnv('VITE_LOG_TELEMETRY', 'true')
    const logger = createLogger('Telemetry')
    const largeInputs = {
      momentTable: Array.from({ length: 200 }, (_, i) => ({
        mass: i * 10,
        arm: 2.0 + i * 0.01,
        moment: i * 10 * (2.0 + i * 0.01),
      })),
    }
    logger.telemetryTrace({ inputs: largeInputs, outputs: {} })

    expect(consoleSpy.info).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output.data.inputs.momentTable).toHaveLength(101)
    expect(output.data.inputs.momentTable[100]).toBe('[...+100 items]')
  })
})

// Issue #263 (DP-004 / CS-012) — env-gating defaults and production behaviour.
describe('createLogger — env-gating defaults (issue #263)', () => {
  let consoleSpy: {
    info: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
    debug: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    consoleSpy = {
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // @UT-SYS-SHARED-029@ (FROM: @IMP-SYS-SHARED-002@)
  it('debug() is suppressed by default (VITE_LOG_DEBUG unset)', () => {
    const logger = createLogger('Dev')
    logger.debug('not visible by default')
    expect(consoleSpy.debug).not.toHaveBeenCalled()
  })

  // @UT-SYS-SHARED-030@ (FROM: @IMP-SYS-SHARED-002@)
  it('telemetryTrace() is suppressed by default (VITE_LOG_TELEMETRY unset)', () => {
    const logger = createLogger('Dev')
    logger.telemetryTrace({ inputs: { mass: 80 }, outputs: { cg: 2.3 } })
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })

  // @UT-SYS-SHARED-031@ (FROM: @IMP-SYS-SHARED-002@)
  it('telemetryTrace() is suppressed when VITE_LOG_TELEMETRY is the string "false"', () => {
    vi.stubEnv('VITE_LOG_TELEMETRY', 'false')
    const logger = createLogger('Dev')
    logger.telemetryTrace({ inputs: { mass: 80 }, outputs: { cg: 2.3 } })
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })

  // @UT-SYS-SHARED-032@ (FROM: @IMP-SYS-SHARED-002@)
  it('telemetryTrace() bypasses the production INFO gate when explicitly opted in', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_LOG_TELEMETRY', 'true')
    const logger = createLogger('Prod')
    logger.telemetryTrace({ inputs: { mass: 80 }, outputs: { cg: 2.3 } })
    expect(consoleSpy.info).toHaveBeenCalledOnce()
  })
})

// DP-011 / issue #263 — production console gating. DEBUG/INFO must be
// suppressed in production builds; WARN/ERROR must always reach the console.
describe('createLogger — production gating (DP-011 + issue #263)', () => {
  let consoleSpy: {
    info: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
    debug: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    consoleSpy = {
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
    // Simulate a production build.
    vi.stubEnv('PROD', true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // @UT-SYS-SHARED-016@ (FROM: @IMP-SYS-SHARED-002@)
  it('suppresses debug() output in production even when VITE_LOG_DEBUG is unset', () => {
    const logger = createLogger('Prod')
    logger.debug('debug message')
    expect(consoleSpy.debug).not.toHaveBeenCalled()
  })

  // @UT-SYS-SHARED-017@ (FROM: @IMP-SYS-SHARED-002@)
  it('suppresses info() output in production', () => {
    const logger = createLogger('Prod')
    logger.info('info message')
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })

  // @UT-SYS-SHARED-018@ (FROM: @IMP-SYS-SHARED-002@)
  it('suppresses telemetryTrace() output in production when VITE_LOG_TELEMETRY is unset', () => {
    const logger = createLogger('Prod')
    logger.telemetryTrace({ inputs: { mass: 80 }, outputs: { cg: 2.3 } })
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })

  // @UT-SYS-SHARED-019@ (FROM: @IMP-SYS-SHARED-002@)
  it('still emits warn() in production', () => {
    const logger = createLogger('Prod')
    logger.warn('warning message')
    expect(consoleSpy.warn).toHaveBeenCalledOnce()
  })

  // @UT-SYS-SHARED-020@ (FROM: @IMP-SYS-SHARED-002@)
  it('still emits error() in production', () => {
    const logger = createLogger('Prod')
    logger.error('error message')
    expect(consoleSpy.error).toHaveBeenCalledOnce()
  })

  // @UT-SYS-SHARED-033@ (FROM: @IMP-SYS-SHARED-002@)
  it('opts DEBUG into production output when VITE_LOG_DEBUG=true', () => {
    vi.stubEnv('VITE_LOG_DEBUG', 'true')
    const logger = createLogger('Prod')
    logger.debug('explicit debug')
    expect(consoleSpy.debug).toHaveBeenCalledOnce()
  })
})
