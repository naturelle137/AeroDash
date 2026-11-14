# Aircraft Fleet Module Architecture

## Overview

The Aircraft Fleet Module (`frontend/src/modules/aircraft/`) is a **P2 Feature
Module** that provides fleet CRUD operations, the Draft/Verified profile status
FSM, in-session aircraft switching, and the aircraft model hierarchy selector.

It depends on the **P1 Safety Core** (`src/core/`) for schema validation but is
itself strictly P2 — it may use Vue, Pinia, and browser APIs.

## Module Layout

`services/` owns IndexedDB persistence, profile validation and JSON exchange; `stores/` orchestrates fleet/profile state; `components/` and `views/` implement the list, six-step wizard, editor and verification dialogs. Tests live alongside these modules. The executable tree is authoritative; avoid duplicating inventories of test IDs here.

## P1 / P2 Boundary

```text
P1 Safety Core (src/core/)          P2 Feature Module (src/modules/aircraft/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AircraftProfileSchema (Zod)    →   fleet.repository.ts (reads/writes validated docs)
AircraftProfile (type)         →   fleet.store.ts (orchestrates FSM logic)
AircraftProfileStatus (type)   →   ProfileStatusBadge.vue (displays status)
PassengerProfileSchema         →   FleetManagementView.vue (passenger profile form)
```

P1 only exports pure types and schemas. P2 imports them for validation and
display. P2 calls P1 functions; P1 never imports or calls back into P2.

## Draft/Verified State Machine

```text
                   ┌─────────────────────────────────┐
                   │          NEW PROFILE              │
                   │     createProfile() → draft       │
                   └──────────────┬──────────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │           draft               │◄──────────────────┐
                  │  - Editable in-place          │                   │
                  │  - Emits WARN-AC-002          │                   │
                  │    in Mass & Balance when used  │                   │
                  │    for computation (REQ-AC-005) │                   │
                  └─────────────┬─────────────────┘                   │
                                │                                     │
                     verifyProfile()                    editVerifiedProfile()
                     (new UUID, new snapshot)           (same id, Verified → Draft)
                                │                                     │
                                ▼                                     │
                  ┌───────────────────────────────┐                   │
                  │          verified             │───────────────────┘
                  │  - Immutable (read-only)      │
                  │  - Provenance still evaluated      │
                  │  - updateProfile() BLOCKED    │
                  └───────────────────────────────┘
```

### FSM Rules

| Action | From draft | From verified |
| :----- | :--------- | :------------ |
| `updateProfile()` | Allowed | **Blocked** — throws `VerifiedMutationError` |
| `verifyProfile()` | Creates verified snapshot (new UUID), deletes draft | Error: already verified |
| `editVerifiedProfile()` | Error: not verified | Replaces record in place (same id) with status `draft` and merged changes |
| `deleteProfile()` | Allowed | Allowed |
| Use in M&B calculation | Allowed; store prepends `WARN-AC-002` | Subject to provenance/expiry and acknowledgement safeguards |

## IndexedDB Schema

Database: `aerodash-fleet`, Version: `2` (legacy status normalization)

| Object Store | Key Path | Indexes |
| :----------- | :------- | :------ |
| `aircraft_profiles` | `id` (UUID) | `ownerId` (non-unique), `registration` (non-unique) |

The `schemaVersion` field on each document enables structured migration in repository migrations without data loss. See
[ADR-006](adr/006-indexeddb-fleet-persistence.md) for migration strategy.

## Fleet list hydration (`useFleetStore`)

`loadAll()` reads the full fleet from IndexedDB asynchronously. The store exposes:

| Field | Purpose |
| :---- | :------ |
| `fleetLoadState` | Initial `'LOADING'` until the first `loadAll()` completes; then `'LOADING'` while `findAll()` is in flight; `'READY'` on success; `'ERROR'` on failure |
| `fleetLoadError` | Human-readable message when `fleetLoadState === 'ERROR'` |
| `isLoading` | Computed alias for `fleetLoadState === 'LOADING'` (legacy) |

`FleetList.vue` shows loading, error (with retry), or the profile list accordingly.

## Model catalogue data

Manufacturer → model → ICAO rows live in `aircraft-model-catalogue.json` (versioned source of truth). `aircraft-model-catalogue.ts` imports that JSON and exports pure helpers (`getManufacturers`, `getModelsByManufacturer`, `findByIcaoDesignator`, `findUniqueByIcaoDesignator`). Editing the catalogue means editing the JSON file only.

## Related Requirements

| Requirement | Implemented By |
| :---------- | :------------- |
| REQ-AC-001 (CRUD) | `fleet.store.ts`, `FleetManagementView.vue` |
| REQ-AC-002 (Registration validation) | `profile.validator.ts` |
| REQ-AC-003 (Duplicate warning) | `fleet.store.ts` (WARN-AC-001) |
| REQ-AC-004 (Profile import) | `profile.import.ts` |
| REQ-AC-005 (Draft/Verified FSM) | `fleet.store.ts`, `active-aircraft.store.ts` |
| REQ-AC-006 (Passenger profiles) | `fleet.store.ts`, `FleetManagementView.vue` |
| REQ-UI-001–004 (Model selector) | `AircraftModelSelector.vue`, `aircraft-model-catalogue.ts` |
| REQ-UI-006 (Passenger selection) | `FleetManagementView.vue` |
| REQ-AD-006 (Cost per hour) | `AircraftProfileSchema.costPerHour` |
| REQ-AD-010 (Checklist scaffold) | `AircraftProfileSchema.checklistScaffold` |

## Verification provenance

Both verification actions reject invalid/future `YYYY-MM-DD` dates before persistence. Sign-offs bind date, verifier initials and POH revision to the source weighing report. Expiry begins at exactly 90 UTC calendar days; changed weighing reports and invalid stored dates fail closed. Legacy missing provenance retains `verified-unattributed` semantics. These are software guards, not validation of the entered POH data.

## Offline fleet backup restore

Fleet accepts the existing Privacy `exportSchemaVersion: 1` envelope separately
from single-profile exchange. A JSON file/type guard caps reads at 5 MiB; parsing
requires 1–100 records and an exact `profileCount` before profile migration.
Every record passes the existing exchange migration, fresh-ID and draft rules;
verification sign-off is removed while source references, units and data remain.
The user reviews all registrations and confirms explicitly. Cancel writes nothing.

`fleet.import.ts` validates the batch and case-insensitive registrations outside
Vue. `restoreBatch` rechecks all raw persisted registrations inside the same
readwrite transaction as all `add` requests, including unreadable stored rows and
changes since preview. No overwrite, skip or rename is allowed. Request errors
or abort roll back all additions; success resolves only at transaction completion.
The store appends the validated snapshot only after commit and does not select an
aircraft or mutate preparation. A storage failure retains the preview for retry.
Single-profile exchange keeps its existing workflow. These bounds cover local
backup recovery, not cloud sync, preferences/app lock or operational validation.
