# AeroDash Software Requirements - Aircraft Management (AC)

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **n/a** | n/a |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-AC-001">REQ-AC-001</a>** | The system shall allow users to create, read, update, and delete aircraft profiles. | Core functionality for fleet management. | P1 | n/a | Approved |
| **<a name="REQ-AC-002">REQ-AC-002</a>** | When a new aircraft registration is entered, the system shall verify that the registration format is valid. | Pre-validation of registration identity (e.g., D-EBPF). | P3 | n/a | Reviewed |
| **<a name="REQ-AC-003">REQ-AC-003</a>** | If an aircraft registration already exists, then the system shall display an error message "Aircraft registration already exists". | Avoid data duplication and confusion between aircraft records. | P2 | n/a | Approved |
| **<a name="REQ-AC-004">REQ-AC-004</a>** | The system shall allow the creation of aircraft profiles via a configuration file (no hard-coding). | Facilitates "easy maintenance" without software re-compilation. | P2 | n/a | Approved |
| **<a name="REQ-AC-005">REQ-AC-005</a>** | The system shall implement a status system for aircraft profiles (Draft, Verified). New or edited profiles must be "Verified" and locked before use; calculations performed with a "Draft" profile shall display a permanent, high-visibility warning. | Prevents usage of unverified or typo-prone POH data bases. | P1 | [H-011](../risk_management/safety_hazards.md#H-011) | Reviewed |

---
