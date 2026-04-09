# Aircraft Fleet Module Architecture

<!-- @DES-ARCH-009@ (FROM: @REQ-AC-001@, @REQ-AC-005@) -->

## Overview

The Aircraft Fleet Module (`frontend/src/modules/aircraft/`) is a **P2 Feature
Module** that provides fleet CRUD operations, the Draft/Verified profile status
FSM, in-session aircraft switching, and the aircraft model hierarchy selector.

It depends on the **P1 Safety Core** (`src/core/`) for schema validation but is
itself strictly P2 — it may use Vue, Pinia, and browser APIs.

## Module Layout

```text
frontend/src/modules/aircraft/
├── data/
│   └── aircraft-model-catalogue.ts   — Static manufacturer/model/ICAO catalogue
├── services/
│   ├── fleet.repository.ts           — Native IndexedDB CRUD (aerodash-fleet DB)
│   ├── profile.validator.ts          — ICAO registration validation + duplicate check
│   └── profile.import.ts             — JSON exchange file import/export
├── stores/
│   ├── fleet.store.ts                — Fleet CRUD + Draft/Verified FSM (Pinia)
│   └── active-aircraft.store.ts      — In-session active aircraft context (Pinia)
├── components/
│   ├── AircraftModelSelector.vue     — Manufacturer→Model→ICAO hierarchy selector
│   ├── ProfileStatusBadge.vue        — Draft/Verified status badge
│   └── FleetList.vue                 — Fleet list with CRUD and selection
├── views/
│   └── FleetManagementView.vue       — Main fleet management page (/fleet route)
└── __tests__/
    ├── profile.validator.spec.ts     — Unit tests (UT-AC-STORE-001..016)
    ├── profile.import.spec.ts        — Unit tests (UT-AC-STORE-017..024)
    ├── fleet.store.spec.ts           — Unit tests (UT-AC-STORE-025..033)
    └── fleet.repository.int.spec.ts  — Integration tests (IT-AC-STORE-001..004)
```

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
display. P2 never calls back into P1 — P1 functions are invoked from P2 only.

## Draft/Verified State Machine

```text
                   ┌─────────────────────────────────┐
                   │          NEW PROFILE              │
                   │     createProfile() → Draft       │
                   └──────────────┬──────────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │           DRAFT               │◄──────────────────┐
                  │  - Editable in-place          │                   │
                  │  - Emits WARN-AC-002          │                   │
                  │    when used in calculation   │                   │
                  └─────────────┬─────────────────┘                   │
                                │                                     │
                     verifyProfile()                    editVerifiedProfile()
                     (new UUID, new snapshot)           (new UUID, Draft copy)
                                │                                     │
                                ▼                                     │
                  ┌───────────────────────────────┐                   │
                  │          VERIFIED             │───────────────────┘
                  │  - Immutable (read-only)      │
                  │  - Safe for calculations      │
                  │  - updateProfile() BLOCKED    │
                  └───────────────────────────────┘
```

### FSM Rules

| Action | From Draft | From Verified |
| :----- | :--------- | :------------ |
| `updateProfile()` | Allowed | **Blocked** — throws `VerifiedMutationError` |
| `verifyProfile()` | Creates Verified snapshot (new UUID), deletes Draft | Error: already Verified |
| `editVerifiedProfile()` | Error: not Verified | Creates Draft copy (new UUID), Verified unchanged |
| `deleteProfile()` | Allowed | Allowed |
| Use in calculations | Allowed + WARN-AC-002 | Allowed, no warning |

## IndexedDB Schema

Database: `aerodash-fleet`, Version: `1`

| Object Store | Key Path | Indexes |
| :----------- | :------- | :------ |
| `aircraft_profiles` | `id` (UUID) | `ownerId` (non-unique), `registration` (non-unique) |

The `schemaVersion` field on each document enables structured migration in the
`onupgradeneeded` handler without data loss. See
[ADR-006](adr/006-indexeddb-fleet-persistence.md) for migration strategy.

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
