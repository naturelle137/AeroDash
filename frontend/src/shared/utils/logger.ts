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

/**
 * DP-004 / CS-012 — PII redaction allow-list (issue #263).
 *
 * Field names safe to log in raw form. Any object key NOT present in this
 * set has its value replaced with the {@link PII_REDACTED_MARKER}, regardless
 * of nesting depth. The key itself is preserved so the resulting log entry
 * still carries useful structural information.
 *
 * Add fields here only when they are GUARANTEED not to carry pilot-entered
 * data, aircraft identifiers, position/route data, M&B/Performance/Fuel
 * inputs, or other safety-sensitive content. Operational metadata
 * (timings, error codes, app-controlled URLs) is the only acceptable class.
 */
export const PII_REDACTED_MARKER = '[REDACTED]'

export const DEFAULT_SAFE_FIELDS: ReadonlySet<string> = new Set([
  // Log envelope (always allowed — produced by the logger itself).
  'timestamp',
  'level',
  'context',
  'message',
  // Operational metadata.
  'durationMs',
  'count',
  'size',
  'length',
  // PWA / Service Worker registration metadata. URLs are app-controlled
  // build artifacts (no pilot input); scope is the SW scope path.
  'swUrl',
  'scope',
  // Errors / status codes.
  'code',
  'name',
  'status',
  'statusCode',
  'type',
  // App version / build metadata.
  'version',
  'buildDate',
  // Retry / attempt counters.
  'attempt',
  'retry',
  // sessionStorage / advisory diagnostic payloads (issue #263).
  'fallback',
  'reason',
])

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

/**
 * DP-004 / CS-012 — field-allow-list redaction (issue #263).
 *
 * Walks the structure produced by {@link safeSerialize} and replaces values
 * for any object key not in `allowList` with {@link PII_REDACTED_MARKER}.
 * Arrays are traversed (so PII nested in an array of objects is also
 * redacted), but top-level primitives, arrays of primitives, and the marker
 * sentinels emitted by {@link safeSerialize} pass through unchanged.
 *
 * Defence-in-depth: this runs after {@link safeSerialize}, so it can rely on
 * the input being plain JSON-shaped (Record, Array, primitive, sentinel).
 */
// @IMP-SYS-SHARED-008@ (FROM: @DES-ARCH-001@)
export function redactPayload(
  value: unknown,
  allowList: ReadonlySet<string> = DEFAULT_SAFE_FIELDS,
): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item, allowList))
  }

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (allowList.has(key)) {
      result[key] = redactPayload(val, allowList)
    } else {
      result[key] = PII_REDACTED_MARKER
    }
  }
  return result
}

interface FormatOptions {
  /**
   * When `false`, skip the {@link redactPayload} step and emit the
   * structurally-shaped payload as-is. Reserved for `telemetryTrace`, which
   * is itself env-gated — opting telemetry on is the explicit acceptance
   * that raw inputs/outputs will be logged.
   */
  redact?: boolean
}

function formatEntry(entry: LogEntry, opts: FormatOptions = {}): LogEntry {
  if (entry.data === undefined) return entry
  // safeSerialize → redactPayload: structural shaping first, then PII redaction.
  const sanitized = safeSerialize(entry.data)
  if (opts.redact === false) return { ...entry, data: sanitized }
  return { ...entry, data: redactPayload(sanitized) }
}

/**
 * DP-011 — production console gating.
 *
 * Rules (`isLevelEnabled`):
 * - `WARN` / `ERROR`: always emitted (operational and safety-relevant
 *   diagnostics).
 * - `INFO`: emitted in dev (`!import.meta.env.PROD`); suppressed in
 *   production builds — INFO carries verbose telemetry that may echo
 *   pilot-entered M&B inputs and aircraft data.
 * - `DEBUG`: env-gated by `VITE_LOG_DEBUG === 'true'`. Off everywhere by
 *   default (issue #263 — DP-004 / CS-012 deferral from v0.3.0-alpha audit);
 *   enable explicitly when debugging.
 *
 * `telemetryTrace()` is independently env-gated by
 * `VITE_LOG_TELEMETRY === 'true'` (see {@link createLogger}). Telemetry
 * payloads carry raw computation inputs/outputs (i.e. pilot-entered data
 * by design); they MUST stay off unless an operator explicitly opts in.
 *
 * Gating lives in the logger rather than the bundler because Vite 8's
 * default minifier (oxc) ignores esbuild's `pure`/`drop` options, so a
 * build-time strip would silently no-op.
 */
function isEnvFlagTrue(value: unknown): boolean {
  return value === 'true' || value === true
}

function isLevelEnabled(level: LogLevel): boolean {
  if (level === 'WARN' || level === 'ERROR') return true
  if (level === 'DEBUG') {
    return isEnvFlagTrue(import.meta.env.VITE_LOG_DEBUG)
  }
  // INFO: dev only (production builds suppress).
  return !import.meta.env.PROD
}

function isTelemetryEnabled(): boolean {
  return isEnvFlagTrue(import.meta.env.VITE_LOG_TELEMETRY)
}

function consoleFor(level: LogLevel): (...args: unknown[]) => void {
  if (level === 'ERROR') return console.error
  if (level === 'WARN') return console.warn
  if (level === 'DEBUG') return console.debug
  return console.info
}

function emit(level: LogLevel, context: string, message: string, data?: unknown, opts: FormatOptions = {}): void {
  const entry = formatEntry(
    {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    },
    opts,
  )
  consoleFor(level)(JSON.stringify(entry))
}

// @IMP-SYS-SHARED-002@ (FROM: @DES-ARCH-001@)
export function createLogger(context: string): Logger {
  const log = (level: LogLevel, message: string, data?: unknown): void => {
    if (!isLevelEnabled(level)) return
    emit(level, context, message, data)
  }

  return {
    debug: (message, data) => log('DEBUG', message, data),
    info: (message, data) => log('INFO', message, data),
    warn: (message, data) => log('WARN', message, data),
    error: (message, data) => log('ERROR', message, data),
    telemetryTrace: (payload) => {
      // Telemetry is opt-in (DP-004 / CS-012 — issue #263). When the
      // env flag is unset the entire payload is dropped before serialization,
      // so raw inputs/outputs never reach the formatter or console. When
      // opt-in is set the operator has explicitly accepted that raw
      // computation inputs/outputs will be logged, so redaction is skipped
      // for the telemetry payload itself (the whole point of the channel),
      // and the INFO production gate is also bypassed — telemetry is an
      // operator-enabled diagnostic channel, not normal log output.
      if (!isTelemetryEnabled()) return
      emit(
        'INFO',
        context,
        'TELEMETRY_TRACE',
        {
          inputs: payload.inputs,
          outputs: payload.outputs,
          ...(payload.durationMs !== undefined && { durationMs: payload.durationMs }),
        },
        { redact: false },
      )
    },
  }
}
