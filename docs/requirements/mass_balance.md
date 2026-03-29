# AeroDash Software Requirements - Mass & Balance (MB)

This document defines the mass & balance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-MB-001@ (FROM: @H-005@) -->

### REQ-MB-001: Dynamic Envelope Updates

**Requirement:** When a certification category is selected (Normal, Utility, Aerobatic), the system shall dynamically update the MTOM, allowed stations, and valid CG envelope boundaries.
**Rationale:** Necessary for aircraft with multiple categories (e.g. Klemm 107B), where rear seats are not available in some categories.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-MB-002@ -->

### REQ-MB-002: Automatic CG Recalculation

**Requirement:** When a load station input value is updated, the system shall automatically recalculate the total mass and CG based on the load station inputs.
**Rationale:** Fundamental safety calculation for flight stability.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-MB-003@ -->

### REQ-MB-003: Synchronous Chart Updates

**Requirement:** While calculating mass and balance, the system shall update the CG envelope chart synchronously with user input.
**Rationale:** Instant situational awareness for the pilot.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-MB-004@ (FROM: @H-006@) -->

### REQ-MB-004: Out of Envelope Notification

**Requirement:** If the calculated CG is outside the defined aircraft envelope, then the system shall return a Notification: `{ "id": "CRIT-MB-001", "severity": "CRITICAL", "message": "CG Out of Envelope", "context": "MassBalance.CG" }`.
**Rationale:** Prevents takeoff in an uncontrollable flight state.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-MB-005@ -->

### REQ-MB-005: MTOM Exceedance Notification

**Requirement:** If the total mass exceeds MTOM, then the system shall return a Notification: `{ "id": "CRIT-MB-002", "severity": "CRITICAL", "message": "MTOM Exceeded", "context": "MassBalance.TotalMass" }`.
**Rationale:** Prevents structural overload and certified limit violation.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-MB-006@ -->

### REQ-MB-006: Geometric Node Extraction

**Requirement:** The mass and balance calculation shall provide the geometric coordinates of the CG Envelope and Load Points.
**Rationale:** Visual cross-check against POH diagrams.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-MB-007@ -->

### REQ-MB-007: Polygon Bounds Verification

**Requirement:** When the system calculates valid masses and CG, the system shall verify mass and CG limits using a Point-in-Polygon algorithm to support non-linear, sloped envelopes (polygonal shapes).
**Rationale:** Required for modern aircraft (e.g., Diamond DA 40) with variable CG limits.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-MB-008@ (FROM: @H-006@) -->

### REQ-MB-008: Take-off and Landing CG

**Requirement:** When the user inputs valid load station values, the system shall automatically calculate the CG for the Take-off state and the Landing state. For aircraft with multiple fuel burn sequences, the system shall additionally calculate intermediate CG waypoints at each tank-transition boundary for each named sequence, producing the vertices of a burn-down polygon that encompasses all possible CG positions during fuel consumption.
**Rationale:** Critical for detecting CG migration that might be safe at takeoff but dangerous during flight. For aircraft with tanks at different lever arms (e.g., KL107B), a simple two-point calculation is insufficient — the CG path diverges depending on the active burn sequence.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-MB-009@ -->

### REQ-MB-009: MZFM Validation

**Requirement:** The system shall calculate and validate the ZFM against the aircraft's MZFM if specified. If the ZFM exceeds the MZFM, then the system shall return a Notification: `{ "id": "CRIT-MB-004", "severity": "CRITICAL", "message": "MZFM Exceeded", "context": "MassBalance.ZFM" }`.
**Rationale:** Protects wing structural integrity (bending relief limitations).
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-MB-010@ -->

### REQ-MB-010: Polygon Definition Output

**Requirement:** The system shall output the polygon definition for the CG envelope.
**Rationale:** Displays the "history" of the flight's balance in one view.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-MB-011@ (FROM: @H-006@) -->

### REQ-MB-011: CG Migration Exceedance

**Requirement:** If the CG migration region (trend line for single-sequence aircraft, or burn-down polygon for multi-sequence aircraft) exits the envelope at any point, the system shall return a Notification: `{ "id": "CRIT-MB-003", "severity": "CRITICAL", "message": "CG Migration Limit Exceeded", "context": "MassBalance.CG" }`.
**Rationale:** Detects mid-flight limit violations before they occur. A single-line check is insufficient for multi-tank aircraft where different burn sequences produce divergent CG paths.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-MB-012@ -->

### REQ-MB-012: Variable Moment Calculation

**Requirement:** The system shall calculate moments using either fixed arms or variable moment tables for each loading station.
**Rationale:** Flexibility for standard vs. complex station geometry.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
