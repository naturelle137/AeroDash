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

## Hazard Log (Critical Hazards)

<!-- @H-001@ -->
### H-001: Mass unit confusion error

**Hazard:** Incorrect mass parameters due to unit confusion (kg, lbs).
**Severity:** S1
**Cause:** Aircraft manufacturers use different units for masses in their POH/AFM.

<!-- @H-002@ -->
### H-002: Fuel unit confusion error

**Hazard:** Incorrect fuel values due to unit confusion (L, Gal, kg, lbs).
**Severity:** S1
**Cause:** Aircraft manufacturers use different units for fuel mass and volume.

<!-- @H-003@ -->
### H-003: Fuel density confusion

**Hazard:** Incorrect fuel density calculation (AvGas vs JET A-1/Diesel).
**Severity:** S2
**Cause:** Different aircraft use different fuel types.

<!-- @H-004@ -->
### H-004: Performance interpolation errors

**Hazard:** Interpolation errors in POH performance tables.
**Severity:** S1
**Cause:** Some aircraft use dense table grids where linear math fails.

<!-- @H-005@ -->
### H-005: Certification category limits violation errors

**Hazard:** Exceeding limits of a specific Certification Category (Normal vs Utility).
**Severity:** S1
**Cause:** Some aircraft have structural limits based on their certification category.

<!-- @H-006@ -->
### H-006: Errors by CG shift during flight

**Hazard:** Take-off within limits, but CG shifts out-of-limits for Landing.
**Severity:** S1
**Cause:** Hull/swept tanks lead to significant CG shift.

<!-- @H-007@ -->
### H-007: Density altitude misjudgment errors

**Hazard:** Misjudgment of Density Altitude (Hot & High).
**Severity:** S1
**Cause:** Critical for P2008/DA40 in summer scenarios.

<!-- @H-008@ -->
### H-008: Runway length errors

**Hazard:** Take-off or landing on runway with insufficient length (Go/No-Go failure).
**Severity:** S2
**Cause:** Insufficient or wrong runway data used for calculations.

<!-- @H-009@ -->
### H-009: Surface factor errors

**Hazard:** Take-off or landing on runway with insufficient length (Go/No-Go failure).
**Severity:** S2
**Cause:** Incorrect or omitted surface factor (Wet/Grass/Slope).

<!-- @H-010@ -->
### H-010: Fuel starvation errors

**Hazard:** Fuel starvation due to ignorance of Unusable Fuel.
**Severity:** S1
**Cause:** Most aircraft tanks have unusable fuel amounts.

<!-- @H-011@ -->
### H-011: Aircraft data integrity errors

**Hazard:** Data Integrity: Undetected typos in custom POH database.
**Severity:** S1
**Cause:** Garbage In, Garbage Out (e.g., wrong MTOM entered).

<!-- @H-012@ -->
### H-012: Performance data extrapolation errors

**Hazard:** Reckless extrapolation outside certified POH limits.
**Severity:** S1
**Cause:** Using performance data in uncertified regimes (Hot/High).

<!-- @H-013@ -->
### H-013: Optimistic performance data extrapolation errors

**Hazard:** Unsafe performance credit due to optimistic low-end extrapolation.
**Severity:** S1
**Cause:** Incorrectly calculating shorter distances for extreme cold.

<!-- @H-014@ -->
### H-014: Crosswind limits errors

**Hazard:** Exceeding demonstrated crosswind limits.
**Severity:** S1
**Cause:** Pilot's unawareness of crosswind conditions.

<!-- @H-015@ -->
### H-015: Runway data errors

**Hazard:** Real available runway lengths might be significantly shorter than DB states.
**Severity:** S1
**Cause:** Inaccurate runway data from unverified Open-Source DBs.

<!-- @H-016@ -->
### H-016: Operational Safety Factors errors

**Hazard:** Pilot deliberately bypasses/lowers Operational Safety Factors.
**Severity:** S2
**Cause:** Bypassing EASA 1.25/1.43 to "make the runway fit".

<!-- @H-017@ -->
### H-017: Obstacle clearance errors

**Hazard:** Collision with off-airport obstacles due to manual input errors.
**Severity:** S1
**Cause:** Pilot misjudges Google Maps distances/heights.

<!-- @H-018@ -->
### H-018: Night vision loss

**Hazard:** Loss of pilot night vision in the cockpit.
**Severity:** S3
**Cause:** Bright UI reduces situational awareness during night flights.

<!-- @H-019@ -->
### H-019: PWA caching latency errors

**Hazard:** Operation with outdated or erroneous calculation logic due to PWA caching latency.
**Severity:** S2
**Cause:** Critical bug fixes might not be active immediately due to Service Worker caching if not enforced.

---

## Edge-Case Test Scenarios (Stress Testing)

> **Traceability Note:**
> The specific algorithmic boundary tests and extreme edge-case scenarios historically defined here have been formally migrated into the User Journeys architecture to support automated BDD traceability.
>
> Please refer to [`docs/journeys/08_stress_tests.md`](../journeys/08_stress_tests.md) for the structured scenarios (e.g., `UJ-STRESS-001: The Sahara Switch`) verifying the hazard mitigations defined above.

---

## Safety-Critical Design Check (UI)

* [ ] **Blinking Warnings**: Critical alerts (Go/No-Go failures) must be implemented as blinking or high-contrast elements to prevent "Change Blindness."
* [ ] **Unit-Sticky Labels**: Every input field must display the currently active unit (kg/lbs/L/Gal) statically next to the field; no hidden tooltips or assumptions.
* [ ] **Zero-Value Check**: Warning if fuel or passenger mass values are unrealistically low or zero (plausibility check).
* [ ] **Unverified Data Flagging**: Any data sourced externally (Open-Source Airports) or manually (Obstacles) must be prominently flagged until pilot verification.

---

> "Software calculates, the pilot decides – the documentation ensures that the basis for the calculation is correct."
