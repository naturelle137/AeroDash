# System Stress Tests (Boundary Conditions)

This document defines the critical User Journeys simulating edge-cases and algorithmic boundary conditions. These scenarios are designed to stress-test the application's core mathematical limits and ensure that safety mechanisms (e.g., UI Warnings, Calculation Blocks) are triggered appropriately.

These scenarios trace directly back to the mitigations defined in the `safety_hazards.md` document and serve as the foundation for our Unit/E2E BDD verification.

---

## Stress Test Journeys

### UJ-STRESS-001: The Sahara Switch (Temperature Boundary)

* **Hazard Traced:** [H-012](../risk_management/safety_hazards.md#H-012)
* **Goal:** Verify that the system handles extreme high-temperature scenarios correctly, either by applying a safety penalty (if within allowable 10% extrapolation limits) or blocking the calculation entirely.
* **Scenario:** Pilot inputs +50°C and 5000ft elevation. The calculation should dynamically assess the Performance envelope and either abort with a clear warning, or extrapolate with a mathematically verified penalty.

### UJ-STRESS-002: Burn-out Shift (Aft CG Validation)

* **Hazard Traced:** [H-006](../risk_management/safety_hazards.md#H-006)
* **Goal:** Verify that the dynamic Center of Gravity (CG) logic tracks fuel burn over time and flags an out-of-balance condition that occurs *after* takeoff.
* **Scenario:** Pilot configures a flight with maximum passenger load and minimum fuel. While the Takeoff CG is within limits, the Landing CG shifts behind the aft limit due to fuel burn. The system must display a critical warning and show the trend line exiting the envelope.

### UJ-STRESS-003: Boundary Breach (Strict Blocking)

* **Hazard Traced:** [H-012](../risk_management/safety_hazards.md#H-012)
* **Goal:** Verify that the system refuses to extrapolate data beyond the strictly permitted mathematical boundaries.
* **Scenario:** Pilot attempts a takeoff calculation for a temperature exactly 11% above the POH table maximum. The system must strictly block the calculation and render an error.

### UJ-STRESS-004: Penalty Application (Conditional Extrapolation)

* **Hazard Traced:** [H-012](../risk_management/safety_hazards.md#H-012)
* **Goal:** Verify that permitted extrapolations automatically apply the required regulatory safety penalties.
* **Scenario:** Pilot attempts a calculation exactly 5% above the table max. The system must apply the required 20% safety penalty to the distance and visibly display a UI warning regarding the extrapolation.

### UJ-STRESS-005: Minimum Distance Rule (Floor Imposition)

* **Hazard Traced:** [H-013](../risk_management/safety_hazards.md#H-013)
* **Goal:** Verify that optimistic "low-end" data does not result in an unsafe reduction of required runway distance.
* **Scenario:** Pilot inputs conditions significantly better than POH minimums (e.g., -30°C density altitude). The system must floor the calculation at the lowest mapped POH boundary distance and never output a shorter value.

### UJ-STRESS-006: Crosswind Exceedance (Weather Interaction)

* **Hazard Traced:** [H-014](../risk_management/safety_hazards.md#H-014)
* **Goal:** Verify that live meteorological data correctly flags aerodynamic structural limits.
* **Scenario:** System ingests METAR wind data proving a 20kt crosswind for an aircraft with a maximum demonstrated 15kt limit. A critical No-Go alert must be triggered.

### UJ-STRESS-007: Mixed Fleet Nightmare (Unit Normalization)

* **Hazard Traced:** [H-001](../risk_management/safety_hazards.md#H-001), [H-002](../risk_management/safety_hazards.md#H-002)
* **Goal:** Verify the flawless normalization of Imperial to Metric units within the internal SI reference frame.
* **Scenario:** Pilot loads an imperial aircraft profile (lbs/Gal) into an environment globally configured for metric. The system must flawlessly convert and calculate the mass and balance without rounding errors.

### UJ-STRESS-008: The "Make-it-Fit" Override (Regulatory Blocks)

* **Hazard Traced:** [H-016](../risk_management/safety_hazards.md#H-016)
* **Goal:** Verify that the system protects the pilot from bypassing minimum operational safety factors.
* **Scenario:** Pilot attempts to manually set the Take-off Safety Factor to 1.0 (removing the EASA 1.25 buffer) to force a calculation to fit into a short runway. The system must warn the pilot against violating minimum regulatory standard practices.
