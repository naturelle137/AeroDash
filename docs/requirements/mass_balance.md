# AeroDash Software Requirements - Mass & Balance (MB)

This document defines the mass & balance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-MB-001">REQ-MB-001</a>** | When a certification category is selected (Normal, Utility, Aerobatic), the system shall dynamically update the MTOM, allowed stations, and valid CG envelope boundaries. | Necessary for aircraft with multiple categories (e.g. Klemm 107B), where rear seats are not available in some categories. | P1 | [H-005](../risk_management/safety_hazards.md#H-005) | Draft |
| **<a name="REQ-MB-002">REQ-MB-002</a>** | When a load station input value is updated, the system shall automatically recalculate the total mass and CG based on the load station inputs. | Fundamental safety calculation for flight stability. | P1 |  n/a | Draft |
| **<a name="REQ-MB-003">REQ-MB-003</a>** | While calculating mass and balance, the system shall display a real-time CG envelope chart. | Instant situational awareness for the pilot. | P2 |  n/a | Draft |
| **<a name="REQ-MB-004">REQ-MB-004</a>** | If the calculated CG is outside the defined aircraft envelope, then the system shall return a Critical Error State (Red). | Prevents takeoff in an uncontrollable flight state. | P1 | [H-006](../risk_management/safety_hazards.md#H-006) | Draft |
| **<a name="REQ-MB-005">REQ-MB-005</a>** | If the total mass exceeds MTOM, then the system shall return a Critical Error State (Red). | Prevents structural overload and certified limit violation. | P1 |  n/a | Draft |
| **<a name="REQ-MB-006">REQ-MB-006</a>** | The mass and balance calculation shall provide the user a graphical loading diagram display as an alternative to numerical CG calculation. | Visual cross-check against POH diagrams. | P2 |  n/a | Draft |
| **<a name="REQ-MB-007">REQ-MB-007</a>** | When the system calculates valid masses and CG, the system shall verify mass and CG limits using a Point-in-Polygon algorithm to support non-linear, sloped envelopes (polygonal shapes). | Required for modern aircraft (e.g., Diamond DA 40) with variable CG limits. | P1 |  n/a | Draft |
| **<a name="REQ-MB-008">REQ-MB-008</a>** | When the user inputs valid load station values, the system shall automatically calculate and display the CG for both the Take-off state and the Landing state (Zero Fuel / Landing Fuel) and plot both points within the envelope diagram. | Critical for detecting CG migration that might be safe at takeoff but dangerous at landing (e.g., Klemm). | P1 |  [H-006](../risk_management/safety_hazards.md#H-006) | Draft |
| **<a name="REQ-MB-009">REQ-MB-009</a>** | The system shall calculate and validate the ZFM against the aircraft's MZFM if specified. | Protects wing structural integrity (bending relief limitations). | P1 |  n/a | Draft |
| **<a name="REQ-MB-010">REQ-MB-010</a>** | The system shall generate a visual representation of the CG envelope containing the ZFM, TOM, and Landing Mass points. | Displays the "history" of the flight's balance in one view. | P2 |  n/a | Draft |
| **<a name="REQ-MB-011">REQ-MB-011</a>** | If the CG migration vector exits the envelope at any point, the system shall return a Critical Error State (Red). | Detects mid-flight limit violations before they occur. | P1 |  [H-006](../risk_management/safety_hazards.md#H-006) | Draft |
| **<a name="REQ-MB-012">REQ-MB-012</a>** | The system shall calculate moments using either fixed arms or variable moment tables for each loading station. | Flexibility for standard vs. complex station geometry. | P1 |  n/a | Draft |

---
