/**
 * PWA Update Store — P3 App Shell.
 * Detects Service Worker updates and exposes update state to the UI.
 * Ensures INFO-SYS-001 notification is emitted when an update is available.
 *
 * ## Silent-update exception (REQ-SYS-005 / H-019)
 * REQ-SYS-005 forbids silently swapping calculation logic while a session is
 * active, because in-flight M&B / Performance calculations could be invalidated
 * by the update. That hazard does NOT exist on a cold start (fresh tab with no
 * prior calculation state). Cold-start silent updates are therefore handled by
 * `applyColdStartUpdate()` and are explicitly exempt from the banner path.
 * See ADR-007 §Cold-start silent update exception.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

// @IMP-SYS-STORE-002@ (FROM: @REQ-SYS-005@)
export const usePwaUpdateStore = defineStore('pwaUpdate', () => {
  const needsUpdate = ref(false)
  const offlineReady = ref(false)
  /**
   * Issue #263 (DP-004 / CS-012). When sessionStorage is unreachable at
   * bootstrap (Safari private mode, sandboxed iframe, storage disabled),
   * the in-tab session classifier fails-safe to the in-session banner path
   * for every subsequent SW update notice. That degradation has no
   * pilot-visible explanation; this flag drives a one-time advisory in
   * `App.vue` so the pilot knows the silent cold-start path is unavailable
   * until storage is restored. Raised exactly once per tab lifetime and
   * dismissible via `dismissSessionStorageAdvisory()`.
   */
  const sessionStorageAdvisory = ref(false)
  let _updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null

  // @IMP-SYS-STORE-003@ (FROM: @REQ-SYS-001@, @REQ-SYS-002@)
  function onOfflineReady(): void {
    offlineReady.value = true
  }

  // @IMP-SYS-STORE-004@ (FROM: @REQ-SYS-005@)
  /**
   * Called by the Service Worker registration when a new version is available
   * AND a prior session was already active in this browser tab lineage
   * (in-session update path). Sets `needsUpdate = true`, which causes `App.vue`
   * to render the PWA update banner (REQ-SYS-005, INFO-SYS-001).
   *
   * ## INFO-SYS-001 — Notification Strategy
   * The direct banner rendered by `App.vue` (`v-if="pwaStore.needsUpdate"`) IS
   * the INFO-SYS-001 notification for this specific case. This is an intentional
   * architectural exception: the PWA update banner must be rendered at the
   * app-shell level (above the router view) so it remains visible on every page,
   * which cannot be achieved via the centralized `useNotificationStore` bus
   * without bypassing the store routing layer. This decision is documented in
   * ADR-007 (PWA update lifecycle).
   * See also REQ-SYS-007 and REQ-SYS-008 for the general notification
   * requirements.
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

  // @IMP-SYS-STORE-010@ (FROM: @REQ-SYS-005@)
  /**
   * Called on cold-start when the Service Worker reports a new version AND no
   * prior session was active in the current browser tab lineage. Applies the
   * update silently without user consent, because no in-flight calculation can
   * be invalidated by the swap (REQ-SYS-005 / H-019 mitigation only applies to
   * the in-session case). See ADR-007 §Cold-start silent update exception.
   */
  async function applyColdStartUpdate(): Promise<void> {
    if (_updateSW) {
      await _updateSW(true)
    } else {
      window.location.reload()
    }
  }

  // @IMP-SYS-STORE-011@ (FROM: @REQ-SYS-005@)
  /**
   * Issue #263 (DP-004 / CS-012). Idempotent — repeated calls leave the
   * advisory raised exactly once. The caller in `main.ts` invokes this
   * after a sessionStorage exception so `App.vue` can render the one-time
   * pilot-facing banner.
   */
  function raiseSessionStorageAdvisory(): void {
    sessionStorageAdvisory.value = true
  }

  // @IMP-SYS-STORE-012@ (FROM: @REQ-SYS-005@)
  function dismissSessionStorageAdvisory(): void {
    sessionStorageAdvisory.value = false
  }

  return {
    needsUpdate,
    offlineReady,
    sessionStorageAdvisory,
    onOfflineReady,
    onNeedsRefresh,
    setUpdateSW,
    applyUpdate,
    applyColdStartUpdate,
    raiseSessionStorageAdvisory,
    dismissSessionStorageAdvisory,
  }
})
