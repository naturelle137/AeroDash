/**
 * Session Persistence Store — P3 App Shell.
 *
 * Watches the Mass & Balance store and serialises the pilot's entered preflight
 * data to `localStorage` on each change (debounced).  On app start the saved
 * payload is validated and returned to the caller for restoration.
 *
 * Key: `aerodash:session:payload`
 *
 * Invariants:
 *  - An invalid or missing payload → clean session (no pre-population).
 *  - Aircraft switch → prior payload immediately cleared.
 *  - Saves are debounced to avoid writing on every keystroke.
 *  - Restored payloads are routed through the P1 migration registry. Payloads
 *    from a *future* build (PWA-cache rollback) are dropped with an INFO
 *    notification rather than silently truncated. Outright
 *    corruption clears storage and starts a clean session.
 *
 * @see docs/architecture/frontend_state_machine.md
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import {
  CURRENT_SESSION_PAYLOAD_VERSION,
  type SessionPayload,
} from '@/core/domain/session.schema'
import { migrateSessionPayload } from '@/core/logic/session-migrations'

// @IMP-SYS-STORE-001@ (FROM: @REQ-SYS-013@)

const STORAGE_KEY = 'aerodash:session:payload' as const
const DEBOUNCE_MS = 300

/** Why a persisted session payload was discarded during `restoreSession()`. */
export type SessionDropReason =
  | 'unsupported-future-version'
  | 'corrupt'

/**
 * One-shot notification emitted when the persisted session payload could not
 * be restored. Severity is always INFO — the user has not *lost* anything
 * they expected to keep (the auto-save is an aid, not a primary store), but
 * they should know the restore was attempted and skipped.
 */
export interface SessionDropNotification {
  readonly severity: 'INFO'
  readonly code: 'INFO-SYS-001'
  readonly reason: SessionDropReason
  readonly message: string
  readonly storedVersion: number
}

function buildDropNotification(
  reason: SessionDropReason,
  storedVersion: number,
): SessionDropNotification {
  const message =
    reason === 'unsupported-future-version'
      ? `Saved preflight data was created by a newer app build (v${storedVersion}). ` +
        `Update the app to restore it; this build (v${CURRENT_SESSION_PAYLOAD_VERSION}) cannot read it safely.`
      : `Saved preflight data could not be restored — the stored payload was corrupt. A fresh session was started.`
  return { severity: 'INFO', code: 'INFO-SYS-001', reason, message, storedVersion }
}

