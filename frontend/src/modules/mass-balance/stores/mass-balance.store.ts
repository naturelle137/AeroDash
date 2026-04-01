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
    // @IMP-MB-STORE-007@ (FROM: @REQ-MB-001@, @DES-UX-007@)
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
     * Reset all station weights to 0.
     *
     * This is a deliberate user action, so all stations are marked as touched
     * and the calculation re-runs to show the empty-aircraft result.
     */
    // @IMP-MB-STORE-010@ (FROM: @DES-UX-012@)
    resetPayload(): void {
      for (const station of this.stations) {
        station.weight = 0
        station.verified = false
        station.touched = true
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

      // Find the active weighing report (most recent by validFrom)
      const reports = [...this.aircraft.weighingReports].sort((a, b) =>
        b.validFrom.localeCompare(a.validFrom),
      )
      const activeReport = reports[0]
      if (!activeReport) {
        this.notifications = [
          {
            id: 'CRIT-SYS-001',
            severity: 'CRITICAL',
            message: 'No valid weighing report found',
            context: 'System',
          },
        ]
        this.lastResult = null
        return
      }

      const input: MathCoreInput = {
        stations: this.availableStations
          .filter((s) => {
            const def = this.aircraft!.loadPoints[s.index]
            return def && def.fuelTank === null
          })
          .map((s) => {
            const def = this.aircraft!.loadPoints[s.index]!
            return {
              index: s.index,
              mass: s.weight,
              arm: def.arm,
              armLookup: def.armLookup,
            }
          }),
        basicEmptyMass: activeReport.basicEmptyMass,
        emptyCenterOfGravity: activeReport.emptyCg,
        maxTakeoffMass: catDef.maxTakeoffMass,
        maxZeroFuelMass: catDef.maxZeroFuelMass,
        envelope: catDef.envelope,
        graphType: catDef.graphType,
        fuelStations: this.availableStations
          // .filter((_s, _i, _arr) => {
          .filter((_s) => {
            const def = this.aircraft!.loadPoints[_s.index]
            return def && def.fuelTank !== null
          })
          .map((s) => {
            const def = this.aircraft!.loadPoints[s.index]!
            const ft = def.fuelTank!
            return {
              index: s.index,
              mass: s.weight,
              arm: def.arm,
              armLookup: def.armLookup,
              unusableFuel: ft.unusableFuel,
              burnSequences: ft.burnSequences,
            }
          }),
      }

      const result = calculateMassBalance(input)

      // Map raw violations to UI notifications
      // @IMP-MB-STORE-011@ (FROM: @REQ-MB-004@, @REQ-MB-005@, @REQ-MB-009@, @REQ-MB-011@, @REQ-SYS-011@, @REQ-SYS-012@, @DES-UX-010@, @DES-ARCH-001@)
      this.notifications = result.violations.map((v) => {
        switch (v.type) {
          case 'MTOM_EXCEEDED':
            return {
              id: 'CRIT-MB-002',
              severity: 'CRITICAL',
              message: 'MTOM Exceeded',
              context: 'MassBalance.TotalMass',
            }
          case 'MZFM_EXCEEDED':
            return {
              id: 'CRIT-MB-004',
              severity: 'CRITICAL',
              message: 'MZFM Exceeded',
              context: 'MassBalance.ZFM',
            }
          case 'CG_OUT_OF_ENVELOPE':
            return {
              id: 'CRIT-MB-001',
              severity: 'CRITICAL',
              message: 'CG Out of Envelope',
              context: 'MassBalance.CG',
            }
          case 'CG_MIGRATION_EXCEEDED':
            return {
              id: 'CRIT-MB-003',
              severity: 'CRITICAL',
              message: 'CG Migration Limit Exceeded',
              context: 'MassBalance.CG',
            }
          case 'STATION_LIMIT_EXCEEDED':
            return {
              id: 'WARN-MB-005',
              severity: 'WARNING',
              message: `Station ${v.stationIndex ?? ''} limit exceeded`,
              context: 'MassBalance.Stations',
            }
          case 'INVALID_INPUT':
            return {
              id: 'ERR-SYS-001',
              severity: 'ERROR',
              message: `Invalid input: ${v.field ?? 'unknown'} (${v.code ?? 'validation failed'})`,
              context: 'MassBalance.Validation',
            }
          default:
            return {
              id: 'UNKNOWN',
              severity: 'WARNING',
              message: 'Unknown Safety Violation',
              context: 'System',
            }
        }
      })

      this.lastResult = result
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
