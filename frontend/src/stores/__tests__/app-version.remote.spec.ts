/**
 * Unit tests for app-version.remote.ts
 *
 * Covers REQ-SYS-006 / H-019 — the remote-refresh leg from issue #271. The
 * remote endpoint is a *soft* override: every failure mode (network, HTTP,
 * parse, schema) must resolve to `null` so the store keeps the prior floor.
 */

// @UT-SYS-STORE-055@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-056@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-057@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-058@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-059@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-060@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-061@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-062@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-063@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-082@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-083@ (FROM: @IMP-SYS-STORE-017@)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  fetchRemoteMinSafeVersion,
  DEFAULT_VERSION_ENDPOINT,
} from '../app-version.remote'

interface MockResponseInit {
  ok?: boolean
  status?: number
  contentLength?: string | null
}

function mockJsonResponse(body: unknown, init: MockResponseInit = {}): Response {
  const { ok = true, status = 200, contentLength = null } = init
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok,
    status,
    headers: {
      get: (name: string): string | null => {
        if (name.toLowerCase() === 'content-length') return contentLength
        return null
      },
    },
    text: async () => text,
  } as unknown as Response
}

describe('fetchRemoteMinSafeVersion — happy path', () => {
  // @UT-SYS-STORE-055@ (FROM: @IMP-SYS-STORE-017@)
  it('returns the SemVer string from a 200 JSON response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse({ minSafeVersion: '0.5.0' }))
    const out = await fetchRemoteMinSafeVersion({ fetchImpl })
    expect(out).toBe('0.5.0')
    expect(fetchImpl).toHaveBeenCalledWith(
      DEFAULT_VERSION_ENDPOINT,
      expect.objectContaining({ method: 'GET', cache: 'no-store', credentials: 'omit' }),
    )
  })

  // @UT-SYS-STORE-056@ (FROM: @IMP-SYS-STORE-017@)
  it('honours an explicit endpoint override', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse({ minSafeVersion: '1.0.0' }))
    await fetchRemoteMinSafeVersion({ fetchImpl, endpoint: '/custom/v.json' })
    expect(fetchImpl).toHaveBeenCalledWith('/custom/v.json', expect.any(Object))
  })
})

describe('fetchRemoteMinSafeVersion — failure modes resolve to null', () => {
  // @UT-SYS-STORE-057@ (FROM: @IMP-SYS-STORE-017@)
  it('returns null for HTTP non-2xx', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse('', { ok: false, status: 404 }))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
  })

  // @UT-SYS-STORE-058@ (FROM: @IMP-SYS-STORE-017@)
  it('returns null when fetch rejects', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('NetworkError'))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
  })

  // @UT-SYS-STORE-059@ (FROM: @IMP-SYS-STORE-017@)
  it('returns null when the body is not valid JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse('<<not-json>>'))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
  })

  // @UT-SYS-STORE-060@ (FROM: @IMP-SYS-STORE-017@)
  it('returns null when the JSON is missing a minSafeVersion field', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse({ other: 'x' }))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
  })

  // @UT-SYS-STORE-061@ (FROM: @IMP-SYS-STORE-017@)
  it('returns null when minSafeVersion is not a SemVer', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse({ minSafeVersion: 'banana' }))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
  })

  // @UT-SYS-STORE-062@ (FROM: @IMP-SYS-STORE-017@)
  it('returns null when no fetch implementation is available', async () => {
    // Override the optional `fetchImpl` and clear the global fetch.
    const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch
    ;(globalThis as { fetch?: typeof fetch }).fetch = undefined
    try {
      expect(await fetchRemoteMinSafeVersion({ fetchImpl: undefined })).toBeNull()
    } finally {
      ;(globalThis as { fetch?: typeof fetch }).fetch = originalFetch
    }
  })

  // @UT-SYS-STORE-063@ (FROM: @IMP-SYS-STORE-017@)
  it('returns null when the response body is suspiciously large (post-read cap)', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse('x'.repeat(5_000)))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
  })

  // @UT-SYS-STORE-082@ (FROM: @IMP-SYS-STORE-017@)
  // PR-review Minor #5: pre-flight Content-Length check — refuse to read
  // a body the server already advertised as oversized.
  it('returns null on a Content-Length header that exceeds the cap, before reading the body', async () => {
    const textSpy = vi.fn<() => Promise<string>>(async () => '')
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-length' ? String(10_000) : null,
      },
      text: textSpy,
    } as unknown as Response)

    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
    // Body must not have been read — pre-flight guard caught the oversize.
    expect(textSpy).not.toHaveBeenCalled()
  })
})

describe('fetchRemoteMinSafeVersion — AbortController fallback (PR-review Minor #6)', () => {
  let originalAbort: typeof AbortController | undefined

  beforeEach(() => {
    originalAbort = (globalThis as { AbortController?: typeof AbortController }).AbortController
  })
  afterEach(() => {
    if (originalAbort) {
      ;(globalThis as { AbortController?: typeof AbortController }).AbortController = originalAbort
    }
  })

  // @UT-SYS-STORE-083@ (FROM: @IMP-SYS-STORE-017@)
  it('times out via Promise.race when AbortController is unavailable', async () => {
    // Drop AbortController to simulate a sandboxed WebView / locked-down runtime.
    ;(globalThis as { AbortController?: typeof AbortController }).AbortController =
      undefined as unknown as typeof AbortController

    // Fetch never resolves — only the wall-clock timeout can return us.
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(() => new Promise<Response>(() => undefined as unknown as void))

    const start = Date.now()
    const out = await fetchRemoteMinSafeVersion({ fetchImpl, timeoutMs: 30 })
    const elapsed = Date.now() - start

    expect(out).toBeNull()
    // Sanity-check: the call returned in the same order of magnitude as the
    // 30 ms budget — i.e. it didn't hang for the full default 4 s.
    expect(elapsed).toBeLessThan(500)
  })
})
