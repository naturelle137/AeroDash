# AeroDash Software Requirements - General & System Requirements (SYS)

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **n/a** | n/a |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-SYS-001">REQ-SYS-001</a>** | The system shall be fully functional without an active internet connection; all aircraft profiles and calculation logic shall be stored locally. | Ensure usability in remote airfields or during flight. | P2 |  n/a | Reviewed |
| **<a name="REQ-SYS-002">REQ-SYS-002</a>** | The system shall store aircraft profiles and flight plans in a standardized, portable format. | Human-readable format and future-proofing. | P1 | n/a | Approved |
| **<a name="REQ-SYS-003">REQ-SYS-003</a>** | The system shall convert all units internally to SI units (kg, m, l, s) for the internal calculation logic. | Ensure mathematical consistency across mixed fleets. | P1 | [H-001](../risk_management/safety_hazards.md#H-001), [H-002](../risk_management/safety_hazards.md#H-002) | Approved |

---
