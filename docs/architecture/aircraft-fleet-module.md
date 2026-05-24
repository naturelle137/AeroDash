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
│   ├── aircraft-model-catalogue.json — Static catalogue rows (manufacturer → model → ICAO)
│   └── aircraft-model-catalogue.ts   — Imports JSON + lookup helpers (getManufacturers, etc.)
├── services/
│   ├── fleet.repository.ts           — Native IndexedDB CRUD (aerodash-fleet DB)
│   ├── profile.validator.ts          — ICAO registration validation + duplicate check
│   └── profile.import.ts             — JSON exchange file import/export
├── stores/
│   ├── fleet.store.ts                — Fleet CRUD + Draft/Verified FSM; IndexedDB load emits LOADING/READY/ERROR
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
    ├── aircraft-model-catalogue.spec.ts — Unit tests (UT-AC-CAT-001..005)
    ├── AircraftModelSelector.spec.ts — Unit tests (UT-AC-VIEW-009..011)
    ├── fleet.store.spec.ts           — Unit tests (UT-AC-STORE-025..035)
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
                  │  - Safe for calculations      │
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
| Use in M&B calculation | Allowed; store prepends `WARN-AC-002` | Allowed, no draft warning |

## IndexedDB Schema

Database: `aerodash-fleet`, Version: `1`

| Object Store | Key Path | Indexes |
| :----------- | :------- | :------ |
| `aircraft_profiles` | `id` (UUID) | `ownerId` (non-unique), `registration` (non-unique) |

The `schemaVersion` field on each document enables structured migration in the
`onupgradeneeded` handler without data loss. See
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
