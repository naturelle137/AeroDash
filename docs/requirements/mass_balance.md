# AeroDash Software Requirements - Mass & Balance (MB)

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **CG** | Center of Gravity |
| **MTOM** | Maximum takeoff mass |
| **MZFM** | Maximum zero fuel mass |
| **ZFM** | Zero fuel mass |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-MB-001">REQ-MB-001</a>** | When a certification category is selected (Normal, Utility, Aerobatic), the system shall dynamically update the MTOM, allowed stations (e.g., disabling rear seats), and valid CG envelope boundaries. | Necessary for aircraft with multiple categories (e.g. Klemm 107B). | P1 | [H-004](../risk_management/safety_hazards.md) | Draft |
| **<a name="REQ-MB-002">REQ-MB-002</a>** | The system shall calculate Total mass and CG based on load station inputs. | Fundamental safety calculation for flight stability. | P1 |  n/a | Draft |
| **<a name="REQ-MB-003">REQ-MB-003</a>** | While in the calculation view, the system shall display a real-time CG envelope chart. | Instant situational awareness for the pilot. | P2 |  n/a | Draft |
| **<a name="REQ-MB-004">REQ-MB-004</a>** | If the calculated CG is outside the defined aircraft envelope, then the system shall display a visual warning. | Prevents takeoff in an uncontrollable flight state. | P1 |  n/a | Draft |
| **<a name="REQ-MB-005">REQ-MB-005</a>** | If the total mass exceeds MTOM, then the system shall display a visual warning in red. | Prevents structural overload and certified limit violation. | P1 |  n/a | Draft |
| **<a name="REQ-MB-006">REQ-MB-006</a>** | The system shall support graphical loading diagram display as an alternative to numerical CG calculation. | Visual cross-check against POH diagrams. | P2 |  n/a | Draft |
| **<a name="REQ-MB-007">REQ-MB-007</a>** | The system shall verify CG limits using a Point-in-Polygon algorithm to support non-linear, sloped envelopes (polygonal shapes). | Required for modern aircraft (e.g., Diamond DA 40) with variable CG limits. | P1 |  n/a | Draft |
| **<a name="REQ-MB-008">REQ-MB-008</a>** | The system shall automatically calculate and display the Center of Gravity for both the Take-off state and the Landing state (Zero Fuel / Landing Fuel) and plot both points within the envelope diagram. | Critical for detecting CG migration that might be safe at takeoff but dangerous at landing (e.g., Klemm). | P1 |  n/a | Draft |
| **<a name="REQ-MB-009">REQ-MB-009</a>** | The system shall calculate and validate the ZFM against the aircraft's MZFM if specified. | Protects wing structural integrity (bending relief limitations). | P2 |  n/a | Draft |
| **<a name="REQ-MB-010">REQ-MB-010</a>** | The system shall render a dynamic CG graph displaying the envelope, the Zero Fuel Point, Take-off Point, and Landing Point, connected by a vector indicating the fuel burn shift. | Displays the "history" of the flight's balance in one view. | P2 |  n/a | Draft |
| **<a name="REQ-MB-011">REQ-MB-011</a>** | If the CG migration vector exits the envelope at any point, the system shall display a warning indicating when the CG becomes out of limits. | Detects mid-flight limit violations before they occur. | P1 |  n/a | Draft |
| **<a name="REQ-MB-012">REQ-MB-012</a>** | The system shall calculate moments using either fixed arms or variable moment tables for each loading station. | Flexibility for standard vs. complex station geometry. | P1 |  n/a | Draft |

---
