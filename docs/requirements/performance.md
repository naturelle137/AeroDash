# AeroDash Software Requirements - Performance (PF)

This document defines the performance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **n/a** | n/a |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| <a name="REQ-PF-001">REQ-PF-001</a> | The system shall calculate four distinct performance variables for every flight: Takeoff Run (TOR), Takeoff Distance to 50ft (TOD), Landing Roll (LR), and Landing Distance from 50ft (LD). | Complete performance picture required for phase-specific corrections. | P1 | n/a | Draft |
| <a name="REQ-PF-002">REQ-PF-002</a> | The system shall determine base performance values via bilinear interpolation of the aircraft's POH tables, utilizing Mass, Pressure Altitude, and Temperature. | Core engine for certified baseline data. | P1 | n/a | Draft |
| <a name="REQ-PF-003">REQ-PF-003</a> | When calculating environmental corrections (wind, surface, slope), the system shall apply a hierarchical fallback: prioritize explicit POH factors, and fall back to standard FSM 3/75 factors only if a specific parameter is undocumented in the POH. | The Hybrid Engine: Maximizes precision by combining POH specifics with safe, standardized fallbacks for missing data (e.g., wet grass). | P1 | n/a | Draft |
| <a name="REQ-PF-004">REQ-PF-004</a> | The system shall apply surface friction and runway slope correction factors exclusively to the ground roll segments (TOR and LR), while Density Altitude and Wind factors shall be applied to the entire distance. | Mathematical correctness (friction does not affect the airborne climb segment). | P1 | n/a | Draft |
| <a name="REQ-PF-005">REQ-PF-005</a> | If the aircraft profile lacks data for either the Ground Roll or the 50ft Distance, then the system shall estimate the missing value by applying a standard conservative multiplier to the available value. | Graceful degradation for legacy handbooks (e.g., TOD = TOR x 1.3). | P1 | n/a | Draft |
| <a name="REQ-PF-006">REQ-PF-006</a> | The system shall calculate the Operational Required Distance by applying an Operational Safety Factor, allowing the user to select from predefined presets (EASA Standard, POH/AFM Specific, Short Field) or enter a custom numerical multiplier. | Translates physical capability into legal/safe operational performance. EASA Standard Takeoff 1.25, Landing 1.43, Short Field Landing 1.15. | P1 | n/a | Draft |
| <a name="REQ-PF-007">REQ-PF-007</a> | The system shall calculate and display the Safety Margin as an absolute value (Available Runway minus Operational Required Distance) and as a percentage. | Intuitive Go/No-Go decision making. | P2 | n/a | Draft |
| <a name="REQ-PF-008">REQ-PF-008</a> | The system shall allow the pilot to define custom obstacle constraints (Target Height at a specific Distance) to verify climb gradients over off-airport obstacles. | Support for local procedures (e.g., road clearances). | P2 | n/a | Draft |
| <a name="REQ-PF-009">REQ-PF-009</a> | While a pilot-defined obstacle is active, the system shall evaluate the clearance and display a highly visible "Unverified / Pilot Entered Data" disclaimer. | Disclaims liability for user-measured Google Maps distances/heights. | P1 | n/a | Draft |
| <a name="REQ-PF-010">REQ-PF-010</a> | If extrapolation beyond the POH table limits is required for worse conditions (e.g., higher mass/temp), the system shall limit extrapolation to 10% and apply an additional 20% safety penalty. | Prevents optimistic data outside the certified envelope. | P1 | n/a | Draft |
| <a name="REQ-PF-011">REQ-PF-011</a> | The system shall strictly cap performance benefits at the best-case POH values; calculated distances shall never be shorter than the documented minimums (Minimum Distance Rule). | Prevents dangerous underestimations in extreme cold or low density altitudes. | P1 | n/a | Draft |
| <a name="REQ-PF-012">REQ-PF-012</a> | When extrapolated data is used, the system shall require explicit user confirmation ("Pilot-in-Command acknowledges extrapolated data"). | Legal safety barrier. | P1 | n/a | Draft |
| <a name="REQ-PF-013">REQ-PF-013</a> | The system shall calculate Pressure Altitude utilizing the formula: PA = Elevation + (1013.25 - QNH) × 30. | Standardizes the entry parameter for all POH chart lookups. | P1 | n/a | Draft |
| <a name="REQ-PF-014">REQ-PF-014</a> | If the calculated crosswind or tailwind component exceeds the POH demonstrated limits, the system shall display a critical operational warning. | High-risk hazard mitigation. | P1 | n/a | Draft |
| <a name="REQ-PF-015">REQ-PF-015</a> | If the Operational Required Distance exceeds the published Available Distance (TORA/LDA), the system shall display a flashing red Go/No-Go critical alert. | The ultimate purpose of the tool. | P1 | H-008 | Draft |
| <a name="REQ-PF-016">REQ-PF-016</a> | If the user-selected Operational Safety Factor is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), then the system shall display a visual warning. | Pilot's final descision of safety factors with warning systems if standard safety margins decrease. | P1 | H-008 | Draft |

---
