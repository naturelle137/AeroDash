# Safety Traceability Matrix & Hazard Log

This document serves as the central safety record for the Aviation Performance Tool. It links identified hazards to mitigation requirements and verification steps, following safety-critical design principles for General Aviation software.

## Safety Case Argumentation

"Why is this app safe enough for flight operations?"

The safety of this system is based on four pillars:

1. **Redundancy through Data Verification**: The app uses verified POH data and always provides the pilot with visual feedback loops (e.g., graphical CG representation).
2. **Standardized Calculation Logic**: By implementing FSM 3/75 as a fallback and using bilinear interpolation for table data, mathematical uncertainties are minimized.
3. **Human-Centered Design**: Critical states (warnings) are actively presented to the user (Blinking Red) to avoid misinterpretations under time pressure or fatigue.
4. **Seamless Traceability**: Every identified hazard is covered by a system requirement, which in turn is secured by automated tests (Unit, Integration & BDD).

---

## Severity Level Definitions

| Level | Classification | Definition |
| :--- | :--- | :--- |
| **S1** | **Catastrophic** | Loss of aircraft, fatal injury, or total loss of flight safety. |
| **S2** | **Critical** | Major damage to aircraft, serious injury to personnel or landing outside of airfields (e.g. runway excursion). |
| **S3** | **Major** | Significant reduction in safety margins or functional failure. |
| **S4** | **Minor** | Operational inconvenience or slight reduction in safety margins. |

---

## Hazard Mitigation Index

The table below is the human-readable mirror of the machine-readable index
in [`trace/hazards/hazards.yaml`](../../trace/hazards/hazards.yaml). It
records, per hazard:

- **Status** — `Mitigated` once at least one non-deprecated, `Implemented`
  requirement mitigates the hazard; `Partially Mitigated` when the only
  non-deprecated mitigations are still in `Draft`, `Review`, or `Approved`;
  `Open` when no non-deprecated requirement mitigates the hazard.
- **Mitigated By** — every non-deprecated requirement whose `FROM:` clause
  cites the hazard (deprecated requirements are excluded so a stale
  reference cannot silently un-mitigate a hazard).

A CI assertion in `frontend/scripts/trace/__tests__/hazard-mitigation.spec.ts`
fails the unit-test suite whenever any hazard's set of non-deprecated
mitigating requirements is empty — the v0.3.0-alpha release-audit PR-009
gap that issue #267 closed.

| Hazard | Severity | Status | Mitigated By |
| :----- | :------- | :----- | :----------- |
| H-001 | S1 | Mitigated | REQ-SYS-003, REQ-UQ-005, REQ-AD-014 |
| H-002 | S1 | Mitigated | REQ-FE-001, REQ-SYS-003 |
| H-003 | S2 | Mitigated | REQ-AD-003 |
| H-004 | S1 | Mitigated | REQ-PF-002 |
| H-005 | S1 | Mitigated | REQ-MB-001, REQ-UI-009 |
| H-006 | S1 | Mitigated | REQ-MB-004, REQ-MB-008, REQ-MB-011, REQ-FE-004, REQ-UI-010, REQ-UI-019 |
| H-007 | S1 | Mitigated | REQ-PF-010 |
| H-008 | S2 | Mitigated | REQ-PF-015, REQ-PF-016 |
| H-009 | S2 | Mitigated | REQ-AP-004, REQ-WX-004, REQ-WX-005 |
| H-010 | S1 | Mitigated | REQ-FE-002, REQ-UQ-006 |
| H-011 | S1 | Mitigated | REQ-AC-005, REQ-UI-023, REQ-UQ-006 |
| H-012 | S1 | Mitigated | REQ-PF-010, REQ-PF-012 |
| H-013 | S1 | Mitigated | REQ-PF-011 |
| H-014 | S1 | Mitigated | REQ-WX-009, REQ-AD-017 |
| H-015 | S1 | Mitigated | REQ-AP-005, REQ-DOC-002, REQ-DOC-003, REQ-UI-015 |
| H-016 | S2 | Mitigated | REQ-DOC-004, REQ-PF-016, REQ-UI-017 |
| H-017 | S1 | Mitigated | REQ-PF-009 |
| H-018 | S3 | Mitigated | REQ-UI-011 |
| H-019 | S2 | Mitigated | REQ-SYS-005, REQ-SYS-006, REQ-UI-013 |

