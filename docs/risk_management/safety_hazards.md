# Safety Traceability Matrix & Hazard Log

This document serves as the central safety record for the Aviation Performance Tool. It links identified hazards to mitigation requirements and verification steps, following safety-critical design principles for General Aviation software.

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| BDD | Behavior driven development |
| CG | Center of gravity |
| FSM | DE: Flugsicherheitsmitteilung (EN: Flight safety notification) |
| LM | Landing mass |
| TOM | Takeoff mass |
| ZFM | Zero fuel mass |
|  |  |

---

## Safety Case Argumentation

**"Why is this app safe enough for flight operations?"**

The safety of this system is based on four pillars:
1. **Redundancy through Data Verification**: The app uses verified POH data and always provides the pilot with visual feedback loops (e.g., graphical CG representation).
2. **Standardized Calculation Logic**: By implementing FSM 3/75 as a fallback and using bilinear interpolation for table data, mathematical uncertainties are minimized.
3. **Human-Centered Design**: Critical states (warnings) are actively presented to the user (Blinking Red) to avoid misinterpretations under time pressure or fatigue.
4. **Seamless Traceability**: Every identified hazard is covered by a system requirement, which in turn is secured by automated tests (Unit & BDD).

---

## Severity Level Definitions

| Level | Classification | Definition |
|:---|:---|:---|
| **S1** | **Catastrophic** | Loss of aircraft, fatal injury, or total loss of flight safety. |
| **S2** | **Critical** | Major damage to aircraft, serious injury to personnel or landing outside of airfields. |
| **S3** | **Major** | Significant reduction in safety margins or functional failure. |
| **S4** | **Minor** | Operational inconvenience or slight reduction in safety margins. |

---

## Hazard Log (Critical Hazards)

| ID | Hazard | Severity | Mitigation (Requirement) | Rationale |
|---|---|---|---|---|---|
| **<a name="H-001">H-001</a>** | Incorrect TOM, ZFM, LM or CG due to mass unit confusion (kg, lbs). | **S1** | [REQ-SYS-03](../requirements/system.md) | Mixed fleets with different units used by manufacturers. |
| **<a name="H-002">H-002</a>** | Incorrect TOM, ZFM, LM or CG due to fuel unit confusion (l, gal, kg, lbs). | **S1** | [RUQ-04], [REQ-SYS-03](../requirements/system.md) | Mixed fleets with different units and fuel mass vs. volume used by manufacturers. |
| **<a name="H-003">H-003</a>** | Incorrect fuel weight (AvGas vs JET A-1) | **S2** | [REQ-FE-01], [REQ-AD-02] | DA40 Diesel (0.84kg/L) vs P2008/KL107 (0.72kg/L). |
| **<a name="H-004">H-004</a>** | Interpolation errors in POH tables | **S1** | [REQ-PF-12], [REQ-PF-17] | P2008 has dense table grids. |
| **<a name="H-005">H-005</a>** | Incorrect Weight Category (Normal vs Utility) | **S2** | [REQ-AD-14] | KL107 is dual-certified (940kg vs 830kg). |
| **<a name="H-006">H-006</a>** | Takeoff within limits, but Landing outside CG limits | **S1** | [REQ-MB-10], [REQ-MB-07] | KL107 hull tanks lead to significant CG shift. |
| **<a name="H-007">H-007</a>** | Misjudgment of Density Altitude (Hot & High) | **S1** | [REQ-PF-05], [REQ-PF-13] | P2008/DA40 critical in summer scenarios. |
| **<a name="H-008">H-008</a>** | Takeoff on runway with insufficient length (Safety factor forgotten) | **S1** | [REQ-PF-06], [REQ-PF-09] | All types for short grass runways. |
| **<a name="H-009">H-009</a>** | Incorrect surface factor (Wet/Soft) | **S2** | [REQ-WX-03], [REQ-PF-18] | Safety relevance in rain (METAR link). |
| **<a name="H-010">H-010</a>** | Fuel starvation/loss due to ignorance of unusable fuel | **S1** | [REQ-AD-16], [REQ-FE-02] | DA40 Long Range Tanks (7.6L unusable). |
| **<a name="H-011">H-011</a>** | Data Integrity: Typos in POH database | **S2** | [REQ-AC-005](../requirements/aircraft_management.md#REQ-AC-005) | Manual entry errors during profile creation. |
| **<a name="H-012">H-012</a>** | Extrapolation outside POH limits | **S1** | [REQ-PF-13], [REQ-PF-14], [REQ-PF-15] | Using performance data in uncertified regimes (Hot/High). |
| **<a name="H-013">H-013</a>** | CG shift leading to Out-of-CG at landing | **S1** | [REQ-MB-07], [REQ-UI-09] | KL107 hull tanks or DA40 long range fuel scenarios. |
| **<a name="H-014">H-014</a>** | Unsafe performance credit due to optimistic extrapolation | **S1** | [REQ-PF-13], [REQ-PF-17] | Incorrectly shorter distances for low Temp/Alt. |
| **<a name="H-015">H-015</a>** | Exceeding demonstrated crosswind limits | **S1** | [REQ-PF-21], [REQ-WX-06] | Pilot ignores high crosswind components for chosen runway. |

---

## Edge-Case Test Scenarios (Stress Testing) - DRAFT

1. **"The Sahara Switch"**: Input of +50°C and 5000ft elevation. Check if the system aborts the performance calculation with a clear warning or extrapolates correctly (if POH compliant).
2. **"Burn-out Shift (H-12)"**: Setup of a flight with maximum passenger load and minimum fuel, where the CG fits at takeoff, but shifts behind the limit due to burning the last fuel before landing ("Burn out"). Validation of REQ-MB-07 and REQ-UI-09 trend line.
3. **"Boundary Breach (H-11)"**: Attempting a takeoff calculation for a temperature or weight exactly 11% above the POH table maximum. Validation that the system blocks the calculation.
4. **"Penalty Application"**: Attempting a takeoff calculation exactly 5% above the POH table maximum. Validation that the 20% penalty (REQ-PF-14) is applied and the UI warning (REQ-PF-15) is displayed.
5. **"Minimum Distance (H-13)"**: Input conditions better than POH minimums (e.g., -20°C). Validation that the system uses the POH boundary distance (REQ-PF-17) and does not calculate shorter values.
6. **"Crosswind Exceedance (H-14)"**: Input METAR wind with 20kt crosswind for a DA40 (15kt limit). Validation that REQ-PF-21 triggers a critical alert and correctly identifies the component.
7. **"Mixed Fleet Nightmare"**: Simultaneous loading of a DA40 profile (Imperial inputs for fuel) and calculation in a metric system environment. Validation of SI normalization.

---

## Safety-Critical Design Check (UI) - DRAFT

* [ ] **Blinking Warnings**: REQ-PF-09 must be implemented in the UI as a blinking element to prevent "Change Blindness."
* [ ] **Unit-Sticky Labels**: Every input field must display the currently active unit (kg/lbs/L/Gal) statically next to the field; no hidden tooltips.
* [ ] **Zero-Value Check**: Warning if fuel or passenger values are unrealistically low/high (plausibility check).

---
> "Software calculates, the pilot decides – the documentation ensures that the basis for the calculation is correct."
