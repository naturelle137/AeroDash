# AeroDash Software Requirements - Fuel & Endurance (FE)

This document defines the fuel & endurance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-FE-001@ (FROM: @H-002@) -->
### REQ-FE-001: Fuel Density Calculation

**Requirement:** When a fuel type is selected, the system shall automatically calculate mass using the specific density of that fuel type: <ul><li>AvGas, MoGas = 0.72 kg/L,</li> <li>Jet A-1, Diesel = 0.84 kg/L.</li></ul>
**Rationale:** Prevents weight errors due to fuel density differences.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-FE-002@ (FROM: @H-010@) -->
### REQ-FE-002: Endurance Calculation

**Requirement:** The system shall calculate maximum flight time (Endurance) based on usable fuel quantity and planned fuel flow rate.
**Rationale:** Essential for flight planning and legal reserves check.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-FE-003@ -->
### REQ-FE-003: Endurance Exceedance Warning

**Requirement:** If the planned flight time (including reserves) exceeds the calculated maximum flight time (Endurance), then the system shall return a Notification: `{ "id": "WARN-FE-001", "severity": "WARNING", "message": "Insufficient Fuel", "context": "Fuel.Endurance" }`.
**Rationale:** Safety alert for insufficient fuel for the planned mission + reserves.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-FE-004@ (FROM: @H-006@) -->
### REQ-FE-004: Fuel Burn Sequence

**Requirement:** When calculating CG for aircraft with defined fuel burn sequences, the system shall drain tanks in the defined order.
**Rationale:** E.g., "First Tank II, then Tank I". Critical for aircraft where fuel burn significantly shifts the CG, e.g. KL07 with forward and rear tank.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-FE-005@ -->
### REQ-FE-005: Landing Mass Estimation

**Requirement:** The system shall allow the user to enter a "Planned Flight Time" or "Trip Fuel" value to calculate the estimated Landing Mass.
**Rationale:** Necessary to determine the "Landing Fuel" state for CG calculation [REQ-MB-008](../requirements/mass_balance.md#REQ-MB-008).
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- None

---
