/**
 * App Version Store — P3 App Shell.
 * Exposes current version, build date, and minimum safe version enforcement.
 *
 * ## REQ-SYS-006 Implementation Note — Build-Time Constant (Pre-v1.0 Limitation)
 *
 * `minSafeVersion` is currently set at **build time** via the `__MIN_SAFE_VERSION__`
 * Vite define constant (see `vite.config.ts`). This means the minimum required version
 * is baked into each released bundle and cannot be updated without a new deployment.
 *
 * **Accepted limitation for pre-v1.0 milestones.** The correct long-term implementation
 * (required before v1.0.0 GA) is to fetch the minimum version from a remote endpoint
 * (e.g. `GET /version.json` served from the PWA public directory or a CDN edge config),
 * so that operators can enforce a minimum version without requiring the user to have
 * downloaded a new bundle first.
 *
 * TODO(REQ-SYS-006, pre-v1.0): Replace build-time constant with a remote fetch:
 *   const res = await fetch('/version.json')
 *   const { minSafeVersion } = await res.json()
 * Track: GitHub issue #162 (offline-first DoD) and related ADR-008.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

// @IMP-SYS-STORE-006@ (FROM: @REQ-SYS-006@, @REQ-UI-013@)
export const useAppVersionStore = defineStore('appVersion', () => {
  const currentVersion = ref(__APP_VERSION__)
  const buildDate = ref(__BUILD_DATE__)
  /**
   * Minimum safe version for this build.
   * Currently a build-time constant — see module JSDoc for the planned remote-fetch upgrade path.
   */
  const minSafeVersion = ref(__MIN_SAFE_VERSION__)
  const versionBlocked = ref(false)

  // @IMP-SYS-STORE-007@ (FROM: @REQ-SYS-006@)
  function isVersionBelow(current: string, minimum: string): boolean {
    const parse = (v: string) => v.replace(/-.*$/, '').split('.').map(Number) as [number, number, number]
    const [cMaj, cMin, cPat] = parse(current)
    const [mMaj, mMin, mPat] = parse(minimum)
    if (cMaj !== mMaj) return cMaj < mMaj
    if (cMin !== mMin) return cMin < mMin
    return cPat < mPat
  }

  // @IMP-SYS-STORE-008@ (FROM: @REQ-SYS-006@)
  async function checkMinSafeVersion(): Promise<void> {
    if (!navigator.onLine) return
    if (isVersionBelow(currentVersion.value, minSafeVersion.value)) {
      versionBlocked.value = true
    }
  }

  return { currentVersion, buildDate, minSafeVersion, versionBlocked, checkMinSafeVersion, isVersionBelow }
})
