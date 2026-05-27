/**
 * Application bootstrap.
 *
 * ## PWA Update Safety Rationale (REQ-SYS-005 / H-019)
 *
 * H-019 identifies the hazard of swapping calculation logic (M&B, Performance,
 * Fuel/Endurance) while a pilot has an active computation in progress. To
 * mitigate this, REQ-SYS-005 requires explicit user consent before applying any
 * Service Worker update during an active session — hence the "Reload to update"
 * banner in App.vue.
 *
 * However, a **cold start** (fresh browser tab with no prior session state)
 * carries no such risk: there is no in-flight calculation that could be
 * invalidated. We therefore classify each SW `onNeedRefresh` event:
 *
 * - `wasActiveSession === false` (cold start): apply silently via
 *   `pwaStore.applyColdStartUpdate()`. H-019 is NOT triggered; no banner shown.
 * - `wasActiveSession === true` (in-session): show the banner via
 *   `pwaStore.onNeedsRefresh()`. H-019 mitigation in force; pilot must consent.
 *
 * Classification uses `sessionStorage['aerodash.session.active']`:
 * - `sessionStorage` is scoped to the browser tab and is cleared when the last
 *   tab for an origin is closed, which precisely matches the cold-start
 *   definition.
 * - The key is written immediately at bootstrap, so any subsequent
 *   `onNeedRefresh` within the same tab sees `wasActiveSession === true`.
 * - If `sessionStorage` is unavailable (Safari private mode, iframe sandbox),
 *   we fail-safe to the in-session path (banner shown), preserving H-019.
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/theme.css'
import App from './App.vue'
import router from './router'
import { createLogger } from './shared/utils/logger'

// @IMP-SYS-APP-002@ (FROM: @REQ-SYS-001@, @REQ-SYS-005@)
import { registerSW } from 'virtual:pwa-register'
import { usePwaUpdateStore } from './stores/pwa-update.store'

const logger = createLogger('App')

// ---------------------------------------------------------------------------
// Cold-start classifier — must run before registerSW so the captured value
// reflects the state at navigation time, not at SW callback time.
// ---------------------------------------------------------------------------
const SESSION_KEY = 'aerodash.session.active'

export interface SessionCaptureResult {
  /** `true` when a session was already active in this tab (in-session path);
   * `false` on a cold start. */
  wasActiveSession: boolean
  /** `false` when `sessionStorage` threw (Safari private mode, sandboxed
   * iframe, storage disabled). Issue #263 — surfaces a one-time pilot
   * advisory so cold-start silent updates are not silently downgraded to
   * the in-session banner path without explanation. */
  sessionStorageAvailable: boolean
}

/**
 * Reads the sessionStorage flag and immediately sets it for this tab lifetime.
 * Returns the classifier result plus a `sessionStorageAvailable` signal so
 * the caller can surface a WARN telemetry entry + one-time pilot advisory
 * when the storage backend is unreachable (DP-004 / CS-012, issue #263).
 *
 * A browser refresh preserves sessionStorage but is still effectively a fresh
 * page load — the pilot explicitly asked for a reload. We therefore also treat
 * any navigation of `PerformanceNavigationTiming.type === 'reload'` as a cold
 * start, so a refresh applies the pending update silently instead of surfacing
 * the banner again.
 *
 * If sessionStorage is unavailable, fail-safe to the in-session path
 * (`wasActiveSession: true`) so REQ-SYS-005 / H-019 mitigation holds, and
 * report `sessionStorageAvailable: false` so the caller can advise the pilot.
 */
export function captureAndMarkSession(): SessionCaptureResult {
  try {
    const wasActive = sessionStorage.getItem(SESSION_KEY) === '1'
    sessionStorage.setItem(SESSION_KEY, '1')
    if (wasActive && isBrowserReload()) {
      // Treat a browser refresh as a cold start — pilot asked for a reload,
      // so the newest build should load without an extra banner step.
      return { wasActiveSession: false, sessionStorageAvailable: true }
    }
    return { wasActiveSession: wasActive, sessionStorageAvailable: true }
  } catch {
    // sessionStorage unavailable (e.g. Safari private mode, sandboxed iframe).
    // Fail-safe to the in-session path so REQ-SYS-005 / H-019 mitigation holds.
    return { wasActiveSession: true, sessionStorageAvailable: false }
  }
}

