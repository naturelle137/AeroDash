# AeroDash Software Requirements - General & System Requirements (SYS)

This document defines the system behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-SYS-001@ -->
### REQ-SYS-001: Offline Functionality

**Requirement:** The system shall be fully functional without an active internet connection; all aircraft profiles and calculation logic shall be stored locally.
**Rationale:** Ensure usability in remote airfields or during flight.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SYS-002@ -->
### REQ-SYS-002: Portable Storage Format

**Requirement:** The system shall store aircraft profiles and flight plans in a standardized, portable format.
**Rationale:** Human-readable format and future-proofing.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SYS-003@ (FROM: @H-001@, @H-002@) -->
### REQ-SYS-003: SI Unit Normalization

**Requirement:** The system shall normalize all physical input parameters to a unified internal SI reference frame (kg, m, L, s) for the internal calculation logic.
**Rationale:** Ensure mathematical consistency across mixed fleets.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SYS-004@ -->
### REQ-SYS-004: Supported Units

**Requirement:** The system shall accept the following units for data storage, input and display: <ul><li>Volume: L, gal (US)</li> <li>Mass: kg, lb</li> <li>Speed: km/h, mph, kt, m/s</li> <li>Arm: m, in, ft</li> <li>Moment: kg·m, in-lb, ft-lb</li> <li>Temperature: °C, °F</li> <li>Altitude: ft, m</li> <li>Distance: km, mi, nm </li> <li>Pressure: hPa, inHg, mmHg</li></ul>
**Rationale:** Ensures compatibility with POH data from both metric  and imperial manufacturers.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SYS-005@ (FROM: @H-019@) -->
### REQ-SYS-005: Update Available Notification

**Requirement:** When a new software version is detected, the system shall prevent silent background updates and return a Notification: `{ "id": "INFO-SYS-001", "severity": "INFO", "message": "Update Available", "context": "System.Version", "action": { "label": "Reload", "event": "sys.reload", "payload": { "targetVersion": "<semver_string>", "force": false } } }`.
**Rationale:** Prevents "State Confusion" where the pilot plans on an old version while the new one loads in the background.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-SYS-006@ (FROM: @H-019@) -->
### REQ-SYS-006: Safe Version Verification

**Requirement:** When the application initializes online, the system shall verify the local version against a remote "minimum safe version" and block execution if the local version is marked as unsafe
**Rationale:** "Kill Switch" for critical bugs (e.g., calculation errors discovered post-release).
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SYS-007@ -->
### REQ-SYS-007: Centralized Notification Service

**Requirement:** The system shall implement a centralized Notification Service that aggregates notifications from all functional modules.
**Rationale:** Centralized handling of alerts ensures consistent UI behavior and preventing alert fatigue.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-SYS-008@ -->
### REQ-SYS-008: Uniform Notification Model

**Requirement:** The communication logic layer and UI layer shall be done via a uniform notification data model containing at minimum: Unique ID, Severity, Message, and Persistence flag.
**Rationale:** Ensures strict data contract and decoupled interaction between Logic and UI layers.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
