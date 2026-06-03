/**
 * Mass & Balance — Pinia Store.
 *
 * Central state management for the M&B module. Architecture:
 *
 *   Layer 1 — Raw input state  (stations, category, verification flags)
 *   Layer 2 — Derived getters  (totalMass, zfm, cgPosition, etc.)
 *   Layer 3 — Notification capture (replaced wholesale on every math run)
 *   Layer 4 — State machine pointer (single `evaluateState()` mutator)
 *
 * Contract:
 *   - No watchers, no deep watchers, no implicit reactive transitions.
 *   - Every public action mutates raw data, runs the math core, captures
 *     notifications, and calls evaluateState() — in that order.
 *   - evaluateState() is the ONLY function that writes to `uiState`.
 *     Exception: `LOADING` is a transitional state set explicitly by lifecycle
 *     actions (e.g. loadProfile) before async operations begin. It is never
 *     set by evaluateState() and cannot be reached through normal state
 *     resolution.
 *
 * @see docs/architecture/frontend_state_machine.md
 * @see .logs/00_next_steps.md (point 3)
 */

import { defineStore } from 'pinia'
import { calculateMassBalance } from '@/core/adapters/mass-balance.adapter'
import {
  normalizeMassToKg,
  normalizeArmToM,
  normalizeMomentToSI,
  parseSourceUnit,
} from '@/core/logic/unit-normalization'
import { normalizeFuelQuantityToKg, isFuelQuantityUnit } from '@/core/logic/fuel-mass'
import { isKnownFuelType } from '@/core/logic/fuel-density'
import type { MassUnit } from '@/core/domain/units'
import type { SessionPayload } from '@/core/domain/session.schema'
import type {
  MassBalanceState,
  AircraftContext,
  CategoryDefinition,
  LoadPointDefinition,
  StationInput,
  Notification,
  MathCoreInput,
  MathCoreResult,
} from '@/modules/mass-balance/stores/mass-balance.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives whether a load point is mandatory for M&B input.
 * Non-fuel stations (fuelTank === null) must always be entered by the pilot;
 * fuel stations are optional (default 0 = no fuel loaded).
 */