/** Detect whether the current navigation is a browser reload (back/refresh). */
function isBrowserReload(): boolean {
  try {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    return entries[0]?.type === 'reload'
  } catch {
    return false
  }
}

/**
 * Builds the `onNeedRefresh` handler for registerSW.
 * Extracted as a named factory to make it independently unit-testable.
 *
 * @param store - the active pwaUpdateStore instance
 * @param wasActiveSession - result of `captureAndMarkSession()` at bootstrap
 */
export function createUpdateHandler(
  store: ReturnType<typeof usePwaUpdateStore>,
  { wasActiveSession }: { wasActiveSession: boolean },
): () => void {
  return function onNeedRefresh(): void {
    if (wasActiveSession) {
      // In-session path: pilot may have an active calculation — show banner.
      store.onNeedsRefresh()
      logger.info('PWA update available — user consent required (INFO-SYS-001, REQ-SYS-005)')
    } else {
      // Cold-start path: no session state to protect — apply silently.
      logger.info('PWA cold-start update applied silently (H-019 not triggered)')
      void store.applyColdStartUpdate()
    }
  }
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------
const { wasActiveSession, sessionStorageAvailable } = captureAndMarkSession()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.config.errorHandler = (err) => {
  // Issue #263 (DP-004 / CS-012) — Vue runtime error messages can interpolate
  // template-bound pilot input (e.g. an M&B form crash echoes the entered tail
  // number). We surface only the error constructor name (`TypeError`,
  // `RangeError`, …), which is allow-listed and safe; the message itself is
  // omitted so the redactor cannot leak interpolated PII through `[REDACTED]`
  // gaps.
  const errorName = err instanceof Error ? err.name : 'NonErrorThrowable'
  const errorType = err === null ? 'null' : typeof err
  logger.error('Unhandled error', { errorName, errorType })
}

app.mount('#app')

// Register Service Worker after mount — must not block initial render.
// registerType: 'prompt' is enforced in vite.config.ts (REQ-SYS-005).
const pwaStore = usePwaUpdateStore()

// Issue #263 (DP-004 / CS-012) — when sessionStorage is unreachable, log a
// WARN telemetry entry and raise a one-time pilot advisory. The classifier
// already fails-safe to the in-session banner path; without this signal the
// pilot has no way to learn that cold-start silent updates have been
// downgraded for the remainder of the tab lifetime.
if (!sessionStorageAvailable) {
  logger.warn('sessionStorage unavailable; PWA update consent forced in-session', {
    code: 'SESSION_STORAGE_UNAVAILABLE',
    fallbackPath: 'in-session',
    advisoryReason: 'storage-throw',
  })
  pwaStore.raiseSessionStorageAdvisory()
}

const updateSW = registerSW({
  onOfflineReady() {
    pwaStore.onOfflineReady()
    logger.info('PWA offline ready — app shell cached')
  },
  onNeedRefresh: createUpdateHandler(pwaStore, { wasActiveSession }),
  onRegisteredSW(swUrl, registration) {
    logger.info('Service Worker registered', { swUrl, scope: registration?.scope })
  },
  onRegisterError(error: unknown) {
    // Surface only the constructor name; a serialized DOMException / SW error
    // message can include the SW URL plus internal browser detail. Matches
    // the discipline applied to the global Vue errorHandler above.
    const errorName = error instanceof Error ? error.name : 'NonErrorThrowable'
    const errorType = error === null ? 'null' : typeof error
    logger.error('Service Worker registration failed', { errorName, errorType })
  },
})

// Expose the updateSW callback so the store can trigger reload with consent.
pwaStore.setUpdateSW(updateSW)
