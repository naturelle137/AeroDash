# Safety Traceability Matrix & Hazard Log

This document serves as the central safety record for the Aviation Performance Tool. It links identified hazards to mitigation requirements and verification steps, following safety-critical design principles for General Aviation software.

## Safety Case Argumentation

"Why is this app safe enough for flight operations?"

The safety of this system is based on four pillars:

1. **Redundancy through Data Verification**: The app uses verified POH data and always provides the pilot with visual feedback loops (e.g., graphical CG representation).
2. **Standardized Calculation Logic**: By implementing FSM 3/75 as a fallback and using bilinear interpolation for table data, mathematical uncertainties are minimized.
3. **Human-Centered Design**: Critical states (warnings) are actively presented to the user (Blinking Red) to avoid misinterpretations under time pressure or fatigue.
4. **Seamless Traceability**: Every identified hazard is covered by a system requirement, which in turn is secured by automated tests (Unit & BDD).

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

| ID | Hazard | Severity | Mitigation (Requirement) | Rationale |
 | :--- | :--- | :---: | :--- | :--- |
| <!-- @H-001@ -->  **<a name="H-001"></a>H-001** | Incorrect mass parameters due to unit confusion (kg, lbs). | S1 | [REQ-SYS-003](../requirements/system.md#REQ-SYS-003), [REQ-AD-014](../requirements/detailed_aircraft_data.md#REQ-AD-014), [REQ-UQ-005](../requirements/usability_quality.md#REQ-UQ-005) | Mixed fleets use different units. |
| <!-- @H-002@ -->  **<a name="H-002"></a>H-002** | Incorrect fuel values due to unit/density confusion (L, Gal, kg, lbs). | S1 | [REQ-SYS-003](../requirements/system.md#REQ-SYS-003), [REQ-FE-001](../requirements/fuel_endurance.md#REQ-FE-001) | Fuel mass vs. volume discrepancies. |
| <!-- @H-003@ -->  **<a name="H-003"></a>H-003** | Incorrect fuel density calculation (AvGas vs JET A-1/Diesel). | S2 | [REQ-AD-003](../requirements/detailed_aircraft_data.md#REQ-AD-003) | DA40 (0.84 kg/L) vs P2008 (0.72 kg/L). |
| <!-- @H-004@ -->  **<a name="H-004"></a>H-004** | Interpolation errors in POH performance tables. | S1 | [REQ-PF-002](../requirements/performance.md#REQ-PF-002) | P2008 has dense table grids; linear math fails. |
| <!-- @H-005@ -->  **<a name="H-005"></a>H-005** | Exceeding limits of a specific Certification Category (Normal vs Utility). | S1 | [REQ-UI-009](../requirements/user_interface.md#REQ-UI-009), [REQ-MB-001](../requirements/mass_balance.md#REQ-MB-001) | KL107 has structural limits based on category. |
| <!-- @H-006@ -->  **<a name="H-006"></a>H-006** | Take-off within limits, but CG shifts out-of-limits for Landing. | S1 | [REQ-UI-010](../requirements/user_interface.md#REQ-UI-010), [REQ-MB-008](../requirements/mass_balance.md#REQ-MB-008), [REQ-MB-004](../requirements/mass_balance.md#REQ-MB-004), [REQ-MB-011](../requirements/mass_balance.md#REQ-MB-011), [REQ-UI-019](../requirements/user_interface.md#REQ-UI-019), [REQ-FE-004](../requirements/fuel_endurance.md#REQ-FE-004) | Hull/swept tanks lead to significant CG shift. |
| <!-- @H-007@ -->  **<a name="H-007"></a>H-007** | Misjudgment of Density Altitude (Hot & High). | S1 | [REQ-PF-010](../requirements/performance.md#REQ-PF-010) | Critical for P2008/DA40 in summer scenarios. |
| <!-- @H-008@ -->  **<a name="H-008"></a>H-008** | Take-off on runway with insufficient length (Go/No-Go failure). | S1 | [REQ-UI-007](../requirements/user_interface.md#REQ-UI-007), [REQ-PF-015](../requirements/performance.md#REQ-PF-015), [REQ-PF-016](../requirements/performance.md#REQ-PF-016) | Ultimate performance failure. |
| <!-- @H-009@ -->  **<a name="H-009"></a>H-009** | Incorrect or omitted surface factor (Wet/Grass/Slope). | S2 | [REQ-AP-004](../requirements/airport_database.md#REQ-AP-004), [REQ-WX-004](../requirements/weather_meterological_data.md#REQ-WX-004), [REQ-WX-005](../requirements/weather_meterological_data.md#REQ-WX-005) | Critical for short unpaved runways. |
| <!-- @H-010@ -->  **<a name="H-010"></a>H-010** | Fuel starvation due to ignorance of Unusable Fuel. | S1 | [REQ-FE-002](../requirements/fuel_endurance.md#REQ-FE-002) | e.g., DA40 Long Range Tanks have high unusable amounts. |
| <!-- @H-011@ -->  **<a name="H-011"></a>H-011** | Data Integrity: Undetected typos in custom POH database. | S1 | [REQ-AC-005](../requirements/aircraft_management.md#REQ-AC-005) | Garbage In, Garbage Out (e.g., wrong MTOM entered). |
| <!-- @H-012@ -->  **<a name="H-012"></a>H-012** | Reckless extrapolation outside certified POH limits. | S1 | [REQ-PF-010](../requirements/performance.md#REQ-PF-010), [REQ-PF-012](../requirements/performance.md#REQ-PF-012) | Using performance data in uncertified regimes (Hot/High). |
| <!-- @H-013@ -->  **<a name="H-013"></a>H-013** | Unsafe performance credit due to optimistic low-end extrapolation. | S1 | [REQ-PF-011](../requirements/performance.md#REQ-PF-011) | Incorrectly calculating shorter distances for extreme cold. |
| <!-- @H-014@ -->  **<a name="H-014"></a>H-014** | Exceeding demonstrated crosswind limits. | S1 | [REQ-WX-009](../requirements/weather_meterological_data.md#REQ-WX-009), [REQ-PF-014](../requirements/performance.md#REQ-PF-014) | Leads to loss of directional control on runway. |
| <!-- @H-015@ -->  **<a name="H-015"></a>H-015** | Inaccurate runway data from unverified Open-Source DBs. | S1 | [REQ-AP-005](../requirements/airport_database.md#REQ-AP-005), [REQ-UI-015](../requirements/user_interface.md#REQ-UI-015), [REQ-DOC-002](../requirements/documentation_export.md#REQ-DOC-002), [REQ-DOC-003](../requirements/documentation_export.md#REQ-DOC-003) | Real TORA might be significantly shorter than DB states. |
| <!-- @H-016@ -->  **<a name="H-016"></a>H-016** | Pilot deliberately bypasses/lowers Operational Safety Factors. | S2 | [REQ-PF-016](../requirements/performance.md#REQ-PF-016), [REQ-UI-017](../requirements/user_interface.md#REQ-UI-017), [REQ-DOC-004](../requirements/documentation_export.md#REQ-DOC-004) | Bypassing EASA 1.25/1.43 to "make the runway fit". |
| <!-- @H-017@ -->  **<a name="H-017"></a>H-017** | Collision with off-airport obstacles due to manual input errors. | S1 | [REQ-PF-009](../requirements/performance.md#REQ-PF-009) | Pilot misjudges Google Maps distances/heights. |
| <!-- @H-018@ -->  **<a name="H-018"></a>H-018** | Loss of pilot night vision in the cockpit. | S3 | [REQ-UI-011](../requirements/user_interface.md#REQ-UI-011) | Bright UI reduces situational awareness during night flights. |
| <!-- @H-019@ -->  **<a name="H-019"></a>H-019** | Operation with outdated or erroneous calculation logic due to PWA caching latency. | S2 | [REQ-SYS-005](../requirements/system.md#REQ-SYS-005), [REQ-SYS-006](../requirements/system.md#REQ-SYS-006), [REQ-UI-013](../requirements/user_interface.md#REQ-UI-013) | Critical bug fixes might not be active immediately due to Service Worker caching if not enforced. |

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