## Hazard Log (Critical Hazards)

<!-- @H-001@ -->
### H-001: Mass unit confusion error

**Hazard:** Incorrect mass parameters due to unit confusion (kg, lbs).
**Severity:** S1
**Cause:** Aircraft manufacturers use different units for masses in their POH/AFM.
**Status:** Mitigated
**Mitigated By:** REQ-SYS-003, REQ-UQ-005, REQ-AD-014

<!-- @H-002@ -->
### H-002: Fuel unit confusion error

**Hazard:** Incorrect fuel values due to unit confusion (L, Gal, kg, lbs).
**Severity:** S1
**Cause:** Aircraft manufacturers use different units for fuel mass and volume.
**Status:** Mitigated
**Mitigated By:** REQ-FE-001, REQ-SYS-003

<!-- @H-003@ -->
### H-003: Fuel density confusion

**Hazard:** Incorrect fuel density calculation (AvGas vs JET A-1/Diesel).
**Severity:** S2
**Cause:** Different aircraft use different fuel types.
**Status:** Mitigated
**Mitigated By:** REQ-AD-003

<!-- @H-004@ -->
### H-004: Performance interpolation errors

**Hazard:** Interpolation errors in POH performance tables.
**Severity:** S1
**Cause:** Some aircraft use dense table grids where linear math fails.
**Status:** Mitigated
**Mitigated By:** REQ-PF-002

<!-- @H-005@ -->
### H-005: Certification category limits violation errors

**Hazard:** Exceeding limits of a specific Certification Category (Normal vs Utility).
**Severity:** S1
**Cause:** Some aircraft have structural limits based on their certification category.
**Status:** Mitigated
**Mitigated By:** REQ-MB-001, REQ-UI-009

<!-- @H-006@ -->
### H-006: Errors by CG shift during flight

**Hazard:** Take-off within limits, but CG shifts out-of-limits during flight.
**Severity:** S1
**Cause:** Hull/swept tanks, or multi-tank configurations with different lever arms and alternate burn sequences (Standard vs. Alternative), lead to significant CG shift during flight.
**Status:** Mitigated
**Mitigated By:** REQ-MB-004, REQ-MB-008, REQ-MB-011, REQ-FE-004, REQ-UI-010, REQ-UI-019

<!-- @H-007@ -->
### H-007: Density altitude misjudgment errors

**Hazard:** Misjudgment of Density Altitude (Hot & High).
**Severity:** S1
**Cause:** Critical for P2008/DA40 in summer scenarios.
**Status:** Mitigated
**Mitigated By:** REQ-PF-010

<!-- @H-008@ -->
### H-008: Runway length errors

**Hazard:** Take-off or landing on runway with insufficient length (Go/No-Go failure).
**Severity:** S2
**Cause:** Insufficient or wrong runway data used for calculations.
**Status:** Mitigated
**Mitigated By:** REQ-PF-015, REQ-PF-016

<!-- @H-009@ -->
### H-009: Surface factor errors

**Hazard:** Take-off or landing on runway with insufficient length (Go/No-Go failure).
**Severity:** S2
**Cause:** Incorrect or omitted surface factor (Wet/Grass/Slope).
**Status:** Mitigated
**Mitigated By:** REQ-AP-004, REQ-WX-004, REQ-WX-005

<!-- @H-010@ -->
### H-010: Fuel starvation errors

**Hazard:** Fuel starvation due to ignorance of Unusable Fuel.
**Severity:** S1
**Cause:** Most aircraft tanks have unusable fuel amounts.
**Status:** Mitigated
**Mitigated By:** REQ-FE-002, REQ-UQ-006

<!-- @H-011@ -->
### H-011: Aircraft data integrity errors

**Hazard:** Data Integrity: Undetected typos in custom POH database.
**Severity:** S1
**Cause:** Garbage In, Garbage Out (e.g., wrong MTOM entered).
**Status:** Mitigated
**Mitigated By:** REQ-AC-005, REQ-UI-023, REQ-UQ-006

<!-- @H-012@ -->
### H-012: Performance data extrapolation errors

**Hazard:** Reckless extrapolation outside certified POH limits.
**Severity:** S1
**Cause:** Using performance data in uncertified regimes (Hot/High).
**Status:** Mitigated
**Mitigated By:** REQ-PF-010, REQ-PF-012

<!-- @H-013@ -->
### H-013: Optimistic performance data extrapolation errors

