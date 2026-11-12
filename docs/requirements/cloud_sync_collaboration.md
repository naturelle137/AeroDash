# AeroDash Software Requirements - Cloud, Sync & Collaboration (SC)

## Requirements

### REQ-SC-001: OIDC Authentication

The system shall authenticate users via external Identity Providers (OIDC).

### REQ-SC-002: Cloud Synchronization

While an internet connection is available, the system shall synchronize local databases with the cloud backend.

### REQ-SC-003: Workspace Segregation

The system shall give the user full access to their Personal Workspace.

### REQ-SC-004: Role-based Access Control

While the user is an Org Admin, the system shall permit management of organization users.

### REQ-SC-005: Share-Code Generation

The system shall allow users to share individual aircraft profiles via a generated unique alphanumeric ID (Share-Code).

### REQ-SC-006: Share-Code Import

When a valid Share-Code is entered, the system shall import a copy of the referenced aircraft profile into the user's Personal Workspace.

### REQ-SC-007: JSON Export

When the user exports aircraft profiles, the system shall produce a local JSON exchange file.

### REQ-SC-008: JSON Import Validation

When a local aircraft JSON file passes schema validation, the system shall import its aircraft profiles.

### REQ-SC-009: Organization conflicts

If Organization Data conflicts during synchronization, then the system shall retain the cloud version as the read-only local version.

### REQ-SC-010: Organization segregation

The system shall restrict Organization Workspace access to the user’s assigned organization roles.

### REQ-SC-011: Fleet admin

While the user is a Fleet Admin, the system shall permit aircraft profile creation.

### REQ-SC-012: Member aircraft access

While the user is a Member, the system shall restrict organization aircraft profiles to read-only access.

### REQ-SC-013: Member flight plans

While the user is a Member, the system shall permit creation of their own flight plans using organization aircraft profiles.

### REQ-SC-014: Flight-plan JSON export

When the user exports flight plans, the system shall produce a local JSON exchange file.

### REQ-SC-015: Reject invalid JSON

If an aircraft JSON file fails schema validation, then the system shall reject it before storage.

### REQ-SC-016: Workspace isolation

The system shall keep Personal Workspace data separate from Organization Workspace data.

### REQ-SC-017: Organization fleet management

While the user is an Org Admin, the system shall permit management of the organization fleet.

### REQ-SC-018: Fleet admin update

While the user is a Fleet Admin, the system shall permit aircraft profile updates.

### REQ-SC-019: Fleet admin deletion

While the user is a Fleet Admin, the system shall permit aircraft profile deletion.

### REQ-SC-020: Member plan editing

While the user is a Member, the system shall permit editing of their own flight plans using organization aircraft profiles.
