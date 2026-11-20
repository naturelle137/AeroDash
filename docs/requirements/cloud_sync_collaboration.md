# AeroDash Software Requirements - Cloud, Sync & Collaboration (SC)

## Implementation boundary

The shipped app is frontend-only. REQ-SC-007/008/015 cover existing local
aircraft JSON export, validated import and invalid-file rejection. REQ-SC-014
remains unimplemented: the current briefing pack uses browser printing, not
flight-plan JSON export. The remaining remote identity, cloud, Share-Code and
organization requirements describe future behavior; schema `ownerId`/`shareCode`
fields do not implement identity or network sharing.

The briefing pack can be labelled as an unapproved student handover copy for
local print or PDF. This is a read-only snapshot, not an editable plan transfer,
role check, review record or authenticated counter-signature.

Future remote changes are subject to the [pre-sync engineering gate](../architecture/adr/014-pre-sync-privacy-gate.md).
That prerequisite is not a completed DPIA or approval of a lawful basis; #285
remains open. Existing offline/manual preparation, local storage, local JSON
export/import and local data erasure remain available without cloud or accounts.

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

### REQ-SC-021: Remote processing prerequisite

Before OIDC, cloud synchronization, network Share-Code or organization synchronization code is integrated, the project shall record CTO release of the operation-specific gate in ADR-014.

### REQ-SC-022: Existing local data publication

When connectivity returns or the app is upgraded, the system shall retain existing local records without automatically uploading them.

### REQ-SC-023: Unapproved local handover copy

When the user selects the student handover label, the briefing pack shall identify the copy as unapproved and state that instructor review and authenticated counter-signature are not recorded by AeroDash.

### REQ-SC-024: Handover names and review block

Where the student handover label is selected, the briefing pack shall print optional entered student and instructor names marked self-declared and unverified, followed by a blank review block, without storing the names.
