# AeroDash Software Requirements - Mass & Balance (MB)

This document defines the mass & balance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
 | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| <!-- @REQ-MB-001@ (FROM: @H-005@, @H-005@) -->  **<a name="REQ-MB-001"></a>REQ-MB-001** | When a certification category is selected (Normal, Utility, Aerobatic), the system shall dynamically update the MTOM, allowed stations, and valid CG envelope boundaries. | Necessary for aircraft with multiple categories (e.g. Klemm 107B), where rear seats are not available in some categories. | P1 | [H-005](../risk_management/safety_hazards.md#H-005) | Approved | n/a |
| <!-- @REQ-MB-002@ -->  **<a name="REQ-MB-002"></a>REQ-MB-002** | When a load station input value is updated, the system shall automatically recalculate the total mass and CG based on the load station inputs. | Fundamental safety calculation for flight stability. | P1 | n/a | Approved | n/a |
| <!-- @REQ-MB-003@ -->  **<a name="REQ-MB-003"></a>REQ-MB-003** | While calculating mass and balance, the system shall update the CG envelope chart synchronously with user input. | Instant situational awareness for the pilot. | P2 | n/a | Approved | n/a |
| <!-- @REQ-MB-004@ (FROM: @H-006@, @H-006@) -->  **<a name="REQ-MB-004"></a>REQ-MB-004** | If the calculated CG is outside the defined aircraft envelope, then the system shall return a Notification: `{ "id": "CRIT-MB-001", "severity": "CRITICAL", "message": "CG Out of Envelope", "context": "MassBalance.CG" }`. | Prevents takeoff in an uncontrollable flight state. | P1 | [H-006](../risk_management/safety_hazards.md#H-006) | Approved | [Notification Scheme](#notificationScheme) |
| <!-- @REQ-MB-005@ -->  **<a name="REQ-MB-005"></a>REQ-MB-005** | If the total mass exceeds MTOM, then the system shall return a Notification: `{ "id": "CRIT-MB-002", "severity": "CRITICAL", "message": "MTOM Exceeded", "context": "MassBalance.TotalMass" }`. | Prevents structural overload and certified limit violation. | P1 | n/a | Approved | [Notification Scheme](#notificationScheme) |
| <!-- @REQ-MB-006@ -->  **<a name="REQ-MB-006"></a>REQ-MB-006** | The mass and balance calculation shall provide the geometric coordinates of the CG Envelope and Load Points. | Visual cross-check against POH diagrams. | P2 | n/a | Approved | n/a |
| <!-- @REQ-MB-007@ -->  **<a name="REQ-MB-007"></a>REQ-MB-007** | When the system calculates valid masses and CG, the system shall verify mass and CG limits using a Point-in-Polygon algorithm to support non-linear, sloped envelopes (polygonal shapes). | Required for modern aircraft (e.g., Diamond DA 40) with variable CG limits. | P1 | n/a | Approved | n/a |
| <!-- @REQ-MB-008@ (FROM: @H-006@, @H-006@) -->  **<a name="REQ-MB-008"></a>REQ-MB-008** | When the user inputs valid load station values, the system shall automatically calculate the CG for both the Take-off state and the Landing state (Zero Fuel / Landing Fuel). | Critical for detecting CG migration that might be safe at takeoff but dangerous at landing (e.g., Klemm). | P1 | [H-006](../risk_management/safety_hazards.md#H-006) | Approved | n/a |
| <!-- @REQ-MB-009@ -->  **<a name="REQ-MB-009"></a>REQ-MB-009** | The system shall calculate and validate the ZFM against the aircraft's MZFM if specified. | Protects wing structural integrity (bending relief limitations). | P1 | n/a | Approved | n/a |
| <!-- @REQ-MB-010@ -->  **<a name="REQ-MB-010"></a>REQ-MB-010** | The system shall output the polygon definition for the CG envelope. | Displays the "history" of the flight's balance in one view. | P2 | n/a | Approved | n/a |
| <!-- @REQ-MB-011@ (FROM: @H-006@, @H-006@) -->  **<a name="REQ-MB-011"></a>REQ-MB-011** | If the CG migration vector exits the envelope at any point, the system shall return a Notification: `{ "id": "CRIT-MB-003", "severity": "CRITICAL", "message": "CG Migration Limit Exceeded", "context": "MassBalance.CG" }`. | Detects mid-flight limit violations before they occur. | P1 | [H-006](../risk_management/safety_hazards.md#H-006) | Approved | [Notification Scheme](#notificationScheme) |
| <!-- @REQ-MB-012@ -->  **<a name="REQ-MB-012"></a>REQ-MB-012** | The system shall calculate moments using either fixed arms or variable moment tables for each loading station. | Flexibility for standard vs. complex station geometry. | P1 | n/a | Approved | n/a |

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
