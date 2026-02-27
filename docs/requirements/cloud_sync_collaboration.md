# AeroDash Software Requirements - Cloud, Sync & Collaboration (SC)

This document defines the cloud, sync and collaboration behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-SC-001@ -->
### REQ-SC-001: OIDC Authentication

**Requirement:** The system shall authenticate users via external Identity Providers (OIDC).
**Rationale:** Convenience and security outsourcing (OAuth).
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SC-002@ -->
### REQ-SC-002: Cloud Synchronization

**Requirement:** When an internet connection is available, the system shall synchronize local databases with the cloud backend, prioritizing the cloud state for Organization Data (read-only conflict resolution).
**Rationale:** Ensures members always have the latest legally valid club aircraft data.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SC-003@ -->
### REQ-SC-003: Workspace Segregation

**Requirement:** The system shall segregate data into "Personal Workspaces" (Full Access for the user) and "Organization Workspaces" (Role-based Access).
**Rationale:** Allows mixed usage (Owner + Club Member) in one app.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SC-004@ -->
### REQ-SC-004: Role-based Access Control

**Requirement:** The system shall enforce the following roles within an Organization Workspace: <ul><li>Org Admin: Full access (Manage Users & Fleet).</li><li>Fleet Admin: Manage Aircraft Profiles (Create/Update/Delete).</li><li>Member: Read-only access to Aircraft Profiles; Create/Edit own Flight Plans using these profiles.</li></ul>
**Rationale:** Granular control for clubs (Vorstand vs. Warte vs. Piloten).
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SC-005@ -->
### REQ-SC-005: Share-Code Generation

**Requirement:** The system shall allow users to share individual aircraft profiles via a generated unique alphanumeric ID (Share-Code).
**Rationale:** Ad-hoc sharing between pilots without creating a full organization.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SC-006@ -->
### REQ-SC-006: Share-Code Import

**Requirement:** When a valid Share-Code is entered, the system shall import a copy of the referenced aircraft profile into the user's Personal Workspace.
**Rationale:** Easy setup for new users ("Send me your config").
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SC-007@ -->
### REQ-SC-007: JSON Export

**Requirement:** The system shall export aircraft profiles and flight plans to a standardized local JSON file.
**Rationale:** Data portability and backup independent of cloud.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-SC-008@ -->
### REQ-SC-008: JSON Import Validation

**Requirement:** The system shall import aircraft profiles from a valid local JSON file, validating the schema before storage.
**Rationale:** Restore from backup.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- None

---
