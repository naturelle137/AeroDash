# AeroDash Software Requirements - Usability & Quality (UQ)

This document defines the usability & quality behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-UQ-001@ -->
### REQ-UQ-001: Touch-Friendly Controls

**Requirement:** The system shall provide touch-friendly input controls (steppers, sliders, or large hit targets) for all numerical data entry fields.
**Rationale:** Tool is meant for cockpit use (tablet) and office prep (desktop).
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UQ-002@ -->
### REQ-UQ-002: Responsive Layout Adaptation

**Requirement:** The system shall adapt the layout to ensure all critical flight data (Envelope, Results) is fully visible without horizontal scrolling on viewports with a minimum width of 320px (standard mobile).
**Rationale:** Usability on smartphone-sized devices.
**Priority:** P2
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-UQ-003@ -->
### REQ-UQ-003: Decimal Precision Formatting

**Requirement:** The system shall format numerical values with a decimal precision appropriate to the active unit to ensure a physical resolution of at least 1mm for lengths and 0.1 units for mass/volume. (Standard: m=3, cm=1, mm=0, in=2, kg/lbs/L/gal=1)
**Rationale:** Display precision, Prevents precision loss (e.g. 1m vs 1.001m) while avoiding clutter (e.g. 2400.000mm).
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UQ-004@ -->
### REQ-UQ-004: Conservative Rounding Strategy

**Requirement:** The system shall apply conservative rounding to critical safety margins: Rounding UP for Mass and Required Distances; Rounding DOWN for Endurance and Remaining Fuel.
**Rationale:** Safety margins (Pessimistic approach).
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UQ-005@ (FROM: @H-001@) -->
### REQ-UQ-005: Active Unit Display

**Requirement:** The system shall statically display the active unit of measurement adjacent to every numerical input and output field.
**Rationale:** Prevent unit confusion (Critical Safety).
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UQ-006@ (FROM: @H-010@, @H-011@) -->
### REQ-UQ-006: Zero-Value Plausibility Check

**Requirement:** When a mandatory mass-input station (e.g. pilot, crew, passenger) has a recorded weight of zero, the system shall emit a WARNING notification (`WARN-UQ-001`) alerting the user that the entered mass is implausibly low. The notification shall identify the offending station(s) by name.
**Rationale:** A required occupant station with zero mass is almost always a missed-entry rather than an intentional empty seat — surfacing it as a soft warning catches the "garbage-in" defect class called out in the Safety-Critical Design Check before it reaches a Go/No-Go advisory. Fuel quantity is intentionally excluded because zero fuel is a legitimate planning state and is already constrained from below by the unusable-fuel floor.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
