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

import { describe, it, expect, vi } from 'vitest'

import {
  fetchRemoteMinSafeVersion,
  DEFAULT_VERSION_ENDPOINT,
} from '../app-version.remote'

function mockJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
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
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse('', false, 404))
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
  it('returns null when the response body is suspiciously large', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse('x'.repeat(5_000)))
    expect(await fetchRemoteMinSafeVersion({ fetchImpl })).toBeNull()
  })
})
