# AeroDash Software Requirements - Performance (PF)

This document defines the performance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-PF-001@ -->
### REQ-PF-001: Distinct Performance Variables

**Requirement:** The system shall calculate four distinct performance variables for every flight: Takeoff Run (TOR), Takeoff Distance to 50ft (TOD), Landing Roll (LR), and Landing Distance from 50ft (LD).
**Rationale:** Complete performance picture required for phase-specific corrections.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-PF-002@ (FROM: @H-004@) -->
### REQ-PF-002: Bilinear Interpolation

**Requirement:** The system shall determine base performance values via bilinear interpolation of the aircraft's POH tables, utilizing Mass, Pressure Altitude, and Temperature.
**Rationale:** Core engine for certified baseline data.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-PF-003@ -->
### REQ-PF-003: Hierarchical Fallback

**Requirement:** When calculating environmental corrections (wind, surface, slope), the system shall apply a hierarchical fallback: prioritize explicit POH factors, and fall back to standard FSM 3/75 factors only if a specific parameter is undocumented in the POH.
**Rationale:** The Hybrid Engine: Maximizes precision by combining POH specifics with safe, standardized fallbacks for missing data (e.g., wet grass).
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-PF-004@ -->
### REQ-PF-004: Correction Application Isolation

**Requirement:** The system shall apply surface friction and runway slope correction factors exclusively to the ground roll segments (TOR and LR), while Density Altitude and Wind factors shall be applied to the entire distance.
**Rationale:** Mathematical correctness (friction does not affect the airborne climb segment).
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-PF-005@ -->
### REQ-PF-005: Missing Data Estimation

**Requirement:** When the aircraft profile lacks data for either the Ground Roll or the 50ft Distance for takeoff and/or landing, the system shall calculate the missing Base Value by applying a conservative conversion factor derived from UK CAA Safety Sense Leaflet 07 (Takeoff: $TOD = TOR \times 1.9$, Landing: $LD = LR \times 1.67$) before applying any Operational Safety Factor.
**Rationale:** Graceful degradation for legacy handbooks.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-PF-006@ -->
### REQ-PF-006: Operational Required Distance

**Requirement:** The system shall calculate the Operational Required Distance by applying an Operational Safety Factor, allowing the user to select from predefined presets (EASA Standard, POH/AFM Specific, Short Field) or enter a custom numerical multiplier between $1.00$ and $3.00$.
**Rationale:** Translates physical capability into legal/safe operational performance. EASA Standard Takeoff $1.25$, Landing $1.43$, Short Field Landing $1.15$.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-PF-007@ -->
### REQ-PF-007: Safety Margin Calculation

**Requirement:** The system shall calculate the Safety Margin as an absolute value (Available Runway minus Operational Required Distance) and as a percentage.
**Rationale:** Intuitive Go/No-Go decision making.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-PF-008@ -->
### REQ-PF-008: Custom Obstacle Constraints

**Requirement:** The system shall allow the pilot to define custom obstacle constraints (Target Height at a specific Distance) to verify climb gradients over off-airport obstacles.
**Rationale:** Support for local procedures (e.g., road clearances).
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-PF-009@ (FROM: @H-017@) -->
### REQ-PF-009: Unverified Obstacle Notification

**Requirement:** While a pilot-defined obstacle is active, the system shall emit a persistent WARNING notification (`WARN-PF-001`) alerting the pilot that unverified obstacle data is in use.
**Rationale:** Disclaims liability for user-measured Google Maps distances/heights.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-PF-010@ (FROM: @H-007@, @H-012@) -->
### REQ-PF-010: Extrapolation Limits and Penalties

**Requirement:** If extrapolation beyond the POH table limits is required for worse conditions (e.g., higher mass/temp), the system shall limit extrapolation to 10% and apply an additional 20% safety penalty.
**Rationale:** Prevents optimistic data outside the certified envelope.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Conservative Extrapolation Control Contract](../architecture/performance-extrapolation-control.md)

<!-- @REQ-PF-011@ (FROM: @H-013@) -->
### REQ-PF-011: Performance Benefit Capping

**Requirement:** The system shall strictly cap performance benefits at the best-case POH values; calculated distances shall never be shorter than the documented minimums (Minimum Distance Rule).
**Rationale:** Prevents dangerous underestimations in extreme cold or low density altitudes.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Conservative Extrapolation Control Contract](../architecture/performance-extrapolation-control.md)

<!-- @REQ-PF-012@ (FROM: @H-012@) -->
### REQ-PF-012: Extrapolation Acknowledgment

**Requirement:** When extrapolated data is used, the system shall require explicit user confirmation ("Pilot-in-Command acknowledges extrapolated data").
**Rationale:** Legal safety barrier.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Conservative Extrapolation Control Contract](../architecture/performance-extrapolation-control.md)

<!-- @REQ-PF-013@ -->
### REQ-PF-013: Pressure Altitude Formula

**Requirement:** The system shall calculate Pressure Altitude utilizing the formula: PA = Elevation + (1013.25 - QNH) × 30.
**Rationale:** Standardizes the entry parameter for all POH chart lookups.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

### REQ-PF-014

**Status:** Deprecated

<!-- @REQ-PF-015@ (FROM: @H-008@) -->
### REQ-PF-015: Runway Insufficient Notification

**Requirement:** If the Operational Required Distance exceeds the published Available Distance (TORA/LDA), the system shall emit a CRITICAL notification (`CRIT-PF-002`) alerting the pilot that the runway is insufficient for the required distance.
**Rationale:** The ultimate purpose of the tool.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-PF-016@ (FROM: @H-008@, @H-016@) -->
### REQ-PF-016: Low Safety Factor Warning

**Requirement:** If the user-selected Operational Safety Factor is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), then the system shall emit a WARNING notification (`WARN-PF-002`) alerting the pilot that the safety factor is below the recommended minimum.
**Rationale:** Pilot's final descision of safety factors with warning systems if standard safety margins decrease.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-PF-017@ -->
### REQ-PF-017: Estimated Value Marking

**Requirement:** If a performance value is derived using the REQ-PF-005 estimation logic, the system shall flag the result as "ESTIMATED (CAA SSL 07)" in both the user interface and the export documentation.
**Rationale:** Transparency. Ensures the pilot is aware that the values are derived via generic factors and not specific airframe testing.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
