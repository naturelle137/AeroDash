/**
 * App Version Remote — best-effort fetch of `minSafeVersion` from a
 * server-hosted manifest (currently `/version.json` shipped with the PWA
 * shell, but the endpoint is operator-overridable in future).
 * P3 App Shell — uses browser APIs (`fetch`) only; no Vue/Pinia framework
 * imports.
 *
 * ## REQ-SYS-006 — Scheduled-fetch lobby (issue #271)
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
 *
 * The contract is "best-effort": this module **never throws** and **never
 * raises a user-visible error**. A `null` return simply means "no fresh
 * value; keep what we have." Refusing to fail-loud here is deliberate — the
 * remote endpoint is a soft override, not the authoritative source. A flaky
 * CDN can never accidentally unblock a kill-switched build because the
 * store still applies `max(buildTimeConstant, cachedValue, remoteValue)`.
 *
 * The privacy implications of issuing the fetch on every cold start are
 * tracked separately in issue #274 (ADR pending). For now the fetch carries
 * no body, no identifying headers, and is cache-busted only via the
 * standard browser cache (no query param).
 */

// @IMP-SYS-STORE-017@ (FROM: @REQ-SYS-006@, @H-019@)

/** Canonical relative path served from the PWA `public/` directory. */
export const DEFAULT_VERSION_ENDPOINT = '/version.json'

/** Maximum bytes to read from the response body — defence against an oversized response. */
const MAX_BODY_BYTES = 4_096

/** SemVer-ish guard mirrored from `app-version.cache.ts`. */
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

export interface FetchRemoteOptions {
  /** Override the endpoint — primarily for tests; production uses the default. */
  readonly endpoint?: string
  /** Inject a fetch implementation for tests; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch
  /** Request-timeout in milliseconds. Default 4000 ms (cold-start budget). */
  readonly timeoutMs?: number
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
    typeof AbortController === 'function' ? new AbortController() : (null as AbortController | null)
  const timer =
    controller !== null
      ? setTimeout(() => {
          try {
            controller.abort()
          } catch {
            /* swallow */
          }
        }, timeoutMs)
      : null

  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller?.signal,
    })

    if (!response.ok) return null

    const text = await response.text()
    if (typeof text !== 'string') return null
    if (text.length > MAX_BODY_BYTES) return null

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
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}

export const appVersionRemote = {
  fetchRemoteMinSafeVersion,
  DEFAULT_VERSION_ENDPOINT,
}
