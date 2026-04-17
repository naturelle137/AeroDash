# ADR-006: IndexedDB as Offline Fleet Persistence Store

<!-- @DES-ARCH-007@ (FROM: @REQ-AC-001@, @REQ-AC-004@, @REQ-AC-005@) -->

* **Status:** Accepted
* **Date:** 2026-04-09

## Context

AeroDash is an offline-first PWA. Aircraft profiles (fleet data) must persist
across page reloads without a backend server. The profile documents are large
structured objects (Zod-validated AircraftProfile aggregates) that must survive
browser restarts, support CRUD operations, and migrate safely across schema versions.

Candidate storage options considered:

1. `localStorage` — synchronous, 5–10 MB limit, string-only (requires serialisation)
2. `sessionStorage` — not persistent across tabs/restarts
3. **Native IndexedDB** — async, large capacity, structured object storage, no library
4. `idb` npm library — thin wrapper around IndexedDB
5. `Dexie.js` — full ORM over IndexedDB

## Considered Options

* **Option 1: localStorage + JSON.stringify:** Simple but synchronous (blocks UI),
  limited to ~5 MB, and fragile against partial writes.
* **Option 2: idb library:** Cleaner Promise API but adds a dependency. Unnecessary
  given the narrow surface area required by AeroDash.
* **Option 3: Native IndexedDB (chosen):** No additional dependency, sufficient API
  for our use case (put/get/getAll/delete), and supports `onupgradeneeded` for
  schema migrations. Promises wrapped in thin utilities in `fleet.repository.ts`.

## Decision

Use the native `IndexedDB` browser API directly via a thin repository
(`fleet.repository.ts`) with the following configuration:

| Setting | Value |
| :------ | :---- |
| Database name | `aerodash-fleet` |
| Database version | `2` (v2: normalize legacy `Draft`/`Verified` status to `draft`/`verified`) |
| Object store | `aircraft_profiles` |
| Key path | `id` (UUID string) |
| Indexes | `ownerId` (non-unique), `registration` (non-unique) |

### Migration Strategy

The `AircraftProfile.schemaVersion` field (integer, default `1`) enables safe
structured migration:

1. `onupgradeneeded` handler creates the object store and indexes on first open.
2. When DB version is bumped, the handler reads old records via a cursor, applies
   a migration transform, and writes the updated documents back.
3. Old records without `schemaVersion` are treated as `schemaVersion = 1`.
4. Migration code lives in `fleet.repository.ts` — P2, never P1.

### Safety Constraint on Draft/Verified

All new profiles are written with `status = 'draft'`. The `verifyProfile()`
store action writes the verified snapshot **before** deleting the draft —
ensuring the fleet is never empty between the two operations. See
[ADR-008](008-aircraft-profile-status-canonical-values.md) for canonical status values and migration.

## Consequences

### Positive

* Zero additional runtime dependency for fleet persistence.
* Survives page reloads, browser restarts, and service worker cache clears.
* `schemaVersion` field enables safe forward migration without data loss.
* Indexes on `ownerId` and `registration` allow efficient duplicate detection
  without loading the full fleet.

### Negative

* IndexedDB API is verbose; the repository wrapper must be maintained carefully.
* Migration code complexity grows with each schema version bump.
* Not available in Node.js test environments — integration tests require
  `fake-indexeddb` as a dev dependency.

## Compliance

Offline persistence of safety-critical aircraft data. All stored documents are
validated against `AircraftProfileSchema` (Zod) before use in P1 calculations,
satisfying the requirement that only schema-valid data reaches the Safety Core.
