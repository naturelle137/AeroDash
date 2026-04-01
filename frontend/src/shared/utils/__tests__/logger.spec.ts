import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger, safeSerialize } from '../logger'
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
  it('warn() outputs structured JSON to console.warn', () => {
    const logger = createLogger('TestContext')
    logger.warn('warning message', { detail: 'some detail' })

    expect(consoleSpy.warn).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string)
    expect(output).toMatchObject({
      level: 'WARN',
      context: 'TestContext',
      message: 'warning message',
      data: { detail: 'some detail' },
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
  it('debug() outputs structured JSON to console.debug', () => {
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
  it('includes data payload when provided', () => {
    const logger = createLogger('Adapter')
    const payload = { stations: [{ mass: 80, arm: 2.4 }] }
    logger.info('input received', payload)

    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output.data).toEqual(payload)
  })

  // @UT-SYS-SHARED-012@ (FROM: @IMP-SYS-SHARED-002@)
  it('omits data field when no data is provided', () => {
    const logger = createLogger('Core')
    logger.info('no data')

    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output).not.toHaveProperty('data')
  })

  // @UT-SYS-SHARED-013@ (FROM: @IMP-SYS-SHARED-002@)
  it('telemetryTrace() logs structured telemetry payload at INFO level', () => {
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
    const logger = createLogger('Core')
    logger.telemetryTrace({ inputs: {}, outputs: {} })

    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output.data).not.toHaveProperty('durationMs')
  })

  // @UT-SYS-SHARED-015@ (FROM: @IMP-SYS-SHARED-001@, @IMP-SYS-SHARED-002@)
  it('safely serializes large aircraft schematic objects without choking', () => {
    const logger = createLogger('Telemetry')
    const largePayload = {
      momentTable: Array.from({ length: 200 }, (_, i) => ({
        mass: i * 10,
        arm: 2.0 + i * 0.01,
        moment: i * 10 * (2.0 + i * 0.01),
      })),
    }
    logger.info('large payload test', largePayload)

    expect(consoleSpy.info).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(output.data.momentTable).toHaveLength(101)
    expect(output.data.momentTable[100]).toBe('[...+100 items]')
  })
})
