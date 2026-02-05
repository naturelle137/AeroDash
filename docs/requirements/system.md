# AeroDash Software Requirements - General & System Requirements (SYS)

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| n/a | n/a |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-SYS-001">REQ-SYS-001</a>** | The system shall be fully functional without an active internet connection; all aircraft profiles and calculation logic shall be stored locally. | Ensure usability in remote airfields or during flight. |**P2** |  n/a | Reviewed |
| **<a name="REQ-SYS-002">REQ-SYS-002</a>** | The system shall store aircraft profiles and flight plans in a standardized, portable format (JSON). | Human-readable format and future-proofing. | **P1** | n/a | Approved |
| **<a name="REQ-SYS-003">REQ-SYS-003</a>** | The system’s internal physics engine shall perform all calculations using a unified SI reference frame (kg, m, l, s). | Ensure mathematical consistency across mixed fleets. | **P1** | H-001 | Approved |

---
