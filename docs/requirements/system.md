# AeroDash Software Requirements - General & System Requirements (SYS)

This document defines the system behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **POH** | **P**ilot **O**perating **H**andbook |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-SYS-001">REQ-SYS-001</a>** | The system shall be fully functional without an active internet connection; all aircraft profiles and calculation logic shall be stored locally. | Ensure usability in remote airfields or during flight. | P2 |  n/a | Reviewed |
| **<a name="REQ-SYS-002">REQ-SYS-002</a>** | The system shall store aircraft profiles and flight plans in a standardized, portable format. | Human-readable format and future-proofing. | P1 | n/a | Approved |
| **<a name="REQ-SYS-003">REQ-SYS-003</a>** | The system shall normalize all physical input parameters to a unified internal SI referance frame (kg, m, L, s) for the internal calculation logic. | Ensure mathematical consistency across mixed fleets. | P1 | [H-001](../risk_management/safety_hazards.md#H-001), [H-002](../risk_management/safety_hazards.md#H-002) | Approved |
| **<a name="REQ-SYS-004">REQ-SYS-004</a>** | The system shall accept the following units for data storage, input and display: <ul><li>Volume: L, gal (US)</li> <li>Mass: kg, lb</li> <li>Speed: km/h, mph, kt, m/s</li> <li>Arm: m, in, ft</li> <li>Moment: kg·m, in-lb, ft-lb</li> <li>Temperature: °C, °F</li> <li>Altitude: ft, m</li> <li>Distance: km, mi, nm </li> <li>Pressure: hPa, inHg, mmHg</li></ul> | Ensures compatibility with POH data from both metric  and imperial manufacturers. | P1 | n/a | Approved |

---