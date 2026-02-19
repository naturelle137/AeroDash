# AeroDash Software Requirements - Cloud, Sync & Collaboration (SC)

This document defines the cloud, sync and collaboration behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
|:---|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-SC-001"></a>REQ-SC-001** | The system shall authenticate users via external Identity Providers (OIDC). | Convenience and security outsourcing (OAuth). | P3 | n/a | Draft | n/a |
| **<a name="REQ-SC-002"></a>REQ-SC-002** | When an internet connection is available, the system shall synchronize local databases with the cloud backend, prioritizing the cloud state for Organization Data (read-only conflict resolution). | Ensures members always have the latest legally valid club aircraft data. | P3 | n/a | Draft | n/a |
| **<a name="REQ-SC-003"></a>REQ-SC-003** | The system shall segregate data into "Personal Workspaces" (Full Access for the user) and "Organization Workspaces" (Role-based Access). | Allows mixed usage (Owner + Club Member) in one app. | P3 | n/a | Draft | n/a |
| **<a name="REQ-SC-004"></a>REQ-SC-004** | The system shall enforce the following roles within an Organization Workspace: <ul><li>Org Admin: Full access (Manage Users & Fleet).</li><li>Fleet Admin: Manage Aircraft Profiles (Create/Update/Delete).</li><li>Member: Read-only access to Aircraft Profiles; Create/Edit own Flight Plans using these profiles.</li></ul> | Granular control for clubs (Vorstand vs. Warte vs. Piloten). | P3 | n/a | Draft | n/a |
| **<a name="REQ-SC-005"></a>REQ-SC-005** | The system shall allow users to share individual aircraft profiles via a generated unique alphanumeric ID (Share-Code). | Ad-hoc sharing between pilots without creating a full organization. | P3 | n/a | Draft | n/a |
| **<a name="REQ-SC-006"></a>REQ-SC-006** | When a valid Share-Code is entered, the system shall import a copy of the referenced aircraft profile into the user's Personal Workspace. | Easy setup for new users ("Send me your config"). | P3 | n/a | Draft | n/a |
| **<a name="REQ-SC-007"></a>REQ-SC-007** | The system shall export aircraft profiles and flight plans to a standardized local JSON file. | Data portability and backup independent of cloud. | P3 | n/a | Draft | n/a |
| **<a name="REQ-SC-008"></a>REQ-SC-008** | The system shall import aircraft profiles from a valid local JSON file, validating the schema before storage. | Restore from backup. | P3 | n/a | Draft | n/a |

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
