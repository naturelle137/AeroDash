# AeroDash Requirements Engineering

This folder contains the software requirements for the AeroDash project.
The requirements are structured by functional area (modules) to allow modular development and testing.

AeroDash follows a strict requirements engineering process to ensure safety and certification readiness (Project Level: Experimental / EAB, but following DO-178C principles where applicable).

## Requirement Syntax (EARS)
All requirements must be written using the **EARS** (Easy Approach to Requirements Syntax) patterns:

1.  **Ubiquitous:** "The system shall..."
2.  **Event-Driven:** "When <trigger>, the system shall..."
3.  **Unwanted Behavior:** "If <trigger>, then the system shall..."
4.  **State-Driven:** "While <state>, the system shall..."
5.  **Optional Feature:** "Where <feature is included>, the system shall..."
6.  **Complex Logic:** "When <trigger>, while <state>, the system shall..."

## Requirement Attributes

Each requirement is defined in a Markdown table with the following columns:

| Attribute | Description |
|:---|:---|
| **Req-ID** | Unique Identifier (e.g., `REQ-SYS-001`). Format: `REQ-<Module>-<Number>`. HTML anchors `<a name="...">` are used for linking. |
| **Requirement** | The requirement text using EARS syntax. |
| **Rationale / Context** | *Why* this requirement exists. Links to parent requirements or user needs. |
| **Priority** | **P1** (Critical/Safety), **P2** (Standard), **P3** (Nice to have / Polish). |
| **Mitigation Hazard ID** | Link to the specific Hazard ID in `docs/risk_management/safety_hazards.md` if this requirement acts as a control measure. |
| **Status** | `Draft`, `Review`, `Approved`, `Deprecated`. |
| **Design Reference** | Keyword pointing to a specific design document or architectural component (defined at the bottom of the file). |

## Module Identifiers

- **AC:** Aircraft Management
- **AP:** Airport Database
- **AD:** Detailed Aircraft Data
- **FE:** Fuel & Endurance
- **MB:** Mass & Balance
- **PF:** Performance
- **WX:** Weather & Meteorological Data
- **UI:** User Interface
- **UQ:** Usability & Quality
- **SYS:** General System Requirements
- **DOC:** Documentation & Export
- **CLD:** Cloud Sync & Collaboration

## Traceability

- **Safety:** Requirements linking to a Hazard ID must be traceable in the Safety Traceability Matrix.
- **Verification:** Each requirement implies a test case (Unit Test, Integration Test, E2E Test).

---

## Example Table

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
|:---|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-EX-001"></a>REQ-EX-001** | When the engine start is detected, the system shall start the flight timer. | Automatic logging reduces pilot workload. | P2 | n/a | Approved | [Flight Logger](#flightLogger) |

---

## Design References

- **<a name="flightLogger"></a>Flight Logger:** [docs/architecture/flight_logging_service.md](../architecture/flight_logging_service.md)

---