# AeroDash Software Requirements - General & System Requirements (SYS)

This document defines the system behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
 | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| <!-- @REQ-SYS-001@ -->  **<a name="REQ-SYS-001"></a>REQ-SYS-001** | The system shall be fully functional without an active internet connection; all aircraft profiles and calculation logic shall be stored locally. | Ensure usability in remote airfields or during flight. | P2 | n/a | Approved | n/a |
| <!-- @REQ-SYS-002@ -->  **<a name="REQ-SYS-002"></a>REQ-SYS-002** | The system shall store aircraft profiles and flight plans in a standardized, portable format. | Human-readable format and future-proofing. | P1 | n/a | Approved | n/a |
| <!-- @REQ-SYS-003@ (FROM: @H-001@, @H-001@, @H-002@, @H-002@) -->  **<a name="REQ-SYS-003"></a>REQ-SYS-003** | The system shall normalize all physical input parameters to a unified internal SI reference frame (kg, m, L, s) for the internal calculation logic. | Ensure mathematical consistency across mixed fleets. | P1 | [H-001](../risk_management/safety_hazards.md#H-001), [H-002](../risk_management/safety_hazards.md#H-002) | Approved | n/a |
| <!-- @REQ-SYS-004@ -->  **<a name="REQ-SYS-004"></a>REQ-SYS-004** | The system shall accept the following units for data storage, input and display: <ul><li>Volume: L, gal (US)</li> <li>Mass: kg, lb</li> <li>Speed: km/h, mph, kt, m/s</li> <li>Arm: m, in, ft</li> <li>Moment: kg·m, in-lb, ft-lb</li> <li>Temperature: °C, °F</li> <li>Altitude: ft, m</li> <li>Distance: km, mi, nm </li> <li>Pressure: hPa, inHg, mmHg</li></ul> | Ensures compatibility with POH data from both metric  and imperial manufacturers. | P1 | n/a | Approved | n/a |
| <!-- @REQ-SYS-005@ (FROM: @H-019@, @H-019@) -->  **<a name="REQ-SYS-005"></a>REQ-SYS-005** | When a new software version is detected, the system shall prevent silent background updates and return a Notification: `{ "id": "INFO-SYS-001", "severity": "INFO", "message": "Update Available", "context": "System.Version", "action": { "label": "Reload", "event": "sys.reload", "payload": { "targetVersion": "<semver_string>", "force": false } } }`. | Prevents "State Confusion" where the pilot plans on an old version while the new one loads in the background. | P1 | [H-019](../risk_management/safety_hazards.md#H-019) | Approved | [Notification Scheme](#notificationScheme) |
| <!-- @REQ-SYS-006@ (FROM: @H-019@, @H-019@) -->  **<a name="REQ-SYS-006"></a>REQ-SYS-006** | When the application initializes online, the system shall verify the local version against a remote "minimum safe version" and block execution if the local version is marked as unsafe | "Kill Switch" for critical bugs (e.g., calculation errors discovered post-release). | P1 | [H-019](../risk_management/safety_hazards.md#H-019) | Approved | n/a |
| <!-- @REQ-SYS-007@ -->  **<a name="REQ-SYS-007"></a>REQ-SYS-007** | The system shall implement a centralized Notification Service that aggregates validation states and notifications from all functional modules. | Centralized handling of alerts ensures consistent UI behavior and preventing alert fatigue. | P1 | n/a | Approved | [Notification Scheme](#notificationScheme) |
| <!-- @REQ-SYS-008@ -->  **<a name="REQ-SYS-008"></a>REQ-SYS-008** | The communication logic layer and UI layer shall be done via a uniform notification data model containing at minimum: Unique ID, Severity, Message, and Persistence flag. | Ensures strict data contract and decoupled interaction between Logic and UI layers. | P1 | n/a | Approved | [Notification Scheme](#notificationScheme) |

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
