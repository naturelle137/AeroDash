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
  it('returns primitives unchanged', () => {
    expect(safeSerialize(null)).toBeNull()
    expect(safeSerialize(undefined)).toBeUndefined()
    expect(safeSerialize(42)).toBe(42)
    expect(safeSerialize(true)).toBe(true)
    expect(safeSerialize('hello')).toBe('hello')
  })

  it('truncates strings exceeding MAX_STRING_LENGTH', () => {
    const longString = 'x'.repeat(15_000)
    const result = safeSerialize(longString) as string
    expect(result).toHaveLength(10_000 + '...[+5000]'.length)
    expect(result).toContain('...[+5000]')
  })

  it('serializes nested objects up to MAX_DEPTH', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } }
    const result = safeSerialize(deep) as Record<string, unknown>
    const level5 = (result.a as Record<string, unknown>).b as Record<string, unknown>
    const level4 = (level5.c as Record<string, unknown>).d as Record<string, unknown>
    const level3 = (level4.e as Record<string, unknown>)
    expect(level3.f).toBe('[MAX_DEPTH]')
  })

  it('truncates arrays exceeding MAX_ARRAY_LENGTH', () => {
    const bigArray = Array.from({ length: 150 }, (_, i) => i)
    const result = safeSerialize(bigArray) as unknown[]
    expect(result).toHaveLength(101)
    expect(result[100]).toBe('[...+50 items]')
  })

  it('converts non-standard types to string representation', () => {
    const sym = Symbol('test')
    expect(safeSerialize(sym)).toBe('Symbol(test)')
  })

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

describe('redactPayload', () => {
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

  it('passes primitives, null and undefined through unchanged', () => {
    expect(redactPayload(null)).toBeNull()
    expect(redactPayload(undefined)).toBeUndefined()
    expect(redactPayload(42)).toBe(42)
    expect(redactPayload('a plain string')).toBe('a plain string')
    expect(redactPayload(true)).toBe(true)
  })

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

  it('exposes the documented default allow-list members', () => {
    // Spot-check load-bearing keys — drift here would silently leak PII.
    expect(DEFAULT_SAFE_FIELDS.has('code')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('swUrl')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('durationMs')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('errorName')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('fallbackPath')).toBe(true)
    expect(DEFAULT_SAFE_FIELDS.has('advisoryReason')).toBe(true)
    // Envelope keys (added by the logger itself) must NOT be present —
    // otherwise a caller could smuggle PII into `data.message`.
    expect(DEFAULT_SAFE_FIELDS.has('message')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('timestamp')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('level')).toBe(false)
    expect(DEFAULT_SAFE_FIELDS.has('context')).toBe(false)
    // Generic names that previously collided with domain-object fields
    // must NOT be members.
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

  it('redacts a caller-supplied data.message even though the envelope uses that key', () => {
    // err.message can echo template-interpolated pilot input; passing it as a
    // data key must not bypass redaction merely because the log envelope also
    // happens to use a top-level `message` field.
    const result = redactPayload({ message: 'crash near tail D-EABC' }) as Record<string, unknown>
    expect(result.message).toBe(PII_REDACTED_MARKER)
  })

  it('redacts allow-listed-parent + non-allow-listed-child paths', () => {
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

  it('guards against unbounded recursion when called outside the safeSerialize pipeline', () => {
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

  it('redacts non-allow-listed data fields on ERROR', () => {
    // Split from UT-SYS-SHARED-011 so a future refactor
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

  it('omits data field when no data is provided', () => {
    const logger = createLogger('Core')
    logger.info('no data')

    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output).not.toHaveProperty('data')
  })

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

  it('telemetryTrace() omits durationMs when not provided', () => {
    vi.stubEnv('VITE_LOG_TELEMETRY', 'true')
    const logger = createLogger('Core')
    logger.telemetryTrace({ inputs: {}, outputs: {} })

    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output.data).not.toHaveProperty('durationMs')
  })

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

describe('createLogger — env-gating defaults', () => {
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

  it('debug() is suppressed by default (VITE_LOG_DEBUG unset)', () => {
    const logger = createLogger('Dev')
    logger.debug('not visible by default')
    expect(consoleSpy.debug).not.toHaveBeenCalled()
  })

  it('telemetryTrace() is suppressed by default (VITE_LOG_TELEMETRY unset)', () => {
    const logger = createLogger('Dev')
    logger.telemetryTrace({ inputs: { mass: 80 }, outputs: { cg: 2.3 } })
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })

  it('telemetryTrace() is suppressed when VITE_LOG_TELEMETRY is the string "false"', () => {
    vi.stubEnv('VITE_LOG_TELEMETRY', 'false')
    const logger = createLogger('Dev')
    logger.telemetryTrace({ inputs: { mass: 80 }, outputs: { cg: 2.3 } })
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })

  it('telemetryTrace() bypasses the production INFO gate when explicitly opted in', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_LOG_TELEMETRY', 'true')
    const logger = createLogger('Prod')
    logger.telemetryTrace({ inputs: { mass: 80 }, outputs: { cg: 2.3 } })
    expect(consoleSpy.info).toHaveBeenCalledOnce()
  })
})

// production console gating: DEBUG/INFO suppressed in production builds;
// WARN/ERROR always reach the console.
describe('createLogger — production gating', () => {
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

  it('suppresses debug() output in production even when VITE_LOG_DEBUG is unset', () => {
    const logger = createLogger('Prod')
    logger.debug('debug message')
    expect(consoleSpy.debug).not.toHaveBeenCalled()
  })

  it('suppresses info() output in production', () => {
    const logger = createLogger('Prod')
    logger.info('info message')
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })

  it('suppresses telemetryTrace() output in production when VITE_LOG_TELEMETRY is unset', () => {
    const logger = createLogger('Prod')
    logger.telemetryTrace({ inputs: { mass: 80 }, outputs: { cg: 2.3 } })
    expect(consoleSpy.info).not.toHaveBeenCalled()
  })

  it('still emits warn() in production', () => {
    const logger = createLogger('Prod')
    logger.warn('warning message')
    expect(consoleSpy.warn).toHaveBeenCalledOnce()
  })

  it('still emits error() in production', () => {
    const logger = createLogger('Prod')
    logger.error('error message')
    expect(consoleSpy.error).toHaveBeenCalledOnce()
  })

  it('opts DEBUG into production output when VITE_LOG_DEBUG=true', () => {
    vi.stubEnv('VITE_LOG_DEBUG', 'true')
    const logger = createLogger('Prod')
    logger.debug('explicit debug')
    expect(consoleSpy.debug).toHaveBeenCalledOnce()
  })
})
