/**
 * Production-build telemetry guard.
 *
 * `logger.telemetryTrace()` emits raw computation inputs/outputs
 * (pilot-entered Mass & Balance / Performance / Fuel data) and BYPASSES the
 * PII redactor by design — opting in is the operator's explicit acceptance
 * that those values will land in `console.info`. Documentation alone
 * (`.env.example`, CONTRIBUTING.md) is not sufficient; this helper is wired
 * into `vite.config.ts` to fail `pnpm build` fast if `VITE_LOG_TELEMETRY`
 * is truthy in the build environment.
 *
 * Factored out of `vite.config.ts` so the assertion can be unit-tested
 * without spawning a full Vite build.
 *
 * NOTE: when called from `vite.config.ts`, the caller is responsible for
 * passing the merged env. Vite does NOT load `.env*` files into
 * `process.env` while the config is being evaluated — you must invoke
 * `loadEnv()` first and pass its result here, otherwise a developer
 * dropping `VITE_LOG_TELEMETRY=true` into `.env.production` / `.env.local`
 * would escape the guard while still shipping a telemetry-enabled bundle
 * (because Vite *does* populate `import.meta.env` from those files when
 * producing the bundle).
 */

/**
 * Truthy parser kept in sync with `isEnvFlagTrue()` in
 * `src/shared/utils/logger.ts` — see the same regex there. Accepted truthy
 * values: `true`, `1`, `yes`, `on` (case-insensitive, leading/trailing
 * whitespace tolerated).
 */
export const TELEMETRY_TRUTHY_RE = /^(true|1|yes|on)$/i

export const TELEMETRY_GUARD_ABORT_MESSAGE =
  'AeroDash build aborted: VITE_LOG_TELEMETRY is enabled in a production build. ' +
  '`logger.telemetryTrace()` bypasses the PII redactor by design (DP-004 / CS-012, issue #263) ' +
  'and MUST NOT ship to pilots. Unset the env var or set it to `false` and rerun `pnpm build`.'

/**
 * Throws if `env.VITE_LOG_TELEMETRY` parses as truthy. `env` should be the
 * merged view that Vite's bundler will see (i.e. the result of
 * `loadEnv(mode, envDir, …)`, which already merges `process.env` over the
 * `.env*` file values).
 */
export function assertNoTelemetryInProductionBuild(env: Record<string, string | undefined>): void {
  const raw = env.VITE_LOG_TELEMETRY
  if (typeof raw !== 'string') return
  if (!TELEMETRY_TRUTHY_RE.test(raw.trim())) return
  throw new Error(TELEMETRY_GUARD_ABORT_MESSAGE)
}
