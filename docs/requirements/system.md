# AeroDash Software Requirements - General & System Requirements (SYS)

## Requirements

### REQ-SYS-001: Offline Functionality

While no internet connection is available, the system shall support calculations using locally available aircraft and planning data.

### REQ-SYS-002: Portable Storage Format

The system shall provide aircraft profiles in a portable structured format.

### REQ-SYS-003: SI Unit Normalization

When equivalent physical inputs are expressed in different supported units, the system shall return physically equivalent calculation results.

### REQ-SYS-004: Supported Units

The system shall accept input in these units: volume L/US gal; mass kg/lb; speed km/h, mph, kt, m/s; arm m/in/ft; moment kg·m/in-lb/ft-lb; temperature °C/°F; altitude ft/m; distance km/mi/nm; pressure hPa/inHg/mmHg.

### REQ-SYS-005: Update Available Notification

When a new software version is detected during an active session, the system shall display an INFO notification (`INFO-SYS-001`) offering a reload action.

### REQ-SYS-006: Safe Version Verification

When the application initializes online, the system shall compare the local version with the remote minimum safe version.

### REQ-SYS-007: Centralized Notification Service

When a functional module emits a notification, the system shall make it available through the application’s shared notification interface.

### REQ-SYS-008: Uniform Notification Model

The system shall expose each notification with a unique ID, severity, message and persistence flag.

### REQ-SYS-009: Connectivity State Detection

When the browser reports a connectivity change, the system shall update the visible browser online/offline status.

### REQ-SYS-010: Online Feature Availability

While connectivity is Offline, the system shall disable cloud sync, share-code generation/retrieval and weather/airport API queries.

### REQ-SYS-011: Input Validation Before Core Logic

When a core calculation is requested, the system shall validate all module inputs against their input schema before calculation.

### REQ-SYS-012: Validation Failure Error Notification

If input validation fails, then the system shall emit an ERROR notification (`ERR-SYS-001`) containing the invalid field path and validation failure code.

### REQ-SYS-013: Session Payload Persistence

When preflight values change, the system shall save the active session locally after the configured debounce interval.

### REQ-SYS-014: Erasure of All Personal Data

When the user confirms erasure, the system shall permanently delete all personal data under its control across all storage locations in one user action.

### REQ-SYS-015: Export of All Personal Data

When the user requests a copy of their data, the system shall produce an export of all personal data under its control in a structured, commonly used machine-readable format.

### REQ-SYS-016: Disclaimer Acknowledgement

If the user has not acknowledged the disclaimer, then the system shall prevent use of the safety-critical functions.

### REQ-SYS-017: In-App Contribution Intake — Three-Channel Entry

The system shall offer exactly three in-app contribution channels: defect report, feature request and security vulnerability report.

### REQ-SYS-018: Prefilled GitHub Issue Handoff for Defects and Feature Requests

When the user submits a defect or feature form, the system shall open a new GitHub issue tab with the matching template and all entered fields prefilled in the title/body.

### REQ-SYS-019: Security Advisory Link-Only Handoff

When the security channel is selected, the system shall explain that vulnerability reports are handled privately on GitHub.

### REQ-SYS-020: Local aircraft storage

The system shall retain aircraft profiles locally for offline use.

### REQ-SYS-021: Local calculation availability

While the application is cached for offline use, the system shall make its calculation logic available without a network connection.

### REQ-SYS-022: Portable flight plans

The system shall provide flight plans in a portable structured format.

### REQ-SYS-023: No silent activation

While an active-session update is waiting, the system shall prevent silent replacement of the running application.

### REQ-SYS-024: Unsafe version block

If the local version is below the minimum safe version, then the system shall block execution.

### REQ-SYS-025: Enable online features

When connectivity returns to Online, the system shall re-enable network-dependent features.

### REQ-SYS-026: Reject invalid calculation inputs

If input validation fails, then the system shall prevent the core calculation from executing.

### REQ-SYS-027: Validation context

When an input-validation error is reported, the system shall identify its originating module in the notification context.

### REQ-SYS-028: Session restoration

When the page reloads with a valid saved session, the system shall restore its preflight values.

### REQ-SYS-029: Invalid saved session

If the saved session is absent or fails schema validation, then the system shall start a clean session.

### REQ-SYS-030: Aircraft switch

When a different aircraft profile is selected, the system shall clear the previous session payload.

### REQ-SYS-031: Erasure failure reporting

If any personal data cannot be deleted, then the system shall report the erasure failure.

### REQ-SYS-032: Incomplete erasure status

While any requested personal-data deletion has failed, the system shall not report erasure as complete.

### REQ-SYS-033: Data copy delivery

When a personal-data export is produced, the system shall make it available for the user to retain.

### REQ-SYS-034: Channel descriptions

The system shall display a one-sentence plain-language description for each contribution channel.

### REQ-SYS-035: Channel help

When the user activates a contribution channel’s info tooltip, the system shall explain when to use that channel.

### REQ-SYS-036: Issue data retention

When the GitHub issue tab opens, the system shall discard the in-app report values.

### REQ-SYS-037: Issue transmission boundary

The system shall transmit in-app issue values only through the GitHub URL the user explicitly chooses to open.

### REQ-SYS-038: Private advisory handoff

When the user activates the security-report button, the system shall open the repository’s private advisory creation form in a new tab.

### REQ-SYS-039: No security detail collection

The system shall provide no in-app field for collecting security-report content.

### REQ-SYS-050: Unit storage

The system shall preserve aircraft values expressed in these supported units: volume L/US gal; mass kg/lb; speed km/h, mph, kt, m/s; arm m/in/ft; moment kg·m/in-lb/ft-lb; temperature °C/°F; altitude ft/m; distance km/mi/nm; pressure hPa/inHg/mmHg.

### REQ-SYS-051: Unit display

The system shall display physical values in the user’s selected supported unit.

### REQ-SYS-052: Cold-start update

When an update is detected on a classified cold start with no active session, the system shall apply the update without an active-session consent prompt.

### REQ-SYS-053: Session detection failure

If session storage is unavailable during update classification, then the system shall use the consent-required update path.

### REQ-SYS-054: Connectivity meaning

The system shall describe browser connectivity as distinct from Internet reachability, cache readiness and source freshness.

### REQ-SYS-055: Cached preparation reopening

When a previously cached application is reopened offline, the system shall restore valid locally persisted aircraft and manual runway data.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
- **<a name="dataRights"></a>Data-Rights (Erasure & Bulk Export):** [`docs/architecture/data-rights.md`](../architecture/data-rights.md)
- **<a name="disclaimerAck"></a>Disclaimer Acknowledgement:** [`docs/architecture/disclaimer-acknowledgement.md`](../architecture/disclaimer-acknowledgement.md)
