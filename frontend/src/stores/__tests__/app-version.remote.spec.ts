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
// @UT-SYS-STORE-086@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-087@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-088@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-092@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-093@ (FROM: @IMP-SYS-STORE-017@)

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

  // @UT-SYS-STORE-086@ (FROM: @IMP-SYS-STORE-017@)
  // PR-review Major #1: the SemVer shape-guard must accept a value carrying
  // BOTH a pre-release and a build-metadata suffix (legal SemVer 2.0.0). The
  // prior `[-+]`-only guard rejected it, silently demoting such an
  // operator-pushed floor to null.
  it('accepts a minSafeVersion carrying both pre-release and build metadata', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse({ minSafeVersion: '0.4.0-rc.1+sha.abc' }))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBe('0.4.0-rc.1+sha.abc')
  })

  // @UT-SYS-STORE-087@ (FROM: @IMP-SYS-STORE-017@)
  // PR-review Nit #3: leading-zero numeric pre-release identifiers (`01`) and
  // empty identifiers (`foo..bar`) are SemVer §9-invalid — reject so the
  // comparator can never conflate `01`↔`1` or mis-order an empty segment.
  it('rejects a minSafeVersion with a leading-zero or empty pre-release identifier', async () => {
    const leadingZero = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse({ minSafeVersion: '0.4.0-01' }))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl: leadingZero })).toBeNull()
    const emptyId = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse({ minSafeVersion: '0.4.0-foo..bar' }))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl: emptyId })).toBeNull()
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

  // @UT-SYS-STORE-092@ (FROM: @IMP-SYS-STORE-017@)
  // PR-review Minor #4: a present-but-malformed Content-Length must REJECT,
  // not silently fall through to read an unbounded body. `Number('abc')` is
  // NaN, which the prior `Number.isFinite(len) && len > cap` test skipped.
  // Content-Length per RFC 9110 is a bare decimal; anything else is malformed
  // and must reject before the body is read (so a hostile size can't OOM).
  it.each(['not-a-number', '0x10', '', '42, 42'])(
    'returns null on a non-decimal Content-Length %j without reading the body',
    async (contentLength) => {
      const textSpy = vi.fn<() => Promise<string>>(async () => JSON.stringify({ minSafeVersion: '0.5.0' }))
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-length' ? contentLength : null),
        },
        text: textSpy,
      } as unknown as Response)

      expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
      expect(textSpy).not.toHaveBeenCalled()
    },
  )

  // @UT-SYS-STORE-093@ (FROM: @IMP-SYS-STORE-017@)
  // PR-review Minor #3: the post-read cap measures UTF-8 BYTES, not UTF-16
  // code units, so a body of multi-byte codepoints under the code-unit count
  // but over the byte cap is still rejected.
  it('rejects a body whose UTF-8 byte length exceeds the cap even when its code-unit count would not', async () => {
    // 2000 emoji: ~4000 UTF-16 code units (< 4096) but ~8000 UTF-8 bytes (> 4096).
    const oversizedByBytes = '😀'.repeat(2_000)
    expect(oversizedByBytes.length).toBeLessThan(4_096) // code-unit count slips under the old guard
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse(oversizedByBytes))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
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

  // @UT-SYS-STORE-088@ (FROM: @IMP-SYS-STORE-017@)
  // PR-review Minor #5: even WITH AbortController present, a fetch impl that
  // ignores the AbortSignal and never settles must still time out via the
  // wall-clock race — the abort alone cannot rescue it.
  it('times out via the wall-clock race when AbortController is present but the fetch ignores the signal', async () => {
    expect(typeof AbortController).toBe('function') // default jsdom — not dropped here

    let capturedSignal: AbortSignal | undefined
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined
      return new Promise<Response>(() => undefined as unknown as void) // never settles, ignores signal
    })

    const start = Date.now()
    const out = await fetchRemoteMinSafeVersion({ fetchImpl, timeoutMs: 30 })
    const elapsed = Date.now() - start

    expect(out).toBeNull()
    expect(elapsed).toBeLessThan(500)
    // Review-iteration: the timeout must also ABORT the in-flight request, so a
    // signal-honouring fetch is cancelled rather than left running detached.
    expect(capturedSignal?.aborted).toBe(true)
  })
})
