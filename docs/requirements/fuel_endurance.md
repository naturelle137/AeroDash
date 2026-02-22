# AeroDash Software Requirements - Fuel & Endurance (FE)

This document defines the fuel & endurance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
 | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
<!-- @REQ-FE-001@ (FROM: @H-002@, @H-002@) -->
| **<a name="REQ-FE-001"></a>REQ-FE-001** | When a fuel type is selected, the system shall automatically calculate mass using the specific density of that fuel type: <ul><li>AvGas, MoGas = 0.72 kg/L,</li> <li>Jet A-1, Diesel = 0.84 kg/L.</li></ul> | Prevents weight errors due to fuel density differences. | P1 | [H-002](../risk_management/safety_hazards.md#H-002) | Approved | n/a |
<!-- @REQ-FE-002@ (FROM: @H-010@, @H-010@) -->
| **<a name="REQ-FE-002"></a>REQ-FE-002** | The system shall calculate maximum flight time (Endurance) based on usable fuel quantity and planned fuel flow rate. | Essential for flight planning and legal reserves check. | P1 | [H-010](../risk_management/safety_hazards.md#H-010) | Approved | n/a |
<!-- @REQ-FE-003@ -->
| **<a name="REQ-FE-003"></a>REQ-FE-003** | If the planned flight time (including reserves) exceeds the calculated maximum flight time (Endurance), then the system shall return a Notification: `{ "id": "WARN-FE-001", "severity": "WARNING", "message": "Insufficient Fuel", "context": "Fuel.Endurance" }`. | Safety alert for insufficient fuel for the planned mission + reserves. | P1 | n/a | Approved | [Notification Scheme](#notificationScheme) |
<!-- @REQ-FE-004@ (FROM: @H-006@, @H-006@) -->
| **<a name="REQ-FE-004"></a>REQ-FE-004** | When calculating CG for aircraft with defined fuel burn sequences, the system shall drain tanks in the defined order. | E.g., "First Tank II, then Tank I". Critical for aircraft where fuel burn significantly shifts the CG, e.g. KL07 with forward and rear tank. | P1 | [H-006](../risk_management/safety_hazards.md#H-006) | Approved | n/a |
<!-- @REQ-FE-005@ -->
| **<a name="REQ-FE-005"></a>REQ-FE-005** | The system shall allow the user to enter a "Planned Flight Time" or "Trip Fuel" value to calculate the estimated Landing Mass. | Necessary to determine the "Landing Fuel" state for CG calculation [REQ-MB-008](../requirements/mass_balance.md#REQ-MB-008). | P1 | n/a | Approved | n/a |

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