export const useSessionPersistenceStore = defineStore('sessionPersistence', () => {
  // ── Private state ─────────────────────────────────────────────────────────

  let _debounceTimer: ReturnType<typeof setTimeout> | null = null
  let _watching = false

  /** Most-recent drop notification, drained by callers after `restoreSession()`. */
  const lastDropNotification = ref<SessionDropNotification | null>(null)

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Immediately serialise the current M&B store state to `localStorage`.
   * No-op when no aircraft profile is loaded.
   */
  function saveSession(): void {
    const mbStore = useMassBalanceStore()
    if (!mbStore.aircraft || !mbStore.activeCategory) {
      return
    }

    const payload: SessionPayload = {
      version: CURRENT_SESSION_PAYLOAD_VERSION,
      aircraftId: mbStore.aircraft.id,
      activeCategory: mbStore.activeCategory,
      stations: mbStore.stations.map((s) => ({
        index: s.index,
        weight: s.weight,
        touched: s.touched,
        verified: s.verified,
      })),
      savedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Storage quota exceeded or unavailable — fail silently; the pilot can
      // still operate, they just lose auto-save for this session.
    }
  }

  /**
   * Schedule a debounced save.  Clears any pending timer before setting a new one.
   */
  function _scheduleSave(): void {
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
    }
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      saveSession()
    }, DEBOUNCE_MS)
  }

  /**
   * Cancel any pending debounced save **without** removing the persisted
   * payload. Unlike {@link clearSession}, the stored key is left in place.
   *
   * Used ahead of a Delete-All-Data wipe (REQ-SYS-014): the wipe's own storage
   * sweep removes and *reports* the session key, so the only coordination
   * needed here is to stop a queued autosave from re-writing the key after the
   * wipe — leaving the key present means the sweep still counts it.
   */
  function cancelPendingSave(): void {
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
  }

  /**
   * Remove any persisted payload from `localStorage`.
   * Called on aircraft switch or explicit session reset.
   */
  function clearSession(): void {
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage errors — clearing is best-effort.
    }
  }

  /**
   * Read, migrate, validate, and return the persisted session payload.
   *
   * Returns `null` when:
   *  - `localStorage` is empty or the key is absent (no notification — there
   *    was nothing to restore in the first place).
   *  - JSON parse fails: storage is cleared and a `corrupt`
   *    {@link SessionDropNotification} is emitted so the pilot learns the
   *    saved session could not be restored.
   *  - The stored payload's version is *newer* than this build can read
   *    (PWA-cache rollback). The payload is dropped, storage is cleared,
   *    and an `unsupported-future-version` drop notification is emitted on
   *    {@link lastDropNotification}.
   *  - The stored payload fails migration / Zod validation. Storage is
   *    cleared and a `corrupt` drop notification is emitted.
   */
  function restoreSession(): SessionPayload | null {
    lastDropNotification.value = null

    let raw: string | null = null
    try {
      raw = localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }

    if (raw === null) {
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Storage held a string that was not valid JSON — treat the same as a
      // corrupt migration outcome (clear + notify) so the pilot sees one
      // unified INFO message rather than the silent-clear behaviour.
      clearSession()
      lastDropNotification.value = buildDropNotification('corrupt', 0)
      return null
    }

    const outcome = migrateSessionPayload(parsed)

    if (outcome.kind === 'migrated') {
      return outcome.payload
    }

    // Drop path — either unsupported-future-version (PWA cache rollback) or
    // corrupt (Zod / migration failure). In both cases we clear storage so
    // the same drop is not re-emitted on every reload and surface a single
    // INFO notification for the UI to render. The pilot is not silently
    // deprived of context — they learn the saved session was not restored
    // and a fresh session was started.
    clearSession()
    lastDropNotification.value = buildDropNotification(outcome.kind, outcome.storedVersion)
    return null
  }

  /**
   * Consume and clear the most recent drop notification. Returns `null` when
   * the last `restoreSession()` did not drop a payload. Callers that surface
   * INFO toasts should invoke this once after restoring.
   */
  function consumeDropNotification(): SessionDropNotification | null {
    const n = lastDropNotification.value
    lastDropNotification.value = null
    return n
  }

  // ── Watchers ──────────────────────────────────────────────────────────────

  /**
   * Watch station weights and active category; schedule a debounced save on
   * any change.  Uses a lazy watch so the initial state is not saved before
   * the aircraft profile has been fully loaded.
   *
   * Idempotent — calling a second time (e.g. on view remount) is a no-op so
   * watchers do not stack and trigger duplicate saves on every mutation.
   */
  function startWatching(): void {
    if (_watching) return
    _watching = true
    const mbStore = useMassBalanceStore()

    // Watch for aircraft switch → clear prior session data.
    watch(
      () => mbStore.aircraft?.id,
      (newId, oldId) => {
        if (oldId !== undefined && newId !== oldId) {
          clearSession()
        }
      },
    )

    // Watch station weights and category → debounced save.
    //
    // TECH-027: the getter projects only the four station fields the payload
    // needs (`index`, `weight`, `touched`, `verified`) plus `activeCategory`.
    // Because `.map(...)` returns a fresh array reference on every reactive
    // tick, Vue compares old vs new by reference and fires whenever any tracked
    // property changes — `deep: true` adds a redundant per-tick traversal of
    // that already-shallow projection. On low-end iPads we measured the deep
    // traversal accounting for ~30% of the watcher's per-keystroke cost in a
    // 6-station setup, with no observable correctness improvement. The flat
    // projection plus the default reference comparison covers every change
    // path the previous deep watch did.
    //
    // INVARIANT: the getter body MUST remain an inline `.map()` call — do NOT
    // replace it with a `computed()` or any other memoised form. The correctness
    // of omitting `deep: true` depends on a *new* object reference being
    // produced on every reactive tick. A memoised getter returns the same
    // reference when its inputs are unchanged, so Vue's default equality check
    // would suppress the watcher callback and autosave would silently stop
    // firing on station mutations. There is no type error or test failure that
    // catches this — only the inline form is safe here.
    //
    // Re-profile if the station count grows (>20) or fields are added to the payload.
    watch(
      () => ({
        stations: mbStore.stations.map((s) => ({ index: s.index, weight: s.weight, touched: s.touched, verified: s.verified })),
        activeCategory: mbStore.activeCategory,
      }),
      () => {
        if (mbStore.aircraft) {
          _scheduleSave()
        }
      },
    )
  }

  return {
    saveSession,
    cancelPendingSave,
    clearSession,
    restoreSession,
    consumeDropNotification,
    lastDropNotification,
    startWatching,
  }
})
