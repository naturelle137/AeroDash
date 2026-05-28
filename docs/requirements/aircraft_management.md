# AeroDash Software Requirements - Aircraft Management (AC)

This document defines the aircraft management behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-AC-001@ -->

### REQ-AC-001: Profile CRUD Operations

**Requirement:** The system shall allow users to create, read, update, and delete aircraft profiles.
**Rationale:** Core functionality for fleet management.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-AC-002@ -->

### REQ-AC-002: Registration Validation

**Requirement:** When the user creates or updates an aircraft profile, the system shall validate the aircraft registration against standard ICAO registration patterns (e.g., alphanumeric, hyphenated).
**Rationale:** Pre-validation of registration identity (e.g., D-EBPF).
**Priority:** P3
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-AC-003@ -->

### REQ-AC-003: Duplicate Registration Warning

**Requirement:** If an aircraft registration already exists within the same owner's database, then the system shall emit a WARNING notification (`WARN-AC-001`) alerting the user about duplicate registration.
**Rationale:** Registrations must be unique per owner to avoid data duplication and confusion between aircraft records. Different owners may independently hold entries for the same registration.
**Priority:** P2
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-AC-004@ -->

### REQ-AC-004: Profile Import

**Requirement:** The system shall import aircraft profiles from external exchange files.
**Rationale:** Facilitates offline backup and sharing of profiles without recompilation.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-AC-005@ (FROM: @H-011@) -->

### REQ-AC-005: Profile Verification Status

**Requirement:** The system shall implement a status system for aircraft profiles (`draft`, `verified` at rest; UI may label “Draft” / “Verified”). New or edited working copies are `draft` until explicitly verified; verified snapshots are immutable at the store layer. Calculations performed with a `draft` profile shall emit a persistent WARNING notification (`WARN-AC-002`) alerting the user that the active profile is unverified.
**Rationale:** Prevents usage of unverified or typo-prone POH data bases.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-AC-006@ -->

### REQ-AC-006: Passenger Profiles

**Requirement:** The system shall allow the user to create, update, and delete "Passenger Profiles" defined by a Name and a Standard Weight.
**Rationale:** Facilitates [REQ-UI-006](../requirements/user_interface.md#REQ-UI-006) (Quick Selection) and standardized fleet operations.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-AC-007@ (FROM: @H-011@) -->

### REQ-AC-007: Verification Provenance & Expiry

**Requirement:** When the user verifies an aircraft profile, the system shall require and record a sign-off provenance (verification date, verifier initials, and the POH revision verified against) bound to the source weighing report, and shall treat the verification as expired — surfacing it as unverified for safety-critical use — once it is older than a fixed validity period or its source weighing report no longer matches the recorded provenance.
**Rationale:** A single un-attributed "Verified" tap (REQ-AC-005) cannot evidence *who* checked the data, *against which POH revision*, or *whether the underlying weighing report has since changed*; provenance and expiry close the H-011 "Garbage-In" gap for stale or unattributable profile data.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
