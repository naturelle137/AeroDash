/**
 * Deployment-consistency guard — REQ-SYS-006 / H-019 (issue #271).
 *
 * PR-review Blocker B1 (+ review-iteration hardening): a freshly-deployed
 * bundle must never block itself. TWO floors feed the gate at runtime — the
 * build-time constant `__MIN_SAFE_VERSION__` and the operator-overridable
 * `/version.json` remote floor — and both are compared against the running app
 * version `__APP_VERSION__`. If either floor sits above the app version, the
 * first online cold start computes `effectiveMin > currentVersion`, blocks, and
 * the offline cache then locks that floor in: a self-perpetuating brick of
 * exactly the gate this feature adds.
 *
 * This guard reads what the runtime actually compares — the Vite build-time
 * defines as the bundle sees them, plus the committed `/version.json` fixture —
 * so a future floor bump that outruns the app version fails CI instead of
 * bricking the cockpit. (Checking only `package.json` would miss a
 * `__MIN_SAFE_VERSION__` bump, since that define is set independently in
 * `vite.config.ts`.) The integration test mocks the remote and cannot catch this.
 */

// @UT-SYS-STORE-084@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-085@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-095@ (FROM: @IMP-SYS-STORE-020@)

import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { describe, it, expect } from 'vitest'

import { isValidSemVer, isVersionBelow } from '@/stores/app-version.semver'

function readJson(relativeToThisFile: string): Record<string, unknown> {
  const path = fileURLToPath(new URL(relativeToThisFile, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
}

const versionManifest = readJson('../../../public/version.json')
const shippedMinSafeVersion = String(versionManifest.minSafeVersion)

describe('deployment guard — runtime floors vs app version (PR-review Blocker B1)', () => {
  // @UT-SYS-STORE-084@ (FROM: @IMP-SYS-STORE-017@)
  it('ships structurally valid floors and app version', () => {
    expect(isValidSemVer(shippedMinSafeVersion)).toBe(true) // /version.json remote floor
    expect(isValidSemVer(__MIN_SAFE_VERSION__)).toBe(true) // build-time floor
    expect(isValidSemVer(__APP_VERSION__)).toBe(true) // running version
  })

  // @UT-SYS-STORE-085@ (FROM: @IMP-SYS-STORE-017@)
  it('the shipped /version.json floor is not above the deployed app version (no remote self-brick)', () => {
    expect(isVersionBelow(__APP_VERSION__, shippedMinSafeVersion)).toBe(false)
  })

  // @UT-SYS-STORE-095@ (FROM: @IMP-SYS-STORE-020@)
  it('the build-time __MIN_SAFE_VERSION__ floor is not above the deployed app version (no build-time self-brick)', () => {
    expect(isVersionBelow(__APP_VERSION__, __MIN_SAFE_VERSION__)).toBe(false)
  })
})
