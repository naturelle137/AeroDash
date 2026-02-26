# AeroDash Software Requirements - Aircraft Management (AC)

This document defines the aircraft management behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-AC-001@ -->
### REQ-AC-001: Profile CRUD Operations

**Requirement:** The system shall allow users to create, read, update, and delete aircraft profiles.
**Rationale:** Core functionality for fleet management.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AC-002@ -->
### REQ-AC-002: Registration Validation

**Requirement:** When the user creates or updates an aircraft profile, the system shall validate the aircraft registration against standard ICAO registration patterns (e.g., alphanumeric, hyphenated).
**Rationale:** Pre-validation of registration identity (e.g., D-EBPF).
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AC-003@ -->
### REQ-AC-003: Duplicate Registration Warning

**Requirement:** If an aircraft registration already exists, then the system shall return a Notification: `{ "id": "WARN-AC-001", "severity": "WARNING", "message": "Registration Duplicate", "context": "Aircraft.Registration" }`.
**Rationale:** Avoid data duplication and confusion between aircraft records.
**Priority:** P2
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-AC-004@ -->
### REQ-AC-004: Profile Import

**Requirement:** The system shall import aircraft profiles from external exchange files.
**Rationale:** Facilitates offline backup and sharing of profiles without recompilation.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AC-005@ (FROM: @H-011@) -->
### REQ-AC-005: Profile Verification Status

**Requirement:** The system shall implement a status system for aircraft profiles (`Draft`, `Verified`). New or edited profiles shall be `Verified` and locked before use; calculations performed with a `Draft` profile shall return a Notification: `{ "id": "WARN-AC-002", "severity": "WARNING", "message": "Draft Profile Active", "context": "Aircraft.Status", "persistent": true }`.
**Rationale:** Prevents usage of unverified or typo-prone POH data bases.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-AC-006@ -->
### REQ-AC-006: Passenger Profiles

**Requirement:** The system shall allow the user to create, update, and delete "Passenger Profiles" defined by a Name and a Standard Weight.
**Rationale:** Facilitates [REQ-UI-006](../requirements/user_interface.md#REQ-UI-006) (Quick Selection) and standardized fleet operations.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