**Hazard:** Unsafe performance credit due to optimistic low-end extrapolation.
**Severity:** S1
**Cause:** Incorrectly calculating shorter distances for extreme cold.
**Status:** Mitigated
**Mitigated By:** REQ-PF-011

<!-- @H-014@ -->
### H-014: Crosswind limits errors

**Hazard:** Exceeding demonstrated crosswind limits.
**Severity:** S1
**Cause:** Pilot's unawareness of crosswind conditions.
**Status:** Mitigated
**Mitigated By:** REQ-WX-009, REQ-AD-017

<!-- @H-015@ -->
### H-015: Runway data errors

**Hazard:** Real available runway lengths might be significantly shorter than DB states.
**Severity:** S1
**Cause:** Inaccurate runway data from unverified Open-Source DBs.
**Status:** Mitigated
**Mitigated By:** REQ-AP-005, REQ-DOC-002, REQ-DOC-003, REQ-UI-015

<!-- @H-016@ -->
### H-016: Operational Safety Factors errors

**Hazard:** Pilot deliberately bypasses/lowers Operational Safety Factors.
**Severity:** S2
**Cause:** Bypassing EASA 1.25/1.43 to "make the runway fit".
**Status:** Mitigated
**Mitigated By:** REQ-DOC-004, REQ-PF-016, REQ-UI-017

<!-- @H-017@ -->
### H-017: Obstacle clearance errors

**Hazard:** Collision with off-airport obstacles due to manual input errors.
**Severity:** S1
**Cause:** Pilot misjudges Google Maps distances/heights.
**Status:** Mitigated
**Mitigated By:** REQ-PF-009

<!-- @H-018@ -->
### H-018: Night vision loss

**Hazard:** Loss of pilot night vision in the cockpit.
**Severity:** S3
**Cause:** Bright UI reduces situational awareness during night flights.
**Status:** Mitigated
**Mitigated By:** REQ-UI-011

<!-- @H-019@ -->
### H-019: PWA caching latency errors

**Hazard:** Operation with outdated or erroneous calculation logic due to PWA caching latency.
**Severity:** S2
**Cause:** Critical bug fixes might not be active immediately due to Service Worker caching if not enforced.
**Status:** Mitigated
**Mitigated By:** REQ-SYS-005, REQ-SYS-006, REQ-UI-013

---

## Edge-Case Test Scenarios (Stress Testing)

> **Traceability Note:**
> The specific algorithmic boundary tests and extreme edge-case scenarios historically defined here have been formally migrated into the User Journeys architecture to support automated BDD traceability.
>
> Please refer to [`docs/journeys/`](../journeys/) for the structured scenarios verifying the hazard mitigations defined above.

---

## Safety-Critical Design Check (UI)

Each design check below is activated into the requirement → implementation →
verification chain. A box is ticked **only** when every linked artifact exists in
the repository (verified by the CI traceability gate). See issue #268 for the
activation history.

