/**
 * Deployment-consistency guard — REQ-SYS-006 / H-019 (issue #271).
 *
 * PR-review Blocker B1: the shipped `/version.json` must never declare a
 * `minSafeVersion` ABOVE the deployed application version. If it did, the
 * first online cold start of the freshly-deployed bundle would compute
 * `effectiveMin = remoteValue > currentVersion`, block the user, and — because
 * the offline cache then locks that floor in — every subsequent OFFLINE start
 * would block too: a self-perpetuating brick of exactly the gate this feature
 * adds.
 *
 * This guard is fixture-driven (reads the committed deploy artifacts) so a
 * future floor bump that outruns the app version fails CI instead of bricking
 * the cockpit. The integration test mocks the remote and cannot catch this.
 */

// @UT-SYS-STORE-084@ (FROM: @IMP-SYS-STORE-017@)
// @UT-SYS-STORE-085@ (FROM: @IMP-SYS-STORE-017@)

import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { describe, it, expect } from 'vitest'

import { isValidSemVer, isVersionBelow } from '@/stores/app-version.semver'

function readJson(relativeToThisFile: string): Record<string, unknown> {
  const path = fileURLToPath(new URL(relativeToThisFile, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
}

const versionManifest = readJson('../../../public/version.json')
const pkg = readJson('../../../package.json')

const shippedMinSafeVersion = String(versionManifest.minSafeVersion)
const appVersion = String(pkg.version)

describe('deployment guard — shipped /version.json vs app version (PR-review Blocker B1)', () => {
  // @UT-SYS-STORE-084@ (FROM: @IMP-SYS-STORE-017@)
  it('ships a structurally valid minSafeVersion in /version.json', () => {
    expect(isValidSemVer(shippedMinSafeVersion)).toBe(true)
  })

  // @UT-SYS-STORE-085@ (FROM: @IMP-SYS-STORE-017@)
  it('does not declare a floor above the deployed app version (no self-brick)', () => {
    // The running build must NOT be below the floor its own deployment ships,
    // or every online user is kill-switched on day one.
    expect(isValidSemVer(appVersion)).toBe(true)
    expect(isVersionBelow(appVersion, shippedMinSafeVersion)).toBe(false)
  })
})
