# AeroDash Software Requirements - Documentation & Export (DOC)

This document defines the documentation & export behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
 | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **<a name="REQ-DOC-001"></a>REQ-DOC-001** | The system shall provide an export function (PDF or optimized print view) that summarizes mass and balance calculation results, and performance calculation results in a compact "Digital Briefing Pack." | Legal documentation and cockpit accessibility. | P2 | n/a | Approved | n/a |
| **<a name="REQ-DOC-002"></a>REQ-DOC-002** | The system shall append the text marker `[UNVERIFIED]` to any parameter value in the generated output (PDF/Print) that has the status `Unverified`. | No accidental use of unverified data. | P1 | [H-015](../risk_management/safety_hazards.md#H-015) | Approved | n/a |
| **<a name="REQ-DOC-003"></a>REQ-DOC-003** | If the calculation contains `Unverified` data, then the system shall include a disclaimer section in the export stating: "Calculation based on unverified external data. Pilot in Command assumes full responsibility." | Legal liability transfer. | P2 | [H-015](../risk_management/safety_hazards.md#H-015) | Approved | n/a |
| **<a name="REQ-DOC-004"></a>REQ-DOC-004** | If the calculation uses a user-selected Operational Safety Factor that is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), then the system shall include a disclaimer section in the export stating: "Calculation based on low safety margin. Pilot in Command assumes full responsibility." | Legal liability transfer. | P2 | [H-016](../risk_management/safety_hazards.md#H-016) | Approved | n/a |

---

## Design References

- None

---
