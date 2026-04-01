export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  context: string
  message: string
  data?: unknown
}

export interface TelemetryPayload {
  inputs: unknown
  outputs: unknown
  durationMs?: number
}

export interface Logger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
  telemetryTrace(payload: TelemetryPayload): void
}

const MAX_DEPTH = 5
const MAX_STRING_LENGTH = 10_000
const MAX_ARRAY_LENGTH = 100

// @IMP-SYS-SHARED-001@ (FROM: @DES-ARCH-001@)
export function safeSerialize(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[MAX_DEPTH]'
  if (value === null || value === undefined) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      return value.slice(0, MAX_STRING_LENGTH) + `...[+${value.length - MAX_STRING_LENGTH}]`
    }
    return value
  }

  if (Array.isArray(value)) {
    const truncated = value.length > MAX_ARRAY_LENGTH
    const slice = truncated ? value.slice(0, MAX_ARRAY_LENGTH) : value
    const mapped = slice.map((item) => safeSerialize(item, depth + 1))
    if (truncated) mapped.push(`[...+${value.length - MAX_ARRAY_LENGTH} items]`)
    return mapped
  }

  if (typeof value === 'object') {
    try {
      const result: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        result[key] = safeSerialize(val, depth + 1)
      }
      return result
    } catch {
      return '[UNSERIALIZABLE]'
    }
  }

  return String(value)
}

function formatEntry(entry: LogEntry): LogEntry {
  return {
    ...entry,
    data: entry.data !== undefined ? safeSerialize(entry.data) : undefined,
  }
}

// @IMP-SYS-SHARED-002@ (FROM: @DES-ARCH-001@)
export function createLogger(context: string): Logger {
  const log = (level: LogLevel, message: string, data?: unknown): void => {
    const entry = formatEntry({
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    })

    const consoleFn =
      level === 'ERROR'
        ? console.error
        : level === 'WARN'
          ? console.warn
          : level === 'DEBUG'
            ? console.debug
            : console.info

    consoleFn(
      JSON.stringify(entry),
    )
  }

  return {
    debug: (message, data) => log('DEBUG', message, data),
    info: (message, data) => log('INFO', message, data),
    warn: (message, data) => log('WARN', message, data),
    error: (message, data) => log('ERROR', message, data),
    telemetryTrace: (payload) => {
      log('INFO', 'TELEMETRY_TRACE', {
        inputs: payload.inputs,
        outputs: payload.outputs,
        ...(payload.durationMs !== undefined && { durationMs: payload.durationMs }),
      })
    },
  }
}
