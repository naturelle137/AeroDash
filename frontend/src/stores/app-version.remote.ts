/**
 * App Version Remote — best-effort fetch of `minSafeVersion` from a
 * server-hosted manifest (currently `/version.json` shipped with the PWA
 * shell, but the endpoint is operator-overridable in future).
 * P3 App Shell — uses browser APIs (`fetch`) only; no Vue/Pinia framework
 * imports.
 *
 * ## REQ-SYS-006 — Scheduled-fetch lobby
 *
 * The build-time constant `__MIN_SAFE_VERSION__` is baked into each released
 * bundle and cannot be raised without a re-deploy. To make the kill-switch
 * actually usable for a safety-critical bug discovered post-release, the
 * store calls this module on every online check; the highest value across
 * (build-time, cached, remote) is then persisted to IndexedDB and enforced
 * even after the next offline restart.
 *
 * ## Failure modes (documented — all return `null`)
 *
 * | Mode | Behaviour |
 * | :--- | :-------- |
 * | Network down / DNS failure (`fetch` throws) | `null` — caller keeps the prior effective minimum. |
 * | HTTP non-2xx (404, 500, etc.) | `null` — same. |
 * | Body is not valid JSON | `null`. |
 * | JSON parses but does not contain a SemVer-shaped `minSafeVersion` | `null`. |
 * | Browser denies the fetch (CSP, COEP) | `null`. |
 * | Response `Content-Length` exceeds the body cap | `null` — body never read. |
 * | Response `Content-Length` present but malformed (non-numeric / negative / fractional) | `null` — body never read. |
 * | Read body exceeds the body-byte cap (no `Content-Length`) | `null` — measured as UTF-8 bytes. |
 * | Timeout (default 4 s) | `null` — wall-clock race applies with or without `AbortController`. |
 *
 * The contract is "best-effort": this module **never throws** and **never
 * raises a user-visible error**. A `null` return simply means "no fresh
 * value; keep what we have." Refusing to fail-loud here is deliberate — the
 * remote endpoint is a soft override, not the authoritative source. A flaky
 * CDN can never accidentally unblock a kill-switched build because the
 * store still applies `max(buildTimeConstant, cachedValue, remoteValue)`.
 *
 * The privacy implications of issuing the fetch on every cold start are
 * tracked separately (ADR pending). For now the fetch carries
 * no body, no identifying headers, and is cache-busted only via the
 * standard browser cache (no query param).
 */

// @IMP-SYS-STORE-017@ (FROM: @REQ-SYS-006@, @H-019@)

import { SEMVER_RE } from '@/stores/app-version.semver'

/** Canonical relative path served from the PWA `public/` directory. */
export const DEFAULT_VERSION_ENDPOINT = '/version.json'

/** Maximum bytes to read from the response body — defence against an oversized response. */
const MAX_BODY_BYTES = 4_096

export interface FetchRemoteOptions {
  /** Override the endpoint — primarily for tests; production uses the default. */
  readonly endpoint?: string
  /** Inject a fetch implementation for tests; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch
  /** Request-timeout in milliseconds. Default 4000 ms (cold-start budget). */
  readonly timeoutMs?: number
}

/**
 * Race `promise` against a single wall-clock `setTimeout`. On timeout the
 * optional `onTimeout` hook fires (used to `abort()` the in-flight fetch) and
 * the result resolves to `null`. This guarantees the documented cold-start
 * budget holds even when `AbortController` is absent OR present-but-ignored by
 * a stubbed/sandboxed `fetchImpl` — and, because `onTimeout` still aborts, a
 * fetch that DOES honour the signal is cancelled rather than left running
 * detached. A single timer (no separate abort timer) means there is no race in
 * which the wall clock wins and silently cancels the abort.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        onTimeout?.()
      } catch {
        /* swallow — abort is best-effort */
      }
      resolve(null)
    }, ms)
    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

/**
 * Fetch the remote `minSafeVersion` if available.
 *
 * Returns the SemVer string when the endpoint reports a structurally-valid
 * value; returns `null` for every failure mode listed in the module JSDoc.
 * Never throws.
 */
export async function fetchRemoteMinSafeVersion(
  opts: FetchRemoteOptions = {},
): Promise<string | null> {
  const endpoint = opts.endpoint ?? DEFAULT_VERSION_ENDPOINT
  const fetchImpl = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined)
  const timeoutMs = typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0 ? opts.timeoutMs : 4000

  if (!fetchImpl) return null

  const controller =
    typeof AbortController === 'function' ? new AbortController() : null

  const doFetch = async (): Promise<string | null> => {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        signal: controller?.signal,
      })

      if (!response.ok) return null

      // Pre-flight body cap: refuse to read a body the server is telling us is
      // oversized. UTF-16-code-units != bytes, but Content-Length is bytes
      // and is the authoritative pre-read signal. A hostile or misconfigured
      // CDN serving an oversized `/version.json` cannot OOM/jank a low-RAM
      // cockpit tablet because we never touch the body.
      const lenHeader = response.headers?.get?.('content-length') ?? null
      if (lenHeader !== null) {
        // Content-Length per RFC 9110 §8.6 is `1*DIGIT` — a bare decimal. Parse
        // strictly: anything else (non-numeric `abc`, hex `0x10`, padded/empty,
        // comma-joined duplicate `42, 42`) is malformed, so we cannot trust the
        // pre-flight size signal and reject rather than fall through to read an
        // unbounded body. (`Number('abc')` is NaN, which the prior
        // `Number.isFinite(len) && len > cap` test quietly skipped;
        // `Number('0x10')`/`Number(' 4000 ')`/`Number('')` would also have
        // sneaked through a looser numeric coercion.)
        if (!/^\d+$/.test(lenHeader.trim())) return null
        if (Number(lenHeader.trim()) > MAX_BODY_BYTES) return null
      }

      const text = await response.text()
      if (typeof text !== 'string') return null
      // Post-read cap for chunked / SW responses that omit Content-Length.
      // Measure actual UTF-8 byte length (not UTF-16 code units) so a body of
      // multi-byte codepoints cannot slip past a code-unit count that is 2–4×
      // smaller than the transport size.
      const byteLength =
        typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length
      if (byteLength > MAX_BODY_BYTES) return null

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return null
      }

      if (parsed === null || typeof parsed !== 'object') return null
      const value = (parsed as Record<string, unknown>).minSafeVersion
      if (typeof value !== 'string' || !SEMVER_RE.test(value)) return null
      return value
    } catch {
      return null
    }
  }

  // Single wall-clock timeout. On timeout we
  // both abort the in-flight request (cancellation when the signal is honoured)
  // AND resolve `null` (the budget guarantee when it is not — sandboxed WebView
  // with no AbortController, or a `fetchImpl` that ignores the signal). Driving
  // the abort from the same timer removes the earlier dual-timer race where the
  // wall clock could win and `clearTimeout` the pending abort, leaving a
  // signal-honouring fetch running detached.
  return await withTimeout(doFetch(), timeoutMs, () => {
    try {
      controller?.abort()
    } catch {
      /* swallow — abort is best-effort */
    }
  })
}

export const appVersionRemote = {
  fetchRemoteMinSafeVersion,
  DEFAULT_VERSION_ENDPOINT,
}
