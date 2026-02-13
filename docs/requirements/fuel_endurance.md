# AeroDash Software Requirements - Fuel & Endurance (FE)

This document defines the fuel & endurance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-FE-001">REQ-FE-001</a>** | When a fuel type is selected, the system shall automatically calculate mass using the specific density of that fuel type: <ul><li>AvGas, MoGas = 0.72 kg/L,</li> <li>Jet A-1, Diesel = 0.84 kg/L.</li></ul> | Prevents weight errors due to fuel density differences. | P1 |  n/a | Draft |
| **<a name="REQ-FE-002">REQ-FE-002</a>** | The system shall calculate maximum flight time (Endurance) based on usable fuel quantity and planned fuel flow rate. | Essential for flight planning and legal reserves check. | P1 |  n/a | Draft |
| **<a name="REQ-FE-003">REQ-FE-003</a>** | If the planned flight time (including reserves) exceeds the calculated maximum flight time (Endurance), then the system shall display a warning. | Safety alert for insufficient fuel for the planned mission + reserves. | P1 |  n/a | Draft |
| **<a name="REQ-FE-004">REQ-FE-004</a>** | The system shall support sequential fuel burn logic for aircraft with multiple tanks with different arms. | E.g., "First Tank II, then Tank I". Critical for aircraft where fuel burn significantly shifts the CG, e.g. KL07 with forward and rear tank. | P1 |  n/a | Draft |

---