function deriveMandatory(lp: LoadPointDefinition): boolean {
  return lp.fuelTank === null
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMassBalanceStore = defineStore('massBalance', {
  // ═══════════════════════════════════════════════════════════════════════════
  // Layer 1 — Raw Input State
  // ═══════════════════════════════════════════════════════════════════════════

  state: () => ({
    /** State machine pointer. Only `evaluateState()` may write this. */
    uiState: 'INITIAL' as MassBalanceState,

    /** Loaded aircraft profile context (null when INITIAL). */
    aircraft: null as AircraftContext | null,

    /** Currently selected certification category key (e.g. "Normal"). */
    activeCategory: null as string | null,

    /** Per-station user inputs. One entry per available LoadPoint. */
    stations: [] as StationInput[],

    /** Notifications from the last math-core run. Replaced wholesale. */
    notifications: [] as Notification[],

    /** Last computed math result (null before first calculation). */
    lastResult: null as MathCoreResult | null,
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Layer 2 — Derived Computed (Getters)
  // ═══════════════════════════════════════════════════════════════════════════

  getters: {
    // @IMP-MB-STORE-003@ (FROM: @REQ-MB-001@)
    activeCategoryDef(): CategoryDefinition | null {
      if (!this.aircraft || !this.activeCategory) return null
      return (
        this.aircraft.certificationCategories.find((c) => c.category === this.activeCategory) ??
        null
      )
    },

    /** Stations filtered by the active category's allowable load points. */
    availableStations(): StationInput[] {
      if (!this.aircraft || !this.activeCategory) return []
      return this.stations.filter((station) => {
        const def = this.aircraft!.loadPoints[station.index]
        if (!def) return false
        // null allowableCategories means available in all categories
        if (def.allowableCategories === null) return true
        return def.allowableCategories.includes(
          this.activeCategory! as 'Normal' | 'Utility' | 'Aerobatic',
        )
      })
    },

    /** True when all mandatory stations in the available set have been touched (explicit interaction or catalogue default applied). */
    allMandatoryFieldsPopulated(): boolean {
      return this.availableStations.filter((s) => s.mandatory).every((s) => s.touched)
    },

    /** True when all mandatory stations in the available set have been explicitly verified. */
    allFieldsVerified(): boolean {
      return this.availableStations.filter((s) => s.mandatory).every((s) => s.verified)
    },

    /** True if any captured notification has CRITICAL severity. */
    hasCriticalNotification(): boolean {
      return this.notifications.some((n) => n.severity === 'CRITICAL')
    },

    /** True if any captured notification has ERROR severity (validation failures). */
    hasErrorNotification(): boolean {
      return this.notifications.some((n) => n.severity === 'ERROR')
    },

    /** True if any captured notification has WARNING severity. */
    hasWarningNotification(): boolean {
      return this.notifications.some((n) => n.severity === 'WARNING')
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Layers 3 & 4 — Actions (Notification Capture + State Machine)
  // ═══════════════════════════════════════════════════════════════════════════

  actions: {
    // ─── Lifecycle ─────────────────────────────────────────────────────

    /**
     * Load an aircraft profile and initialize raw station state.
     *
     * Transitions: INITIAL → LOADING → evaluated state (or INITIAL on failure).
     *
     * @param profile - The aircraft context fetched from IndexedDB.
     *                  (The caller is responsible for the async fetch;
     *                   the store receives the resolved data.)
     */
    // @IMP-MB-STORE-005@ (FROM: @REQ-MB-001@, @REQ-MB-002@, @DES-UX-007@, @DES-ARCH-005@)
    loadProfile(profile: AircraftContext): void {
      this.uiState = 'LOADING'

      try {
        this.aircraft = profile

        // Default to the first certification category
        this.activeCategory =
          profile.certificationCategories.length > 0
            ? (profile.certificationCategories[0]?.category ?? null)
            : null

        // Initialize station inputs from load point definitions
        // @IMP-MB-STORE-014@ (FROM: @REQ-MB-002@, @DES-UX-007@)
        // Mandatory (non-fuel) stations count as populated on load: catalogue defaults are authoritative, including 0 kg.
        this.stations = profile.loadPoints.map((lp, index) => ({
          index,
          name: lp.name,
          weight: lp.defaultQuantity,
          verified: false,
          mandatory: deriveMandatory(lp),
          touched: deriveMandatory(lp) ? true : lp.defaultQuantity > 0,
          hasError: false,
        }))

        this.notifications = []
        this.lastResult = null

        // Run initial calculation if defaults produce non-zero state
        this._runCalculation()
        this.evaluateState()
      } catch {
        // Corrupted profile → revert to INITIAL (§4.1)
        this.aircraft = null
        this.activeCategory = null
        this.stations = []
        this.notifications = []
        this.lastResult = null
        this.uiState = 'INITIAL'
      }
    },

    // ─── Mutations ─────────────────────────────────────────────────────

    /**
     * Update a station's weight.
     *
     *   1. Mutate raw data
     *   2. Run math core
     *   3. Capture notifications
     *   4. evaluateState()
     */
    // @IMP-MB-STORE-006@ (FROM: @REQ-MB-002@, @REQ-MB-003@, @DES-UX-007@, @DES-UX-008@, @DES-ARCH-005@)
    updateStationWeight(stationIndex: number, weight: number): void {
      const station = this.stations[stationIndex]
      if (!station) return
      if (station.weight === weight) {
        station.touched = true
        this.evaluateState()
        return
      }

      station.weight = weight
      station.touched = true
      this._runCalculation()
      this.evaluateState()
    },

    /**
     * Change the active certification category.
     *
     * Recalculates limits (MTOM, envelope) and re-evaluates state.
     * Stations not allowed in the new category become unavailable
     * (filtered by the `availableStations` getter).
     */
    // @IMP-MB-STORE-007@ (FROM: @REQ-MB-001@, @REQ-UI-009@, @DES-UX-007@)
    changeCertificationCategory(category: string): void {
      if (!this.aircraft) return

      const exists = this.aircraft.certificationCategories.some((c) => c.category === category)
      if (!exists) return

      this.activeCategory = category
      this._runCalculation()
      this.evaluateState()
    },

    // @IMP-MB-STORE-008@ (FROM: @DES-UX-011@, @REQ-UI-014@)
    markFieldVerified(stationIndex: number): void {
      const station = this.stations[stationIndex]
      if (!station) return

      station.verified = true
      this.evaluateState()
    },

    // @IMP-MB-STORE-009@ (FROM: @DES-ARCH-004@, @REQ-UI-016@)
    markAllVerified(): void {
      for (const station of this.availableStations) {
        station.verified = true
      }
      this.evaluateState()
    },

    /**
     * Re-apply a persisted session payload to a freshly loaded aircraft profile.
     *
     * Callers must first invoke `loadProfile()` so the store holds the correct
     * aircraft context; this action then overrides the default station weights
     * and the active category with the pilot's last-entered values before
     * re-running the math core.
     *
     * Defensive invariants:
     *  - No-op when no aircraft is loaded.
     *  - No-op when the payload's `aircraftId` does not match the loaded
     *    profile (prevents cross-airframe pollution after a fleet edit).
     *  - Station entries whose index is out of range are silently skipped so
     *    a stale payload from an older profile revision does not corrupt the
     *    current station array.
     *  - An unknown `activeCategory` leaves the profile default in place.
     */
    // @IMP-MB-STORE-019@ (FROM: @REQ-SYS-013@)
    applyRestoredSession(payload: SessionPayload): void {
      if (!this.aircraft) return
      if (this.aircraft.id !== payload.aircraftId) return

      const categoryExists = this.aircraft.certificationCategories.some(
        (c) => c.category === payload.activeCategory,
      )
      if (categoryExists) {
        this.activeCategory = payload.activeCategory
      }

      for (const sp of payload.stations) {
        const station = this.stations[sp.index]
        if (!station) continue
        station.weight = sp.weight
        station.touched = sp.touched
        station.verified = sp.verified
      }

      this._runCalculation()
      this.evaluateState()
    },

    /**
     * Clear the entire M&B context on aircraft hot-swap.
     *
     * Unlike `resetPayload()` (which only zeroes weights for the current
     * aircraft), this fully detaches the aircraft profile and returns the
     * store to `INITIAL`. Required so prior-aircraft load data, results, and
     * notifications cannot leak into a newly selected aircraft's computation.
     * Session-persistence clears itself via its watcher on `aircraft.id`.
     */
    // @IMP-MB-STORE-018@ (FROM: @REQ-AC-005@)
    clearProfile(): void {
      this.aircraft = null
      this.activeCategory = null
      this.stations = []
      this.notifications = []
      this.lastResult = null
      this.uiState = 'INITIAL'
    },

    /**
     * Reset all station weights to 0.
     *
     * This is a deliberate user action, so all stations are marked as touched
     * and the calculation re-runs to show the empty-aircraft result.
     */
    // @IMP-MB-STORE-010@ (FROM: @DES-UX-012@)
    resetPayload(): void {
      // Reset semantics (per product call):
      //   1. Each station resets to the greater of the profile's defaultQuantity
      //      and its minimum-allowed load (unusableFuel for fuel tanks, 0 for
      //      non-fuel stations). A raw zero reset would wipe below the unusable
      //      floor on fuel tanks — modelling a dry tank that contradicts the POH.
      //   2. When defaultQuantity > 0 the pilot's "zero out" is by design a
      //      return to the profile-declared baseline, not to an empty tank.
      const lps = this.aircraft?.loadPoints ?? []
      for (const station of this.stations) {
        const lp = lps[station.index]
        const defaultQty = lp?.defaultQuantity ?? 0
        const unusable = lp?.fuelTank?.unusableFuel ?? 0
        station.weight = Math.max(defaultQty, unusable)
        station.verified = false
        station.touched = true
        station.hasError = false
      }
      this._runCalculation()
      this.evaluateState()
    },

    // ─── Private helpers ───────────────────────────────────────────────

    /**
     * Assemble math-core input from raw state and run the calculation.
     * Captures the result and notifications wholesale.
     */
    // @IMP-MB-STORE-013@ (FROM: @REQ-MB-002@, @REQ-MB-003@, @DES-ARCH-005@)
    _runCalculation(): void {
      const catDef = this.activeCategoryDef
      if (!this.aircraft || !catDef) {
        this.notifications = []
        this.lastResult = null
        return
      }

      /** Draft fleet profiles may be used for planning but must surface H-011 / WARN-AC-002 (REQ-AC-005). */
      const draftProfileWarning: Notification | null =
        this.aircraft.status === 'draft'
          ? {
              id: 'WARN-AC-002',
              severity: 'WARNING',
              message: 'Draft Profile Active',
              context: 'Aircraft.Status',
              persistent: true,
              dismissible: true,
            }
          : null

      // Find the active weighing report (most recent by validFrom)
      const reports = [...this.aircraft.weighingReports].sort((a, b) =>
        b.validFrom.localeCompare(a.validFrom),
      )
      const activeReport = reports[0]
      if (!activeReport) {
        const crit: Notification = {
          id: 'CRIT-SYS-001',
          severity: 'CRITICAL',
          message: 'No valid weighing report found',
          context: 'System',
          persistent: false,
          dismissible: true,
        }
        this.notifications = draftProfileWarning ? [draftProfileWarning, crit] : [crit]
        this.lastResult = null
        return
      }

      // @IMP-MB-STORE-016@ (FROM: @REQ-AD-014@, @REQ-SYS-003@)
      // @IMP-MB-STORE-020@ (FROM: @REQ-SYS-003@, @REQ-AD-014@)
      // Values are stored at rest in their original source unit (REQ-AD-014).
      // Normalize EVERY geometric quantity to SI (kg, m, kg·m) at the adapter
      // boundary before passing to the math core — not just mass. The arm unit
      // is derived from the profile's `sourceUnit` (e.g. `lb-in`) rather than
      // hardcoded to metres: an imperial profile with
      // arms in inches would otherwise yield a wrong CG and a false in-envelope
      // verdict (H-005 / H-006 class defect).
      const { massUnit: profileMassUnit, armUnit } = parseSourceUnit(this.aircraft!.sourceUnit)

      // @IMP-MB-STORE-021@ (FROM: @REQ-FE-001@, @REQ-SYS-003@, H-002)
      // Fail-closed on an unrecognized fuel type: surface a WARNING instead of
      // silently substituting the conservative fallback density. Collected here
      // and merged into the notification set below.
      const fuelFallbackNotes: Notification[] = []

      // Normalize an armLookup table (mass/volume axis → kg, moment → kg·m).
      const normalizeArmLookup = (
        entries: { massOrVolume: number; moment: number }[],
        massToKg: (v: number) => number,
      ) =>
        entries.map((e) => ({
          massOrVolume: massToKg(e.massOrVolume),
          moment: normalizeMomentToSI(e.moment, armUnit),
        }))

      // Normalize an envelope point's armOrMoment: it is an ARM (length) in
      // arm-graph mode and a MOMENT in moment-graph mode.
      const normalizeArmOrMoment = (value: number) =>
        catDef.graphType === 'arm'
          ? normalizeArmToM(value, armUnit)
          : normalizeMomentToSI(value, armUnit)

      const input: MathCoreInput = {
        stations: this.availableStations
          .filter((s) => {
            const def = this.aircraft!.loadPoints[s.index]
            return def && def.fuelTank === null
          })
          .map((s) => {
            const def = this.aircraft!.loadPoints[s.index]!
            const massUnit = (def.unit || profileMassUnit) as MassUnit
            return {
              index: s.index,
              mass: normalizeMassToKg(s.weight, massUnit),
              arm: def.arm !== null ? normalizeArmToM(def.arm, armUnit) : null,
              armLookup: normalizeArmLookup(def.armLookup, (v) => normalizeMassToKg(v, massUnit)),
            }
          }),
        basicEmptyMass: normalizeMassToKg(activeReport.basicEmptyMass, profileMassUnit),
        emptyCenterOfGravity: normalizeArmToM(activeReport.emptyCg, armUnit),
        maxTakeoffMass: normalizeMassToKg(catDef.maxTakeoffMass, profileMassUnit),
        maxZeroFuelMass:
          catDef.maxZeroFuelMass !== null
            ? normalizeMassToKg(catDef.maxZeroFuelMass, profileMassUnit)
            : null,
        envelope: catDef.envelope.map((p) => ({
          mass: normalizeMassToKg(p.mass, profileMassUnit),
          armOrMoment: normalizeArmOrMoment(p.armOrMoment),
        })),
        graphType: catDef.graphType,
        fuelStations: this.availableStations
          .filter((_s) => {
            const def = this.aircraft!.loadPoints[_s.index]
            return def && def.fuelTank !== null
          })
          .map((s) => {
            const def = this.aircraft!.loadPoints[s.index]!
            const ft = def.fuelTank!
            // Fuel tanks may be expressed in volume (L, USG, IMPgal) or mass
            // (kg, lb). normalizeFuelQuantityToKg converts either into kg using
            // the density of the tank's first permissible fuel type — a volume
            // input must go through fuel-density conversion, not through the
            // mass-only normalizeMassToKg which silently treats 'L' as 'kg'
            // (H-002 — fuel unit confusion).
            const rawUnit = def.unit || profileMassUnit
            const fuelUnit = isFuelQuantityUnit(rawUnit)
              ? rawUnit
              : (profileMassUnit as MassUnit)
            const permissible = ft.permissibleFuelTypes

            // Fail-closed: if the tank's first permissible fuel type is not
            // canonical, the density used would be the silent fallback. Warn.
            const primaryFuel = permissible[0]
            if (primaryFuel === undefined || !isKnownFuelType(primaryFuel)) {
              fuelFallbackNotes.push({
                id: 'WARN-FE-001',
                severity: 'WARNING',
                message: `Unknown fuel type${primaryFuel ? ` "${primaryFuel}"` : ''} — using conservative fallback density; verify fuel mass`,
                context: 'FuelEndurance.Density',
                persistent: false,
                dismissible: true,
              })
            }

            return {
              index: s.index,
              mass: normalizeFuelQuantityToKg(s.weight, fuelUnit, permissible),
              arm: def.arm !== null ? normalizeArmToM(def.arm, armUnit) : null,
              armLookup: normalizeArmLookup(def.armLookup, (v) =>
                normalizeFuelQuantityToKg(v, fuelUnit, permissible),
              ),
              unusableFuel: normalizeFuelQuantityToKg(ft.unusableFuel, fuelUnit, permissible),
              burnSequences: ft.burnSequences,
            }
          }),
      }

      let result: MathCoreResult
      try {
        result = calculateMassBalance(input)
      } catch {
        const crit: Notification = {
          id: 'CRIT-SYS-002',
          severity: 'CRITICAL',
          message: 'Calculation failed unexpectedly — verify inputs and retry',
          context: 'System',
          persistent: false,
          dismissible: true,
        }
        this.notifications = draftProfileWarning ? [draftProfileWarning, crit] : [crit]
        this.lastResult = null
        return
      }

      // @IMP-MB-STORE-022@ (FROM: @REQ-SYS-012@, @REQ-UI-008@)
      // Fail-closed on adapter validation failure. The adapter
      // returns `success: false` with NaN-filled CgPoints; if we assigned that
      // to `lastResult` the UI would render "NaN kg" to the pilot, masking the
      // failure. Take the notifications path and NEVER set `lastResult` from a
      // failed compute. The error/warning violations still surface so the state
      // machine resolves to ERROR_CRITICAL / WARNING (never VERIFIED_SAFE).
      if (!result.success) {
        const failureNotes = result.violations.map((v): Notification =>
          v.type === 'INVALID_INPUT' && v.code === 'OUT_OF_RANGE'
            ? {
                id: 'WARN-UI-001',
                severity: 'WARNING',
                message: `${v.field ?? 'Input'} is out of standard operational range`,
                context: 'MassBalance.Validation',
                persistent: false,
                dismissible: true,
              }
            : {
                id: 'ERR-SYS-001',
                severity: 'ERROR',
                message: `Invalid input: ${v.field ?? 'unknown'} (${v.code ?? 'validation failed'})`,
                context: 'MassBalance.Validation',
                persistent: false,
                dismissible: true,
              },
        )
        this.notifications = [
          ...(draftProfileWarning ? [draftProfileWarning] : []),
          ...fuelFallbackNotes,
          ...failureNotes,
        ]
        this.lastResult = null
        this._updateStationErrorFlags(result.violations)
        return
      }

      // Enforce per-station operationalLimit
      for (const s of this.availableStations) {
        const def = this.aircraft!.loadPoints[s.index]
        if (def?.operationalLimit != null && s.weight > def.operationalLimit) {
          result.violations.push({
            type: 'STATION_LIMIT_EXCEEDED',
            stationIndex: s.index,
          })
        }
      }

      // Map raw violations to UI notifications
      // @IMP-MB-STORE-011@ (FROM: @REQ-MB-004@, @REQ-MB-005@, @REQ-MB-009@, @REQ-MB-011@, @REQ-SYS-011@, @REQ-SYS-012@, @DES-UX-010@, @DES-ARCH-001@, @REQ-AC-005@)
      const violationNotes: Notification[] = result.violations.map((v): Notification => {
        switch (v.type) {
          case 'MTOM_EXCEEDED':
            return {
              id: 'CRIT-MB-002',
              severity: 'CRITICAL',
              message: 'MTOM Exceeded',
              context: 'MassBalance.TotalMass',
              persistent: false,
              dismissible: true,
            }
          case 'MZFM_EXCEEDED':
            return {
              id: 'CRIT-MB-004',
              severity: 'CRITICAL',
              message: 'MZFM Exceeded',
              context: 'MassBalance.ZFM',
              persistent: false,
              dismissible: true,
            }
          case 'CG_OUT_OF_ENVELOPE':
            return {
              id: 'CRIT-MB-001',
              severity: 'CRITICAL',
              message: 'CG Out of Envelope',
              context: 'MassBalance.CG',
              persistent: false,
              dismissible: true,
            }
          case 'CG_MIGRATION_EXCEEDED':
            return {
              id: 'CRIT-MB-003',
              severity: 'CRITICAL',
              message: 'CG Migration Limit Exceeded',
              context: 'MassBalance.CG',
              persistent: false,
              dismissible: true,
            }
          case 'STATION_LIMIT_EXCEEDED':
            return {
              id: 'WARN-MB-005',
              severity: 'WARNING',
              message: `Station ${v.stationIndex ?? ''} limit exceeded`,
              context: 'MassBalance.Stations',
              persistent: false,
              dismissible: true,
            }
          case 'INVALID_INPUT':
            // @IMP-MB-STORE-017@ (FROM: @REQ-UI-008@, @REQ-SYS-012@)
            // OUT_OF_RANGE is an operational range advisory (soft WARNING);
            // all other INVALID_INPUT codes are hard validation ERRORs.
            if (v.code === 'OUT_OF_RANGE') {
              return {
                id: 'WARN-UI-001',
                severity: 'WARNING',
                message: `${v.field ?? 'Input'} is out of standard operational range`,
                context: 'MassBalance.Validation',
                persistent: false,
                dismissible: true,
              }
            }
            return {
              id: 'ERR-SYS-001',
              severity: 'ERROR',
              message: `Invalid input: ${v.field ?? 'unknown'} (${v.code ?? 'validation failed'})`,
              context: 'MassBalance.Validation',
              persistent: false,
              dismissible: true,
            }
          default:
            return {
              id: 'UNKNOWN',
              severity: 'WARNING',
              message: 'Unknown Safety Violation',
              context: 'System',
              persistent: false,
              dismissible: true,
            }
        }
      })

      this.notifications = [
        ...(draftProfileWarning ? [draftProfileWarning] : []),
        ...fuelFallbackNotes,
        ...this._collectPlausibilityWarnings(),
        ...violationNotes,
      ]

      this.lastResult = result

      // @IMP-MB-STORE-015@ (FROM: @REQ-UQ-004@)
      // Update per-station error flags from INVALID_INPUT violations so the UI
      // can highlight the affected input fields as described in the validation
      // error message.
      this._updateStationErrorFlags(result.violations)
    },

    /**
     * Plausibility check — Zero-Value mandatory station mass.
     *
     * Emits one WARN-UQ-001 listing every mandatory non-fuel station whose
     * current weight is exactly zero. A required occupant (pilot, crew,
     * passenger) at zero mass is almost always a missed entry rather than an
     * intentional empty seat, so surfacing it as a soft warning catches the
     * Safety-Critical Design Check's "Garbage-In" defect class before it can
     * propagate into a Go/No-Go advisory.
     *
     * Fuel quantity is intentionally excluded: zero fuel is a legitimate
     * planning state and is already constrained from below by the
     * unusable-fuel floor on `MassStationInput`.
     *
     * The predicate is **strict equality with zero** (`s.weight === 0`).
     * Small positive masses are not flagged — REQ-UQ-006 narrows the
     * checked condition to "recorded weight of zero", and widening to a
     * threshold (e.g. < 10 kg) would put this branch in the path of a
     * different hazard class (low-mass plausibility) that is not yet
     * specified. Do not loosen this predicate without an accompanying
     * requirement and updated UT-MB-STORE-060…063.
     */
    // @IMP-MB-STORE-023@ (FROM: @REQ-UQ-006@)
    _collectPlausibilityWarnings(): Notification[] {
      if (!this.aircraft) return []

      const zeroNames = this.availableStations
        .filter((s) => {
          if (!s.mandatory) return false
          const def = this.aircraft!.loadPoints[s.index]
          if (!def || def.fuelTank !== null) return false
          return s.weight === 0
        })
        .map((s) => s.name)

      if (zeroNames.length === 0) return []

      return [
        {
          id: 'WARN-UQ-001',
          severity: 'WARNING',
          message: `Implausible mass on required station${zeroNames.length === 1 ? '' : 's'}: ${zeroNames.join(', ')} — verify input`,
          context: 'MassBalance.Plausibility',
          persistent: true,
          dismissible: true,
        },
      ]
    },

    /**
     * Derive which stations have validation errors from the violation list and
     * mark them via the `hasError` flag on StationInput. Clears all flags first
     * so stale errors are not left on fields that have since been corrected.
     */
    _updateStationErrorFlags(
      violations: import('@/core/domain/mass-balance.math-types').Violation[],
    ): void {
      // Clear all existing error flags
      for (const s of this.stations) s.hasError = false

      const nonFuelInputStations = this.availableStations.filter((s) => {
        const def = this.aircraft?.loadPoints[s.index]
        return def && def.fuelTank === null
      })
      const fuelInputStations = this.availableStations.filter((s) => {
        const def = this.aircraft?.loadPoints[s.index]
        return def && def.fuelTank !== null
      })

      for (const v of violations) {
        if (v.type !== 'INVALID_INPUT') continue

        // TECH-015: prefer the structured Zod path (`path[0] === 'stations'`,
        // `path[1] === arrayIdx`). Fall back to regex on the legacy stringified
        // `field` so older callers — and any non-Zod producer of violations —
        // still resolve to the correct station.
        let stationIndex: number | null = null
        const path = v.path
        if (path && path.length >= 2 && typeof path[1] === 'number') {
          const arrayIdx = path[1] as number
          if (path[0] === 'stations') {
            stationIndex = nonFuelInputStations[arrayIdx]?.index ?? null
          } else if (path[0] === 'fuelStations') {
            stationIndex = fuelInputStations[arrayIdx]?.index ?? null
          }
        } else if (v.field) {
          const stationMatch = v.field.match(/^STATIONS\[(\d+)\]/)
          const fuelMatch = v.field.match(/^FUEL_STATIONS\[(\d+)\]/)
          if (stationMatch) {
            const arrayIdx = Number.parseInt(stationMatch[1]!, 10)
            stationIndex = nonFuelInputStations[arrayIdx]?.index ?? null
          } else if (fuelMatch) {
            const arrayIdx = Number.parseInt(fuelMatch[1]!, 10)
            stationIndex = fuelInputStations[arrayIdx]?.index ?? null
          }
        }

        if (stationIndex !== null) {
          const station = this.stations[stationIndex]
          if (station) station.hasError = true
        }
      }
    },

    // ─── State Machine ─────────────────────────────────────────────────

    /**
     * Deterministic state resolution.
     *
     * This is the ONLY function that sets `uiState` except LOADING. Priority order:
     *
     *   1. No aircraft loaded        → INITIAL
     *   2. Mandatory fields missing  → UNCONFIGURED
     *   3. Critical notifications    → ERROR_CRITICAL
     *   4. Error notifications       → ERROR_CRITICAL
     *   5. Warning notifications     → WARNING
     *   6. All clear                 → VERIFIED_SAFE
     *
     * LOADING is a transitional state and should not be set by this function.
     *
     * NOTE: The UNVERIFIED state is intentionally not used here. M&B station
     * weights are entered directly by the pilot and require no external-source
     * verification. The `verified` field on StationInput, and the actions
     * `markFieldVerified` / `markAllVerified`, are retained for future modules
     * where fields are auto-populated from external sources (e.g. airport DB,
     * weather) and must be explicitly confirmed per REQ-UI-014 / REQ-AP-005.
     *
     * @see docs/architecture/frontend_state_machine.md §2
     */
    // @IMP-MB-STORE-012@ (FROM: @DES-ARCH-003@, @DES-ARCH-004@, @DES-ARCH-005@)
    evaluateState(): void {
      // Guard: no aircraft loaded
      if (!this.aircraft || !this.activeCategory) {
        this.uiState = 'INITIAL'
        return
      }

      // Mandatory fields not yet populated
      if (!this.allMandatoryFieldsPopulated) {
        this.uiState = 'UNCONFIGURED'
        return
      }

      // Safety violations take priority
      if (this.hasCriticalNotification) {
        this.uiState = 'ERROR_CRITICAL'
        return
      }

      // Validation errors: computation cannot proceed
      if (this.hasErrorNotification) {
        this.uiState = 'ERROR_CRITICAL'
        return
      }

      if (this.hasWarningNotification) {
        this.uiState = 'WARNING'
        return
      }

      // Everything checks out
      this.uiState = 'VERIFIED_SAFE'
    },
  },
})
