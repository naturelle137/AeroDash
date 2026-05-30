/**
 * Disclaimer Acknowledgement Store — P3 App Shell.
 *
 * Implements REQ-SYS-016 (in-app first-launch disclaimer acknowledgement gate)
 * — closes process audit finding PR-016 for v0.4.0-alpha.
 *
 * ## What this store gates
 *
 * Until the pilot has explicitly accepted the in-app disclaimer for the
 * *current disclaimer baseline*, the safety-critical surfaces (Mass & Balance,
 * Performance, Fuel & Endurance) must not be reachable. App.vue reads
 * `gateOpen` and renders a blocking acknowledgement modal that occludes the
 * entire app shell — there is no opt-out, no Cancel, and no Escape: the only
 * way through is the explicit "I understand" action wired to {@link acknowledge}.
 *
 * ## Disclaimer baseline (re-prompt semantics)
 *
 * The pilot's acceptance is recorded against a *disclaimer baseline*, not the
 * raw build version, so a patch / minor release does not nag the pilot every
 * launch. The baseline is derived from the running build's SemVer as
 * `MAJOR.MINOR` (e.g. `0.3` for `0.3.0-alpha`, `0.4` for `0.4.0`). Re-prompt
 * fires whenever the stored `acceptedBaseline` differs from the currently
 * computed one — pre-v1.0 the MINOR component is the de-facto "breaking
 * change" identifier (each milestone is a deliberate scope step), and the
 * v0.4.0-alpha milestone is the trigger that originally surfaced PR-016.
 * After v1.0 the baseline can be tightened to `MAJOR` only; doing so now
 * would silently under-prompt the entire 0.x line, which is the audit risk
 * we are closing here.
 *
 * If the build version is not parseable as SemVer (a structurally-broken
 * bundle), we fail closed — `gateOpen` stays true and the pilot is
 * re-prompted on every launch. A pilot agreeing once on every launch is a
 * UX annoyance; silently letting an unidentified build through is the audit
 * gap.
 *
 * ## Persistence
 *
 * Acceptance is stored in `localStorage` under {@link STORAGE_KEY}. The
 * stored payload is a versioned envelope (`schemaVersion: 1`) so a future
 * migration can be added without losing existing acceptances. If
 * `localStorage` is unreachable (Safari private mode, sandboxed iframe,
 * disabled by enterprise policy) the store fails safe — every launch
 * re-prompts. This is the correct posture: the disclaimer is a liability
 * boundary, and an unobservable acceptance is no acceptance.
 *
 * ## Lifecycle
 *
 * - `loadFromStorage()` runs once on app mount (App.vue `onMounted`) and
 *   sets `gateOpen` accordingly. Until it runs, `gateOpen` is `true` by
 *   default so the SSR / first-paint window cannot leak the safety-critical
 *   surfaces.
 * - `acknowledge()` writes the current baseline + version + timestamp to
 *   storage and flips `gateOpen` to `false`.
 * - `resetForTesting()` is the only public reset path; it is intentionally
 *   *not* exposed via the app UI — a pilot deliberately re-prompting can
 *   clear browser data instead, which is what the audit expects.
 */

// @IMP-SYS-STORE-022@ (FROM: @REQ-SYS-016@)

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createLogger } from '@/shared/utils/logger'
import { isValidSemVer, parseSemVer } from '@/stores/app-version.semver'

const logger = createLogger('DisclaimerAcknowledgement')

/** localStorage key for the persisted acknowledgement envelope. */
export const STORAGE_KEY = 'aerodash.disclaimer.ack.v1'

/** Persisted envelope schema. Bumping the schema version requires a migration. */
const SCHEMA_VERSION = 1 as const

/** Shape of the persisted acknowledgement record. */
export interface AcknowledgementRecord {
  readonly schemaVersion: typeof SCHEMA_VERSION
  /** Full SemVer string of the build at acceptance time (diagnostics only). */
  readonly acceptedVersion: string
  /** `MAJOR.MINOR` baseline against which acceptance is keyed. */
  readonly acceptedBaseline: string
  /** Epoch ms of acceptance. */
  readonly acceptedAt: number
}

/**
 * Compute the disclaimer baseline for a SemVer string.
 *
 * Returns `null` for any input that does not parse as a valid SemVer; the
 * caller treats `null` as "fail closed — re-prompt".
 */
export function computeDisclaimerBaseline(version: unknown): string | null {
  if (!isValidSemVer(version)) return null
  try {
    const parts = parseSemVer(version)
    return `${parts.major}.${parts.minor}`
  } catch {
    return null
  }
}

/** Safe JSON.parse — returns `null` on any throw or non-object payload. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Structural guard for the persisted envelope. */
function isAcknowledgementRecord(value: unknown): value is AcknowledgementRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.schemaVersion === SCHEMA_VERSION &&
    typeof v.acceptedVersion === 'string' &&
    typeof v.acceptedBaseline === 'string' &&
    typeof v.acceptedAt === 'number' &&
    Number.isFinite(v.acceptedAt)
  )
}

