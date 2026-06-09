/**
 * Performance — Pinia Store.
 *
 * P2 orchestration layer for the v0.4.0 Performance Math Core. It owns no
 * safety math: every distance, penalty, margin and violation is produced by a
 * pure `src/core/` function. The store's job is to (1) gather pilot input,
 * (2) sequence the three P1 facades — POH distances → conservative
 * extrapolation control → safety-factor pipeline — and (3) project the typed
 * results into a view-model plus the centralised notification contract.
 *
 * Architecture (mirrors the M&B store):
 *   Layer 1 — Raw input state (profile, conditions, runway, OSF, factors, ack)
 *   Layer 2 — Derived getters (osfInput, inputsComplete, severity flags)
 *   Layer 3 — Notification capture (replaced wholesale on every run)
 *   Layer 4 — State machine pointer (single `evaluateState()` mutator)
 *
 * @see docs/architecture/notification_schema.md
 * @see docs/journeys/03_performance_safety.md
 */

import { defineStore } from 'pinia'
import {
  computePohDistances,
  pivotDataPointsToCube,
  type PohDistanceConditions,
} from '@/core/logic/performance.poh-distance'
import {
  cubeEnvelopeRanges,
  resolveExtrapolatedDistance,
} from '@/core/logic/performance.extrapolation'
import { applySafetyFactors } from '@/core/adapters/performance.safety-factor.adapter'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import type { FlightPhase } from '@/core/domain/aircraft.types'
import type {
  OperationalSafetyFactorInput,
  PerformanceCorrectionFactors,
} from '@/core/domain/performance.math-types'
import type {
  AvailableDistancesInput,
  Notification,
  OsfPreset,
  PerformanceConditionsInput,
  PerformanceResultView,
  PerformanceUiState,
} from './performance.types'

/** The four POH phases keyed to their view-model distance fields. */
const PHASE_TO_KEY = {
  TakeoffRoll: 'takeoffRoll',
  TakeoffDistance50ft: 'takeoffDistance50ft',
  LandingRoll: 'landingRoll',
  LandingDistance50ft: 'landingDistance50ft',
} as const satisfies Record<FlightPhase, keyof PerformanceResultView['base']>

/** Default correction factors: 1.0 = no correction (pilot adjusts per conditions). */
function neutralFactors(): PerformanceCorrectionFactors {
  return { friction: 1, slope: 1, densityAltitude: 1, wind: 1 }
}

function note(
  id: string,
  severity: Notification['severity'],
  message: string,
  persistent = false,
): Notification {
  return { id, severity, message, context: 'Performance', persistent, dismissible: true }
}

