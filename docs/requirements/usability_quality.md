# AeroDash Software Requirements - Usability & Quality (UQ)

This document defines the usability & quality behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-UQ-001">REQ-UQ-001</a>** | The system shall provide touch-friendly input controls (steppers, sliders, or large hit targets) for all numerical data entry fields. | Tool is meant for cockpit use (tablet) and office prep (desktop). | P2 |  n/a | Draft |
| **<a name="REQ-UQ-002">REQ-UQ-002</a>** | The system shall adapt the layout to ensure all critical flight data (Envelope, Results) is fully visible without horizontal scrolling on viewports with a minimum width of 320px (standard mobile). | Usability on smartphone-sized devices. | P2 |  n/a | Draft |
| **<a name="REQ-UQ-003">REQ-UQ-003</a>** | The system shall format numerical values with a decimal precision appropriate to the active unit to ensure a physical resolution of at least 1mm for lengths and 0.1 units for mass/volume. (Standard: m=3, cm=1, mm=0, in=2, kg/lbs/L/gal=1) | Display precision, Prevents precision loss (e.g. 1m vs 1.001m) while avoiding clutter (e.g. 2400.000mm). | P2 |  n/a | Draft |
| **<a name="REQ-UQ-004">REQ-UQ-004</a>** | The system shall apply conservative rounding to critical safety margins: Rounding UP for Mass and Required Distances; Rounding DOWN for Endurance and Remaining Fuel. | Safety margins (Pessimistic approach). | P1 |  n/a | Draft |
| **<a name="REQ-UQ-005">REQ-UQ-005</a>** | The system shall statically display the active unit of measurement adjacent to every numerical input and output field. | Prevent unit confusion (Critical Safety). | P1 |  n/a | Draft |

---