- [x] **Blinking Warnings**: Critical alerts (Go/No-Go failures) must be implemented as blinking or high-contrast elements to prevent "Change Blindness."
  - **Requirement:** [REQ-UI-018](../requirements/user_interface.md#req-ui-018-severity-based-notification-rendering) — Severity-Based Notification Rendering (`CRITICAL` ⇒ Blocking Modal / Haptic / Flashing).
  - **Implementation:** `@IMP-MB-UI-003@` (CGEnvelopeChart severity palette), `@IMP-MB-UI-004@` (MassBalanceView state banner with `role="alert"` + `aria-live="assertive"`), `@IMP-MB-UI-FLEET-002@` (reset-payload confirm).
  - **Verification:** `@UT-MB-VIEW-021@` asserts the critical banner (`.state-banner.banner--critical[role="alert"]`) is rendered in `ERROR_CRITICAL` state and removed on recovery.
  - **Hazard linkage:** mitigates the change-blindness contribution to H-008/H-014/H-016 by ensuring Go/No-Go failures present as a high-contrast, assertive alert.
- [x] **Unit-Sticky Labels**: Every input field must display the currently active unit (kg/lbs/L/Gal) statically next to the field; no hidden tooltips or assumptions.
  - **Requirement:** [REQ-UQ-005](../requirements/usability_quality.md#req-uq-005-active-unit-display) — Active Unit Display (`FROM: @H-001@`).
  - **Implementation:** `@IMP-MB-UI-007@` (per-station unit chip in `MassStationInput.vue`), `@IMP-MB-UI-005@` (result summary unit labels in `ResultSummary.vue`).
  - **Verification:** `@UT-MB-UI-002@` asserts the static `.mass-station-input__unit` element is rendered with the active unit (kg/lb) and `aria-label="unit"`.
  - **Hazard linkage:** mitigates [H-001](#h-001-mass-unit-confusion-error) and [H-002](#h-002-fuel-unit-confusion-error) (mass/fuel unit confusion).
- [x] **Zero-Value Check**: Warning if fuel or passenger mass values are unrealistically low or zero (plausibility check).
  - **Scope (this iteration):** the activated chain covers **strict zero** on **mandatory non-fuel** stations only (pilot, crew, passenger). Fuel is intentionally excluded — zero fuel is a legitimate planning state and is already constrained from below by the unusable-fuel floor on `MassStationInput`. "Unrealistically low (non-zero)" mass detection is out of scope for this iteration and is not yet a tracked requirement.
  - **Requirement:** [REQ-UQ-006](../requirements/usability_quality.md#req-uq-006-zero-value-plausibility-check) — Zero-Value Plausibility Check (`FROM: @H-010@, @H-011@`).
  - **Implementation:** `@IMP-MB-STORE-023@` (`_collectPlausibilityWarnings` in the M&B Pinia store, emits the persistent `WARN-UQ-001` notification listing every offending mandatory station by name).
  - **Verification:** `@UT-MB-STORE-060@` (warning fires on load with zero pilot mass), `@UT-MB-STORE-061@` (warning clears once a non-zero mass is entered), `@UT-MB-STORE-062@` (single consolidated advisory lists every offending station), `@UT-MB-STORE-063@` (zero fuel does NOT trip the advisory — legitimate planning state).
  - **Hazard linkage:** mitigates the *occupant-input* contribution to [H-010](#h-010-fuel-starvation-errors) (a zero pilot/passenger mass under-states gross weight, distorting the fuel-burn budget) and to [H-011](#h-011-aircraft-data-integrity-errors) ("garbage-in" mass typo) by surfacing the Go/No-Go-impacting input before it reaches the result. The fuel-quantity contributions to H-010 are addressed separately via the unusable-fuel floor and the fuel/endurance flow.
- [x] **Unverified Data Flagging**: Any data sourced externally (Open-Source Airports) or manually (Obstacles) must be prominently flagged until pilot verification.
  - **Requirements:** [REQ-AC-005](../requirements/aircraft_management.md#req-ac-005-profile-verification-status) (`FROM: @H-011@`, draft profile emits persistent `WARN-AC-002`), [REQ-AP-005](../requirements/airport_database.md#req-ap-005-unverified-state-for-external-data) (`FROM: @H-015@`, externally retrieved airport parameters default to `Unverified`), [REQ-UI-014](../requirements/user_interface.md#req-ui-014-unverified-data-toggle) (per-field Verify toggle), [REQ-UI-015](../requirements/user_interface.md#req-ui-015-unverified-data-export-warning) (`FROM: @H-015@`, `CRIT-UI-001` blocks export/save with unverified data), [REQ-PF-009](../requirements/performance.md#req-pf-009-unverified-obstacle-notification) (persistent `WARN-PF-001` while a pilot-defined obstacle is active).
  - **Implementation:** `@IMP-AC-VIEW-004@` (`ProfileStatusBadge.vue` — visible Draft/Verified badge with role="status"), `@IMP-AC-STORE-005@` (fleet store fires `WARN-AC-002` whenever a draft profile is consumed for calculation).
  - **Verification:** `@UT-AC-VIEW-070@` … `@UT-AC-VIEW-078@` (badge renders Draft vs Verified with distinct CSS class, aria-label, and tooltip referencing "safety-critical"), `@UT-MB-STORE-059@` (WARN-AC-002 fires for draft profile during computation), `@UT-MB-STORE-019@` (WARN-AC-002 absent for verified profile).
  - **Hazard linkage:** mitigates [H-011](#h-011-aircraft-data-integrity-errors) (typo-prone POH data), [H-015](#h-015-runway-data-errors) (unverified open-source airport DB), and the obstacle-data path of [H-017](#h-017-obstacle-clearance-errors).

---

> "Software calculates, the pilot decides – the documentation ensures that the basis for the calculation is correct."
