/**
 * App Version Store — P3 App Shell.
 * Exposes current version, build date, and minimum safe version enforcement.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

// @IMP-SYS-STORE-006@ (FROM: @REQ-SYS-006@, @REQ-UI-013@)
export const useAppVersionStore = defineStore('appVersion', () => {
  const currentVersion = ref(__APP_VERSION__)
  const buildDate = ref(__BUILD_DATE__)
  const minSafeVersion = ref(__MIN_SAFE_VERSION__)
  const versionBlocked = ref(false)

  // @IMP-SYS-STORE-007@ (FROM: @REQ-SYS-006@)
  function isVersionBelow(current: string, minimum: string): boolean {
    const parse = (v: string) => v.split('.').map(Number) as [number, number, number]
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
