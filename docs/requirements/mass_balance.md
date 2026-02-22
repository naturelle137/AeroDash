# AeroDash Software Requirements - Mass & Balance (MB)

This document defines the mass & balance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-MB-001@ (FROM: @H-005@, @H-005@) -->
### REQ-MB-001

**Requirement:** When a certification category is selected (Normal, Utility, Aerobatic), the system shall dynamically update the MTOM, allowed stations, and valid CG envelope boundaries.
**Rationale:** Necessary for aircraft with multiple categories (e.g. Klemm 107B), where rear seats are not available in some categories.
**Priority:** P1
**Mitigation Hazard:** [H-005](../risk_management/safety_hazards.md#H-005)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-002@ -->
### REQ-MB-002

**Requirement:** When a load station input value is updated, the system shall automatically recalculate the total mass and CG based on the load station inputs.
**Rationale:** Fundamental safety calculation for flight stability.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-003@ -->
### REQ-MB-003

**Requirement:** While calculating mass and balance, the system shall update the CG envelope chart synchronously with user input.
**Rationale:** Instant situational awareness for the pilot.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-004@ (FROM: @H-006@, @H-006@) -->
### REQ-MB-004

**Requirement:** If the calculated CG is outside the defined aircraft envelope, then the system shall return a Notification: `{ "id": "CRIT-MB-001", "severity": "CRITICAL", "message": "CG Out of Envelope", "context": "MassBalance.CG" }`.
**Rationale:** Prevents takeoff in an uncontrollable flight state.
**Priority:** P1
**Mitigation Hazard:** [H-006](../risk_management/safety_hazards.md#H-006)
**Status:** Approved
**Design Reference:** [Notification Scheme](#notificationScheme)

<!-- @REQ-MB-005@ -->
### REQ-MB-005

**Requirement:** If the total mass exceeds MTOM, then the system shall return a Notification: `{ "id": "CRIT-MB-002", "severity": "CRITICAL", "message": "MTOM Exceeded", "context": "MassBalance.TotalMass" }`.
**Rationale:** Prevents structural overload and certified limit violation.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** [Notification Scheme](#notificationScheme)

<!-- @REQ-MB-006@ -->
### REQ-MB-006

**Requirement:** The mass and balance calculation shall provide the geometric coordinates of the CG Envelope and Load Points.
**Rationale:** Visual cross-check against POH diagrams.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-007@ -->
### REQ-MB-007

**Requirement:** When the system calculates valid masses and CG, the system shall verify mass and CG limits using a Point-in-Polygon algorithm to support non-linear, sloped envelopes (polygonal shapes).
**Rationale:** Required for modern aircraft (e.g., Diamond DA 40) with variable CG limits.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-008@ (FROM: @H-006@, @H-006@) -->
### REQ-MB-008

**Requirement:** When the user inputs valid load station values, the system shall automatically calculate the CG for both the Take-off state and the Landing state (Zero Fuel / Landing Fuel).
**Rationale:** Critical for detecting CG migration that might be safe at takeoff but dangerous at landing (e.g., Klemm).
**Priority:** P1
**Mitigation Hazard:** [H-006](../risk_management/safety_hazards.md#H-006)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-009@ -->
### REQ-MB-009

**Requirement:** The system shall calculate and validate the ZFM against the aircraft's MZFM if specified.
**Rationale:** Protects wing structural integrity (bending relief limitations).
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-010@ -->
### REQ-MB-010

**Requirement:** The system shall output the polygon definition for the CG envelope.
**Rationale:** Displays the "history" of the flight's balance in one view.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-011@ (FROM: @H-006@, @H-006@) -->
### REQ-MB-011

**Requirement:** If the CG migration vector exits the envelope at any point, the system shall return a Notification: `{ "id": "CRIT-MB-003", "severity": "CRITICAL", "message": "CG Migration Limit Exceeded", "context": "MassBalance.CG" }`.
**Rationale:** Detects mid-flight limit violations before they occur.
**Priority:** P1
**Mitigation Hazard:** [H-006](../risk_management/safety_hazards.md#H-006)
**Status:** Approved
**Design Reference:** [Notification Scheme](#notificationScheme)

<!-- @REQ-MB-012@ -->
### REQ-MB-012

**Requirement:** The system shall calculate moments using either fixed arms or variable moment tables for each loading station.
**Rationale:** Flexibility for standard vs. complex station geometry.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
