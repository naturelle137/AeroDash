# AeroDash Software Requirements - General & System Requirements (SYS)

This document defines the system behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-SYS-001">REQ-SYS-001</a>** | The system shall be fully functional without an active internet connection; all aircraft profiles and calculation logic shall be stored locally. | Ensure usability in remote airfields or during flight. | P2 |  n/a | Reviewed |
| **<a name="REQ-SYS-002">REQ-SYS-002</a>** | The system shall store aircraft profiles and flight plans in a standardized, portable format. | Human-readable format and future-proofing. | P1 | n/a | Approved |
| **<a name="REQ-SYS-003">REQ-SYS-003</a>** | The system shall normalize all physical input parameters to a unified internal SI referance frame (kg, m, L, s) for the internal calculation logic. | Ensure mathematical consistency across mixed fleets. | P1 | [H-001](docs/risk_management/safety_hazards.md#H-001), [H-002](docs/risk_management/safety_hazards.md#H-002) | Approved |
| **<a name="REQ-SYS-004">REQ-SYS-004</a>** | The system shall accept the following units for data storage, input and display: <ul><li>Volume: L, gal (US)</li> <li>Mass: kg, lb</li> <li>Speed: km/h, mph, kt, m/s</li> <li>Arm: m, in, ft</li> <li>Moment: kg·m, in-lb, ft-lb</li> <li>Temperature: °C, °F</li> <li>Altitude: ft, m</li> <li>Distance: km, mi, nm </li> <li>Pressure: hPa, inHg, mmHg</li></ul> | Ensures compatibility with POH data from both metric  and imperial manufacturers. | P1 | n/a | Approved |
| **<a name="REQ-SYS-005">REQ-SYS-005</a>** | When a new software version is detected, the system shall prevent silent background updates and instead display a prominent notification requiring user confirmation to reload the application. | Prevents "State Confusion" where the pilot plans on an old version while the new one loads in the background. | P1 | [H-019](docs/risk_management/safety_hazards.md#H-019) | Draft |
| **<a name="REQ-SYS-006">REQ-SYS-006</a>** | When the application initializes online, the system shall verify the local version against a remote "minimum safe version" and block execution if the local version is marked as unsafe | "Kill Switch" for critical bugs (e.g., calculation errors discovered post-release). | P1 | [H-019](docs/risk_management/safety_hazards.md#H-019) | Draft |

---
