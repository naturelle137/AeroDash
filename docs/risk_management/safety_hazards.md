# Flight-preparation hazards

These hazards guide calculation and UX checks; listing a requirement does not prove that a hazard is mitigated or that AeroDash is safe for operational use. Some controls remain future scope in the [roadmap](../development/roadmap.md). Use actual domain-reference and browser evidence, not tags or source presence, to assess behavior.

## Severity Level Definitions

| Level | Classification | Definition |
| :--- | :--- | :--- |
| **S1** | **Catastrophic** | Loss of aircraft, fatal injury, or total loss of flight safety. |
| **S2** | **Critical** | Major damage to aircraft, serious injury to personnel or landing outside of airfields (e.g. runway excursion). |
| **S3** | **Major** | Significant reduction in safety margins or functional failure. |
| **S4** | **Minor** | Operational inconvenience or slight reduction in safety margins. |

---

## Hazard Log (Critical Hazards)

### H-001: Mass unit confusion error

**Hazard:** Incorrect mass parameters due to unit confusion (kg, lbs).
**Severity:** S1
**Cause:** Aircraft manufacturers use different units for masses in their POH/AFM.
**Relevant requirements:** REQ-SYS-003, REQ-UQ-005, REQ-AD-014

### H-002: Fuel unit confusion error

**Hazard:** Incorrect fuel values due to unit confusion (L, Gal, kg, lbs).
**Severity:** S1
**Cause:** Aircraft manufacturers use different units for fuel mass and volume.
**Relevant requirements:** REQ-FE-001, REQ-SYS-003

### H-003: Fuel density confusion

**Hazard:** Incorrect fuel density calculation (AvGas vs JET A-1/Diesel).
**Severity:** S2
**Cause:** Different aircraft use different fuel types.
**Relevant requirements:** REQ-AD-003

### H-004: Performance interpolation errors

**Hazard:** Interpolation errors in POH performance tables.
**Severity:** S1
**Cause:** Some aircraft use dense table grids where linear math fails.
**Relevant requirements:** REQ-PF-002

### H-005: Certification category limits violation errors

**Hazard:** Exceeding limits of a specific Certification Category (Normal vs Utility).
**Severity:** S1
**Cause:** Some aircraft have structural limits based on their certification category.
**Relevant requirements:** REQ-MB-001, REQ-UI-009

### H-006: Errors by CG shift during flight

**Hazard:** Take-off within limits, but CG shifts out-of-limits during flight.
**Severity:** S1
**Cause:** Hull/swept tanks, or multi-tank configurations with different lever arms and alternate burn sequences (Standard vs. Alternative), lead to significant CG shift during flight.
**Relevant requirements:** REQ-MB-004, REQ-MB-008, REQ-MB-011, REQ-FE-004, REQ-UI-010, REQ-UI-019

### H-007: Density altitude misjudgment errors

**Hazard:** Misjudgment of Density Altitude (Hot & High).
**Severity:** S1
**Cause:** Critical for P2008/DA40 in summer scenarios.
**Relevant requirements:** REQ-PF-010, REQ-PF-013

### H-008: Runway length errors

**Hazard:** Take-off or landing on runway with insufficient length (Go/No-Go failure).
**Severity:** S2
**Cause:** Insufficient or wrong runway data used for calculations.
**Relevant requirements:** REQ-PF-015, REQ-PF-016

### H-009: Surface factor errors

**Hazard:** Take-off or landing on runway with insufficient length (Go/No-Go failure).
**Severity:** S2
**Cause:** Incorrect or omitted surface factor (Wet/Grass/Slope).
**Relevant requirements:** REQ-AP-004, REQ-AP-013, REQ-AP-019, REQ-WX-004, REQ-WX-005

### H-010: Fuel starvation errors

**Hazard:** Fuel starvation due to ignorance of Unusable Fuel.
**Severity:** S1
**Cause:** Most aircraft tanks have unusable fuel amounts.
**Relevant requirements:** REQ-FE-002, REQ-UQ-006

### H-011: Aircraft data integrity errors

**Hazard:** Data Integrity: Undetected typos in custom POH database.
**Severity:** S1
**Cause:** Garbage In, Garbage Out (e.g., wrong MTOM entered), including future-dated sign-offs extending the verification window.
**Date mitigation evidence:** REQ-AC-007 rejects future/invalid sign-offs in the store and dialog; the pure evaluator also expires persisted suspect provenance. Deterministic calendar/UTC-boundary tests and browser re-verification cover this path; legacy unattributed records remain a documented residual risk. This is software evidence, not validation of aircraft data.
**Relevant requirements:** REQ-AC-005, REQ-AC-007, REQ-UI-023, REQ-UQ-006

### H-012: Performance data extrapolation errors

**Hazard:** Reckless extrapolation outside certified POH limits.
**Severity:** S1
**Cause:** Using performance data in uncertified regimes (Hot/High).
**Relevant requirements:** REQ-PF-010, REQ-PF-012

### H-013: Optimistic performance data extrapolation errors

**Hazard:** Unsafe performance credit due to optimistic low-end extrapolation.
**Severity:** S1
**Cause:** Incorrectly calculating shorter distances for extreme cold.
**Relevant requirements:** REQ-PF-011

### H-014: Crosswind limits errors

**Hazard:** Exceeding demonstrated crosswind limits.
**Severity:** S1
**Cause:** Pilot's unawareness of crosswind conditions.
**Relevant requirements:** REQ-WX-009, REQ-AD-017

### H-015: Runway data errors

**Hazard:** Real available runway lengths might be significantly shorter than DB states.
**Severity:** S1
**Cause:** Inaccurate runway data from unverified Open-Source DBs.
**Relevant requirements:** REQ-AP-005, REQ-DOC-002, REQ-DOC-003, REQ-UI-015

### H-016: Operational Safety Factors errors

**Hazard:** Pilot deliberately bypasses/lowers Operational Safety Factors.
**Severity:** S2
**Cause:** Bypassing EASA 1.25/1.43 to "make the runway fit".
**Relevant requirements:** REQ-DOC-004, REQ-PF-016, REQ-UI-017

### H-017: Obstacle clearance errors

**Hazard:** Collision with off-airport obstacles due to manual input errors.
**Severity:** S1
**Cause:** Pilot misjudges Google Maps distances/heights.
**Relevant requirements:** REQ-PF-009

### H-018: Night vision loss

**Hazard:** Loss of pilot night vision in the cockpit.
**Severity:** S3
**Cause:** Bright UI reduces situational awareness during night flights.
**Relevant requirements:** REQ-UI-011

### H-019: PWA caching latency errors

**Hazard:** Operation with outdated or erroneous calculation logic due to PWA caching latency.
**Severity:** S2
**Cause:** Critical bug fixes might not be active immediately due to Service Worker caching if not enforced.
**Relevant requirements:** REQ-SYS-005, REQ-SYS-006, REQ-UI-013

---

## Practical checks

Keep units visible; distinguish invalid inputs from limit exceedances; make critical states prominent without relying on color alone. Check required-occupant zero warnings, legitimate optional empty seats, unusable-fuel floors and draft/expired profile notices. For performance, test cap boundaries, penalty/floor behavior, runway comparison and acknowledgement before accepting/exporting extrapolated results.

See [testing](../testing/TESTING.md) and [user journeys](../journeys/README.md). Synthetic vectors establish numerical behavior, not approval of an aircraft’s data.
