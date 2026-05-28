# AeroDash Software Requirements - General & System Requirements (SYS)

This document defines the system behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-SYS-001@ -->

### REQ-SYS-001: Offline Functionality

**Requirement:** The system shall be fully functional without an active internet connection; all aircraft profiles and calculation logic shall be stored locally.
**Rationale:** Ensure usability in remote airfields or during flight.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-SYS-002@ -->

### REQ-SYS-002: Portable Storage Format

**Requirement:** The system shall store aircraft profiles and flight plans in a standardized, portable format.
**Rationale:** Human-readable format and future-proofing.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-SYS-003@ (FROM: @H-001@, @H-002@) -->

### REQ-SYS-003: SI Unit Normalization

**Requirement:** The system shall normalize all physical input parameters to a unified internal SI reference frame (kg, m, L, s) for the internal calculation logic.
**Rationale:** Ensure mathematical consistency across mixed fleets.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-SYS-004@ -->

### REQ-SYS-004: Supported Units

**Requirement:** The system shall accept the following units for data storage, input and display: <ul><li>Volume: L, gal (US)</li> <li>Mass: kg, lb</li> <li>Speed: km/h, mph, kt, m/s</li> <li>Arm: m, in, ft</li> <li>Moment: kg·m, in-lb, ft-lb</li> <li>Temperature: °C, °F</li> <li>Altitude: ft, m</li> <li>Distance: km, mi, nm </li> <li>Pressure: hPa, inHg, mmHg</li></ul>
**Rationale:** Ensures compatibility with POH data from both metric and imperial manufacturers.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-SYS-005@ (FROM: @H-019@) -->

### REQ-SYS-005: Update Available Notification

**Requirement:** When a new software version is detected, the system shall prevent silent background updates and emit an INFO notification (`INFO-SYS-001`) informing the user about the available update and offering a reload action.
**Rationale:** Prevents "State Confusion" where the pilot plans on an old version while the new one loads in the background.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-SYS-006@ (FROM: @H-019@) -->

### REQ-SYS-006: Safe Version Verification

**Requirement:** When the application initializes online, the system shall verify the local version against a remote "minimum safe version" and block execution if the local version is marked as unsafe
**Rationale:** "Kill Switch" for critical bugs (e.g., calculation errors discovered post-release).
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-SYS-007@ -->

### REQ-SYS-007: Centralized Notification Service

**Requirement:** The system shall implement a centralized Notification Service that aggregates notifications from all functional modules.
**Rationale:** Centralized handling of alerts ensures consistent UI behavior and preventing alert fatigue.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-SYS-008@ -->

### REQ-SYS-008: Uniform Notification Model

**Requirement:** The communication logic layer and UI layer shall be done via a uniform notification data model containing at minimum: Unique ID, Severity, Message, and Persistence flag.
**Rationale:** Ensures strict data contract and decoupled interaction between Logic and UI layers.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-SYS-009@ -->

### REQ-SYS-009: Connectivity State Detection

**Requirement:** The system shall monitor the device's network connectivity and maintain an application-wide connectivity state (`Online`, `Offline`).
**Rationale:** Offline operation is a core design constraint, not an error condition. A centralized connectivity state replaces individual API failure notifications and prevents notification fatigue.
**Priority:** P2
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-SYS-010@ -->

### REQ-SYS-010: Online Feature Availability

**Requirement:** While the connectivity state is `Offline`, the system shall disable all features requiring an active internet connection (Cloud Sync, Share-Code generation and retrieval, Weather and Airport API queries) and shall re-enable them when the state returns to `Online`.
**Rationale:** Prevents misleading error states for expected offline behavior. Online-only features are gated at the UI level rather than producing individual failure notifications.
**Priority:** P2
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-SYS-011@ -->

### REQ-SYS-011: Input Validation Before Core Logic

**Requirement:** Before invoking any core calculation logic, the system shall validate all module inputs against their defined schema (Zod). If validation fails, the system shall reject the input and shall not execute the core calculation.
**Rationale:** Prevents invalid or incomplete data from reaching safety-critical math logic. Validation failures are input errors, not safety-limit breaches.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-SYS-012@ -->

### REQ-SYS-012: Validation Failure Error Notification

**Requirement:** If input validation fails (REQ-SYS-011), the system shall emit a Notification with severity `ERROR` containing the invalid field path and validation failure code (`ERR-SYS-001`). The notification context shall identify the originating module (e.g. `MassBalance.Validation`).
**Rationale:** Distinguishes input mistakes (`ERROR` — inline field errors, user must fix) from safety-limit violations (`CRITICAL` — flight should not proceed). Reduces alarm fatigue by reserving `CRITICAL` for genuine safety hazards.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-SYS-013@ -->

### REQ-SYS-013: Session Payload Persistence

**Priority:** P3
**Status:** Implemented

**Requirement:** When the pilot has entered preflight data, the system shall automatically serialise the active session payload to `localStorage` on each value change (debounced) and restore it on page reload, provided the restored payload passes Zod schema validation. An invalid or absent payload shall result in a clean session with no pre-population. The session payload shall be cleared when a different aircraft profile is selected.

<!-- @REQ-SYS-014@ -->

### REQ-SYS-014: Erasure of All Personal Data

**Requirement:** When the user requests erasure of their data, the system shall, upon explicit confirmation, permanently and irrecoverably delete all personal data the application holds about the user, across every storage location under the application's control, in a single user action. If any part of that data cannot be deleted, then the system shall report the failure and shall not indicate the erasure as complete.
**Rationale:** GDPR Art. 17 right to erasure (DP-002, DP-003). The control must encompass every category of personal data the application retains — not one storage mechanism — so the right is honoured in full regardless of where or how that data is held, including any account, profile, or synchronised data added in future. Which stores exist and how deletion is performed are design concerns; when a new personal-data store is introduced, this requirement's verification must be revisited.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-SYS-015@ -->

### REQ-SYS-015: Export of All Personal Data

**Requirement:** When the user requests a copy of their data, the system shall produce an export containing all personal data the application holds about the user in a structured, commonly-used, machine-readable format, and shall make that export available to the user to retain.
**Rationale:** GDPR Art. 15 (right of access) and Art. 20 (data portability) (DP-002). A complete, portable copy lets the user inspect, archive, or migrate their data — including before exercising erasure (REQ-SYS-014). The concrete serialisation format and delivery mechanism are design concerns, and the export must extend to any account, profile, or synchronised data added in future.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
