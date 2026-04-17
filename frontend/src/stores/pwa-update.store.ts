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
  /**
   * Called by the Service Worker registration when a new version is available.
   * Sets `needsUpdate = true`, which causes `App.vue` to render the PWA update
   * banner (REQ-SYS-005, INFO-SYS-001).
   *
   * ## INFO-SYS-001 — Notification Strategy
   * The direct banner rendered by `App.vue` (`v-if="pwaStore.needsUpdate"`) IS the
   * INFO-SYS-001 notification for this specific case. This is an intentional
   * architectural exception: the PWA update banner must be rendered at the app-shell
   * level (above the router view) so it remains visible on every page, which cannot be
   * achieved via the centralized `useNotificationStore` bus without bypassing the store
   * routing layer. This decision is documented in ADR-007 (PWA update lifecycle).
   * See also REQ-SYS-007 and REQ-SYS-008 for the general notification requirements.
   */
  function onNeedsRefresh(): void {
    needsUpdate.value = true
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
