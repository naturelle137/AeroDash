/**
 * PWA Update Store — P3 App Shell.
 * Detects Service Worker updates and exposes update state to the UI.
 * Ensures INFO-SYS-001 notification is emitted when an update is available.
 * Silent auto-update is FORBIDDEN (REQ-SYS-005).
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

// @IMP-SYS-STORE-002@ (FROM: @REQ-SYS-005@)
export const usePwaUpdateStore = defineStore('pwaUpdate', () => {
  const needsUpdate = ref(false)
  const offlineReady = ref(false)
  let _updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null

  // @IMP-SYS-STORE-003@ (FROM: @REQ-SYS-001@, @REQ-SYS-002@)
  function onOfflineReady(): void {
    offlineReady.value = true
  }

  // @IMP-SYS-STORE-004@ (FROM: @REQ-SYS-005@)
  function onNeedsRefresh(): void {
    needsUpdate.value = true
    // INFO-SYS-001: caller/composable must emit notification
  }

  // @IMP-SYS-STORE-005@ (FROM: @REQ-SYS-005@)
  function setUpdateSW(fn: (reloadPage?: boolean) => Promise<void>): void {
    _updateSW = fn
  }

  // @IMP-SYS-STORE-009@ (FROM: @REQ-SYS-005@)
  async function applyUpdate(): Promise<void> {
    if (_updateSW) {
      await _updateSW(true)
    } else {
      window.location.reload()
    }
  }

  return { needsUpdate, offlineReady, onOfflineReady, onNeedsRefresh, setUpdateSW, applyUpdate }
})