export const usePerformanceStore = defineStore('performance', {
  // ── Layer 1 — Raw input state ──────────────────────────────────────────────
  state: () => ({
    uiState: 'INITIAL' as PerformanceUiState,
    profile: null as AircraftProfile | null,
    conditions: {
      mass: null,
      pressureAltitude: null,
      temperature: null,
    } as PerformanceConditionsInput,
    available: { takeoff: null, landing: null } as AvailableDistancesInput,
    factors: neutralFactors() as PerformanceCorrectionFactors,
    osfPreset: 'easa-standard' as OsfPreset,
    /** Custom OSF multiplier — only consulted when `osfPreset === 'custom'`. */
    customOsf: null as number | null,
    /** Pilot-in-Command acknowledgment of an extrapolated result (REQ-PF-012). */
    acknowledged: false,
    notifications: [] as Notification[],
    result: null as PerformanceResultView | null,
  }),

  // ── Layer 2 — Derived getters ──────────────────────────────────────────────
  getters: {
    // @IMP-PF-STORE-002@ (FROM: @REQ-PF-006@, @REQ-PF-016@)
    /** Build the P1 OSF input from the selected preset + the profile's POH factors. */
    osfInput(): OperationalSafetyFactorInput {
      const poh = this.profile?.safetyFactors
      return {
        preset: this.osfPreset,
        customMultiplier:
          this.osfPreset === 'custom' && this.customOsf !== null ? this.customOsf : undefined,
        pohMandatedFactor: poh ? { takeoff: poh.takeoff, landing: poh.landing } : undefined,
      }
    },

    /** True once every mandatory input needed for a computation is present and finite. */
    inputsComplete(): boolean {
      const c = this.conditions
      const a = this.available
      const finite = (v: number | null): v is number => v !== null && Number.isFinite(v)
      const customOk = this.osfPreset !== 'custom' || finite(this.customOsf)
      return (
        finite(c.mass) &&
        finite(c.pressureAltitude) &&
        finite(c.temperature) &&
        finite(a.takeoff) &&
        finite(a.landing) &&
        customOk
      )
    },

    hasCriticalNotification(): boolean {
      return this.notifications.some((n) => n.severity === 'CRITICAL')
    },
    hasErrorNotification(): boolean {
      return this.notifications.some((n) => n.severity === 'ERROR')
    },
    hasWarningNotification(): boolean {
      return this.notifications.some((n) => n.severity === 'WARNING')
    },

    /** True when an extrapolated result is still awaiting acknowledgment (REQ-PF-012). */
    awaitingAcknowledgment(): boolean {
      return this.result?.extrapolation.requiresAcknowledgment === true && !this.acknowledged
    },
  },

  // ── Layers 3 & 4 — Actions ─────────────────────────────────────────────────
  actions: {
    // @IMP-PF-STORE-003@ (FROM: @REQ-PF-001@, @REQ-AC-005@)
    /** Load a (Verified) aircraft profile and recompute from current inputs. */
    loadProfile(profile: AircraftProfile): void {
      this.profile = profile
      this.acknowledged = false
      this._runCalculation()
      this.evaluateState()
    },

    updateCondition<K extends keyof PerformanceConditionsInput>(
      key: K,
      value: number | null,
    ): void {
      this.conditions[key] = value
      this._recompute()
    },

    setAvailable<K extends keyof AvailableDistancesInput>(key: K, value: number | null): void {
      this.available[key] = value
      this._recompute()
    },

    setFactor<K extends keyof PerformanceCorrectionFactors>(key: K, value: number): void {
      this.factors[key] = value
      this._recompute()
    },

    setOsfPreset(preset: OsfPreset): void {
      this.osfPreset = preset
      this._recompute()
    },

    setCustomOsf(value: number | null): void {
      this.customOsf = value
      this._recompute()
    },

    // @IMP-PF-STORE-004@ (FROM: @REQ-PF-012@)
    /**
     * Record the Pilot-in-Command's acknowledgment of an extrapolated result.
     * No recomputation — acknowledgment only lifts the finalization gate; the
     * numbers are unchanged. Any later input change clears it (see `_recompute`).
     */
    acknowledgeExtrapolation(): void {
      if (!this.awaitingAcknowledgment) return
      this.acknowledged = true
      if (this.result) this.result.finalized = true
      this.evaluateState()
    },

    clearProfile(): void {
      this.profile = null
      this.acknowledged = false
      this.notifications = []
      this.result = null
      this.uiState = 'INITIAL'
    },

    /** Re-run after any input change. Changing inputs always invalidates a prior ack. */
    _recompute(): void {
      this.acknowledged = false
      this._runCalculation()
      this.evaluateState()
    },

    // @IMP-PF-STORE-005@ (FROM: @REQ-PF-004@, @REQ-PF-006@, @REQ-PF-007@, @REQ-PF-010@, @REQ-PF-011@, @REQ-PF-012@, @REQ-PF-015@, @REQ-PF-016@, @REQ-PF-017@)
    /**
     * Sequence the three P1 facades and capture the result + notifications.
     * Pure orchestration — every numeric value comes from `src/core/`.
     */
    _runCalculation(): void {
      if (!this.profile) {
        this.notifications = []
        this.result = null
        return
      }
      if (!this.inputsComplete) {
        this.notifications = []
        this.result = null
        return
      }

      const conditions: PohDistanceConditions = {
        mass: this.conditions.mass!,
        pressureAltitude: this.conditions.pressureAltitude!,
        temperature: this.conditions.temperature!,
      }

      // ── 1. Base POH distances (enforces the Verified-profile gate) ──────────
      const poh = computePohDistances(this.profile, conditions)
      if (poh.status === 'failure') {
        this.notifications = [
          note('ERR-PF-002', 'ERROR', `Performance data unavailable: ${poh.message}`),
        ]
        this.result = null
        return
      }

      // ── 2. Conservative extrapolation control, per phase ────────────────────
      const byPhase = new Map<FlightPhase, { distance: number; ranges: ReturnType<typeof cubeEnvelopeRanges> }>()
      const perf = this.profile.performanceProfiles ?? []
      try {
        for (const pp of perf) {
          if (!(pp.flightPhase in PHASE_TO_KEY)) continue
          const cube = pivotDataPointsToCube(pp.dataPoints)
          const key = PHASE_TO_KEY[pp.flightPhase]
          byPhase.set(pp.flightPhase, {
            distance: poh.distances[key],
            ranges: cubeEnvelopeRanges(cube),
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        this.notifications = [note('ERR-PF-002', 'ERROR', `Performance data unavailable: ${message}`)]
        this.result = null
        return
      }

      const penalised: PerformanceResultView['base'] = {
        takeoffRoll: poh.distances.takeoffRoll,
        takeoffDistance50ft: poh.distances.takeoffDistance50ft,
        landingRoll: poh.distances.landingRoll,
        landingDistance50ft: poh.distances.landingDistance50ft,
      }
      let requiresAcknowledgment = false
      let benefitCapped = false
      let penaltyApplied = false

      for (const [phase, { distance, ranges }] of byPhase) {
        const resolved = resolveExtrapolatedDistance(distance, conditions, ranges)
        if (resolved.state === 'blocked') {
          // A single phase beyond the 10% cap blocks the whole computation —
          // no distance may reach a Go/No-Go decision (REQ-PF-010, UJ-C-001).
          this.notifications = [note('ERR-PF-001', 'ERROR', resolved.message, true)]
          this.result = null
          return
        }
        penalised[PHASE_TO_KEY[phase]] = resolved.distance
        requiresAcknowledgment ||= resolved.requiresAcknowledgment
        benefitCapped ||= resolved.benefitCapped
        penaltyApplied ||= resolved.state === 'extrapolated'
      }

      // ── 3. Safety-factor pipeline → operational distances + Go/No-Go ────────
      const sf = applySafetyFactors({
        base: penalised,
        factors: this.factors,
        osf: this.osfInput,
        available: { takeoff: this.available.takeoff!, landing: this.available.landing! },
      })
      if (sf.status === 'failure') {
        this.notifications = [
          note('ERR-SYS-001', 'ERROR', 'Performance inputs failed validation — verify entries.'),
        ]
        this.result = null
        return
      }

      // ── 4. Project violations + extrapolation state into notifications ──────
      const notifications: Notification[] = []
      if (requiresAcknowledgment) {
        notifications.push(
          note(
            'WARN-PF-003',
            'WARNING',
            'Performance data extrapolated beyond POH limits — a +20% penalty was applied. Pilot-in-Command acknowledgment required before use.',
            true,
          ),
        )
      }
      for (const v of sf.violations) {
        const op = v.operation === 'takeoff' ? 'take-off' : 'landing'
        if (v.notificationId === 'CRIT-PF-002') {
          notifications.push(
            note('CRIT-PF-002', 'CRITICAL', `Runway insufficient for required ${op} distance.`),
          )
        } else if (v.notificationId === 'WARN-PF-002') {
          notifications.push(
            note(
              'WARN-PF-002',
              'WARNING',
              `Operational safety factor for ${op} is below the recommended minimum.`,
            ),
          )
        }
      }

      const finalized = !requiresAcknowledgment || this.acknowledged
      this.notifications = notifications
      this.result = {
        base: penalised,
        // CAA SSL 07 estimation (REQ-PF-005) is a sibling feature; until it
        // lands the store reads only authoritative POH values, so no marker.
        estimated: {
          takeoffRoll: false,
          takeoffDistance50ft: false,
          landingRoll: false,
          landingDistance50ft: false,
        },
        takeoff: sf.takeoff,
        landing: sf.landing,
        goNoGo: sf.goNoGo,
        finalized,
        extrapolation: { requiresAcknowledgment, benefitCapped, penaltyApplied },
        clamped: Object.values(poh.clamping).some(
          (c) => c.massClamped || c.altitudeClamped || c.temperatureClamped,
        ),
      }
    },

    // @IMP-PF-STORE-006@ (FROM: @DES-ARCH-003@, @DES-ARCH-005@)
    /** Deterministic state resolution — the only writer of `uiState`. */
    evaluateState(): void {
      if (!this.profile) {
        this.uiState = 'INITIAL'
        return
      }
      if (!this.inputsComplete || !this.result) {
        // No result with notifications still means a hard failure (BLOCKED).
        if (this.hasErrorNotification) {
          this.uiState = 'BLOCKED'
          return
        }
        this.uiState = 'UNCONFIGURED'
        return
      }
      if (this.awaitingAcknowledgment) {
        this.uiState = 'PENDING_ACK'
        return
      }
      if (this.hasCriticalNotification) {
        this.uiState = 'NO_GO'
        return
      }
      if (this.hasWarningNotification) {
        this.uiState = 'WARNING'
        return
      }
      this.uiState = 'GO'
    },
  },
})
