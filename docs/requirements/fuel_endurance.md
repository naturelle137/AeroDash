# AeroDash Software Requirements - Fuel & Endurance (FE)

This document defines the fuel & endurance behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-FE-001@ (FROM: @H-002@) -->
### REQ-FE-001: Fuel Density Calculation

**Requirement:** When a fuel type is selected, the system shall automatically calculate mass using the specific density of that fuel type: <ul><li>AvGas, MoGas = 0.72 kg/L,</li> <li>Jet A-1, Diesel = 0.84 kg/L.</li></ul>
**Rationale:** Prevents weight errors due to fuel density differences.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-FE-002@ (FROM: @H-010@) -->
### REQ-FE-002: Endurance Calculation

**Requirement:** The system shall calculate maximum flight time (Endurance) based on usable fuel quantity and planned fuel flow rate.
**Rationale:** Essential for flight planning and legal reserves check.
**Priority:** P1
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-FE-003@ -->
### REQ-FE-003: Endurance Exceedance Warning

**Requirement:** If the planned flight time (including reserves) exceeds the calculated maximum flight time (Endurance), then the system shall emit a WARNING notification (`WARN-FE-001`) alerting the pilot about insufficient fuel for the planned mission.
**Rationale:** Safety alert for insufficient fuel for the planned mission + reserves.
**Priority:** P1
**Status:** Deferred
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-FE-004@ (FROM: @H-006@) -->
### REQ-FE-004: Fuel Burn Sequence

**Requirement:** When calculating fuel consumption for aircraft with defined fuel burn sequences, the system shall drain tanks in the order specified by each named sequence (e.g., `Standard`, `Alternative`). For aircraft with multiple named sequences, the system shall compute the fuel state progression for **each** sequence independently.
**Rationale:** Aircraft with multiple tanks at different lever arms (e.g., KL107B: Tank I at 2.47 m, Tank II at 2.80 m) have different CG migration paths depending on the burn order. The Standard sequence (Tank II → Tank I) and the Alternative sequence (Tank I → Tank II) produce divergent CG paths whose boundary defines the burn-down polygon.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-FE-005@ -->
### REQ-FE-005: Landing Mass Estimation

**Requirement:** The system shall allow the user to enter a "Planned Flight Time" or "Trip Fuel" value to calculate the estimated Landing Mass.
**Rationale:** Necessary to determine the "Landing Fuel" state for CG calculation [REQ-MB-008](../requirements/mass_balance.md#REQ-MB-008).
**Priority:** P1
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-FE-006@ (FROM: @REQ-AD-020@, @REQ-AD-021@) -->

### REQ-FE-006: Electric Endurance Card

**Requirement:** While the selected aircraft's `powertrain` is `electric`, the Mass & Balance view shall label the Fuel & Endurance card `Energy & Endurance`. The system shall not render fuel-tank rows, burn-sequence selectors, or fuel-type controls for an electric aircraft.
**Rationale:** Electric pilots plan with a battery pack (kWh) and a reserve floor, not fuel quantity and density. Surfacing the fuel vocabulary on an electric aircraft is the shoehorn defect called out in issue #225.
**Priority:** P1
**Status:** Deferred
**Design Reference:** [Native Electric Aircraft UX](../ux/native-electric-aircraft.md)

---

## Design References

- None

---