export const useDisclaimerAcknowledgementStore = defineStore('disclaimerAcknowledgement', () => {
  /** Full version string of the running build. */
  const currentVersion = ref(__APP_VERSION__)
  /** Disclaimer baseline for the running build, or `null` on a broken build. */
  const currentBaseline = ref<string | null>(computeDisclaimerBaseline(__APP_VERSION__))
  /** The persisted record observed on last `loadFromStorage()`, or `null`. */
  const storedRecord = ref<AcknowledgementRecord | null>(null)
  /**
   * `true` while the acknowledgement gate must be shown. Initially `true` so
   * the first-paint window cannot leak the safety-critical surfaces while
   * `loadFromStorage()` is still running; flipped to `false` only after a
   * stored record matching the current baseline is read, or after the pilot
   * explicitly calls {@link acknowledge}.
   */
  const gateOpen = ref(true)
  /**
   * `true` once `loadFromStorage()` has been called at least once. Exposed
   * so App.vue / tests can wait on the initial check without racing.
   */
  const loaded = ref(false)
  /**
   * `true` when the storage backend was unreachable on the last
   * `loadFromStorage()` call. Surfaced for diagnostics; the gate stays open
   * in this case regardless of what may be on disk.
   */
  const storageUnavailable = ref(false)

  /** Read the persisted record and resolve `gateOpen`. */
  function loadFromStorage(): void {
    loaded.value = true
    const baseline = currentBaseline.value
    if (baseline === null) {
      // Build-time SemVer is invalid — fail closed. We do not consult the
      // store: a record acknowledging a malformed baseline is meaningless,
      // and the pilot must re-acknowledge once the build is corrected.
      gateOpen.value = true
      storedRecord.value = null
      logger.error('Disclaimer baseline could not be computed; failing closed', {
        code: 'DISCLAIMER_BASELINE_INVALID',
        version: String(currentVersion.value),
      })
      return
    }

    let raw: string | null
    try {
      raw = localStorage.getItem(STORAGE_KEY)
      storageUnavailable.value = false
    } catch {
      storageUnavailable.value = true
      gateOpen.value = true
      storedRecord.value = null
      logger.warn('localStorage unavailable for disclaimer ack; gate stays open', {
        code: 'DISCLAIMER_STORAGE_UNAVAILABLE',
      })
      return
    }

    if (raw === null) {
      gateOpen.value = true
      storedRecord.value = null
      return
    }

    const parsed = safeJsonParse(raw)
    if (!isAcknowledgementRecord(parsed)) {
      gateOpen.value = true
      storedRecord.value = null
      logger.warn('Disclaimer ack record corrupt; treating as absent', {
        code: 'DISCLAIMER_RECORD_CORRUPT',
      })
      return
    }

    storedRecord.value = parsed
    if (parsed.acceptedBaseline === baseline) {
      gateOpen.value = false
    } else {
      gateOpen.value = true
      logger.info('Disclaimer baseline changed; re-prompting pilot', {
        code: 'DISCLAIMER_BASELINE_CHANGED',
        previousBaseline: parsed.acceptedBaseline,
        currentBaseline: baseline,
      })
    }
  }

  /**
   * Persist acknowledgement for the current baseline and close the gate.
   *
   * Returns `false` if the build's baseline is invalid (cannot persist) or
   * if writing to `localStorage` threw — the gate then stays open and
   * App.vue's modal will simply re-render. `true` means the acknowledgement
   * was durably recorded.
   */
  function acknowledge(now: () => number = Date.now): boolean {
    const baseline = currentBaseline.value
    if (baseline === null) {
      logger.error('Disclaimer acknowledge rejected — baseline is invalid', {
        code: 'DISCLAIMER_BASELINE_INVALID',
      })
      return false
    }
    const record: AcknowledgementRecord = {
      schemaVersion: SCHEMA_VERSION,
      acceptedVersion: currentVersion.value,
      acceptedBaseline: baseline,
      acceptedAt: now(),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    } catch {
      storageUnavailable.value = true
      logger.warn('localStorage write failed for disclaimer ack; gate stays open', {
        code: 'DISCLAIMER_STORAGE_WRITE_FAILED',
      })
      return false
    }
    storedRecord.value = record
    gateOpen.value = false
    return true
  }

  /**
   * Reset the in-memory state — intended for tests and the future
   * delete-all-data flow. Does NOT clear `localStorage` on its own; tests
   * call `localStorage.clear()` separately if needed.
   */
  function resetForTesting(): void {
    storedRecord.value = null
    gateOpen.value = true
    loaded.value = false
    storageUnavailable.value = false
  }

  return {
    currentVersion,
    currentBaseline,
    storedRecord,
    gateOpen,
    loaded,
    storageUnavailable,
    loadFromStorage,
    acknowledge,
    resetForTesting,
  }
})
