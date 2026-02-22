# AeroDash Software Requirements - Aircraft Management (AC)

This document defines the aircraft management behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
 | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **<a name="REQ-AC-001"></a>REQ-AC-001** | The system shall allow users to create, read, update, and delete aircraft profiles. | Core functionality for fleet management. | P1 | n/a | Approved | n/a |
| **<a name="REQ-AC-002"></a>REQ-AC-002** | When the user creates or updates an aircraft profile, the system shall validate the aircraft registration against standard ICAO registration patterns (e.g., alphanumeric, hyphenated). | Pre-validation of registration identity (e.g., D-EBPF). | P3 | n/a | Approved | n/a |
| **<a name="REQ-AC-003"></a>REQ-AC-003** | If an aircraft registration already exists, then the system shall return a Notification: `{ "id": "WARN-AC-001", "severity": "WARNING", "message": "Registration Duplicate", "context": "Aircraft.Registration" }`. | Avoid data duplication and confusion between aircraft records. | P2 | n/a | Approved | [Notification Scheme](#notificationScheme) |
| **<a name="REQ-AC-004"></a>REQ-AC-004** | The system shall import aircraft profiles from external exchange files. | Facilitates offline backup and sharing of profiles without recompilation. | P2 | n/a | Approved | n/a |
| **<a name="REQ-AC-005"></a>REQ-AC-005** | The system shall implement a status system for aircraft profiles (`Approved`, `Verified`). New or edited profiles shall be `Verified` and locked before use; calculations performed with a `Approved` profile shall return a Notification: `{ "id": "WARN-AC-002", "severity": "WARNING", "message": "Approved Profile Active", "context": "Aircraft.Status", "persistent": true }`. | Prevents usage of unverified or typo-prone POH data bases. | P1 | [H-011](../risk_management/safety_hazards.md#H-011) | Approved | [Notification Scheme](#notificationScheme) |
| **<a name="REQ-AC-006"></a>REQ-AC-006** | The system shall allow the user to create, update, and delete "Passenger Profiles" defined by a Name and a Standard Weight. | Facilitates [REQ-UI-006](../requirements/user_interface.md#REQ-UI-006) (Quick Selection) and standardized fleet operations. | P2 | n/a | Approved | n/a |

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
