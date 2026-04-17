# ADR-008: IndexedDB Schema Migration Strategy for AircraftProfile

<!-- @DES-ARCH-008@ (FROM: @REQ-AC-004@, @REQ-AC-005@) -->

* **Status:** Accepted
* **Date:** 2026-04-10

## Context

AeroDash is an offline-first PWA. `AircraftProfile` documents are persisted in
IndexedDB (`aerodash-fleet`, object store `aircraft_profiles`) as defined in
ADR-006. As the application evolves across milestones, the shape of
`AircraftProfile` will change: new required fields are added, optional fields
become required, types are narrowed, and sub-schemas are extended.

Without a controlled migration strategy, existing user data becomes unreadable
(parse errors at the Zod boundary) or silently incorrect (missing fields default
to unexpected values). Both outcomes are unacceptable in a safety-critical
aviation tool.

The `schemaVersion` integer field (`z.number().int().positive().default(1)`)
was added to every persisted `AircraftProfile` document in Milestone 3 (M3)
to enable safe, structured migration (refs GitHub #154, #166).

## Considered Options

* **Option 1 — IndexedDB `onupgradeneeded` only (version-number migration):**
  Bump the IndexedDB database version integer on every schema change and run a
  cursor migration inside `onupgradeneeded`. Simple for a single store, but the
  `onupgradeneeded` handler only fires when the DB version number changes. It
  does not support in-place document migration without bumping the DB version,
  and it cannot detect or repair partially-migrated documents.

* **Option 2 — Document-level `schemaVersion` field with lazy migration
  (chosen):** Store a `schemaVersion` integer on every persisted document.
  On `findById` / `findAll`, inspect the `schemaVersion` of the returned raw
  document and apply incremental migration transforms before passing the result
  to the Zod parser. Documents are written back with the current `schemaVersion`
  after a successful migration. No DB version bump is needed for document-level
  changes.

* **Option 3 — Versioned stores (per-milestone object store):** Create a new
  object store per milestone (e.g., `aircraft_profiles_v2`). Old stores are
  migrated in `onupgradeneeded` and then dropped. High operational complexity,
  requires coordinated DB version bumps, and risks data loss if migration
  partially fails.

## Decision

Adopt **Option 2**: document-level `schemaVersion` with lazy migration at the
repository read boundary (`findById`, `findAll`).

### Detection Logic

1. Read the raw document from IndexedDB (untyped `unknown` at this point).
2. Extract `schemaVersion`. If the field is absent or not a positive integer,
   treat the document as `schemaVersion = 1` (the baseline established in M3).
3. Compare `schemaVersion` against `CURRENT_SCHEMA_VERSION` (a constant
   exported from `fleet.repository.ts`).
4. If `schemaVersion < CURRENT_SCHEMA_VERSION`, run the migration chain
   (see below).
5. After migration the document passes through `AircraftProfileSchema.parse()`.
   A failed parse is surfaced as a `MigrationError` — the document is quarantined
   (not deleted) and the user is notified.

### Migration Path per Version Delta

Migrations are modelled as a chain of pure functions, each accepting and
returning an untyped record. Each step brings the document from
`schemaVersion = N` to `schemaVersion = N+1`.

| Version delta | Transform applied                                                         |
| :------------ | :------------------------------------------------------------------------ |
| `1 -> 2`      | Add `passengerProfiles: []` if absent. Add `status: 'Draft'` if absent.   |
| `2 -> 3`      | *(future - reserved)*                                                     |

```text
migrate(raw, fromVersion, toVersion):
  while fromVersion < toVersion:
    raw = MIGRATIONS[fromVersion](raw)
    fromVersion += 1
  return raw
```

The migration transform is applied before Zod parsing, so the parser always
sees a document at `CURRENT_SCHEMA_VERSION`.

After a successful migration the updated document is written back to IndexedDB
via `put()`, so future reads are fast (no re-migration needed).

### Fallback Behavior

If the migration chain throws for a given document (e.g., data is corrupt or
a transform assumption fails):

1. The raw document is preserved in IndexedDB untouched (no data deletion).
2. A `MigrationError` is thrown from `findById`/`findAll`.
3. The fleet store catches the error and emits an `ERROR` severity notification
   identifying the affected registration (if readable) and advising the user to
   re-import the profile from a backup.
4. The corrupted document is excluded from the fleet list but not deleted,
   allowing manual recovery.

### Portability Format (IndexedDB Schema Documentation)

The following table documents the canonical field set of a version-1
`AircraftProfile` document as persisted in IndexedDB. This format is the
baseline for all future migrations and for tools that inspect the IndexedDB
store directly (e.g., DevTools, integration tests with `fake-indexeddb`).

| Field | Type | Default | Notes |
| :---- | :--- | :------ | :---- |
| `id` | `string` (UUID v4) | — | Primary key. Indexed. |
| `ownerId` | `string` | — | Indexed (non-unique). |
| `registration` | `string` | — | Indexed (non-unique). |
| `manufacturer` | `string` | — | |
| `model` | `string` | — | |
| `icaoTypeDesignator` | `string` | — | |
| `sourceUnit` | `string` | — | |
| `referenceDatumDescription` | `string` | — | |
| `referenceDatumLocation` | `string` | — | |
| `shareCode` | `string \| null` | `null` | |
| `status` | `'Draft' \| 'Verified'` | `'Draft'` | M3 field |
| `schemaVersion` | `number` (positive int) | `1` | M3 migration key |
| `passengerProfiles` | `PassengerProfile[]` | `[]` | M3 field |
| `weighingReports` | `WeighingReport[]` | — | Min 1 element |
| `loadPoints` | `LoadPoint[]` | — | Max 20 elements |
| `certificationCategories` | `CertificationCategory[]` | — | Min 1 element |
| `windLimits` | `WindLimit[]` | `undefined` | Optional |
| `surfaceConditions` | `SurfaceCondition[]` | `undefined` | Optional |
| `safetyFactors` | `SafetyFactors` | `undefined` | Optional |
| `costPerHour` | `number` | `undefined` | Optional, M3 |
| `checklistScaffold` | `ChecklistScaffoldItem[]` | `undefined` | Optional, M3 |
| `performanceProfiles` | `unknown[]` | `undefined` | M4 placeholder |

All documents are validated against `AircraftProfileSchema` (Zod) before use
in P1 calculations. No raw-document value ever reaches the Safety Core without
passing through the Zod boundary.

## Consequences

### Positive

* Documents can be migrated without bumping the IndexedDB DB version, which
  avoids triggering `onupgradeneeded` for document-level changes.
* Lazy migration at read time is transparent to the rest of the application:
  callers always receive a fully up-to-date `AircraftProfile`.
* The migration chain is fully tested in the Node.js integration test
  environment (`fake-indexeddb`) without browser involvement.
* Corrupted documents are never silently deleted — they are quarantined and
  reported to the user.

### Negative

* Every `findById`/`findAll` call incurs a `schemaVersion` check. For typical
  fleet sizes (< 50 profiles) the overhead is negligible.
* Migration code must be maintained alongside the schema and can accumulate
  over many milestones. Each migration step must be thoroughly tested.
* The write-back after migration requires a `readwrite` transaction on read
  paths; callers must be aware that `findById`/`findAll` may mutate the store.

## Compliance

Offline persistence of safety-critical aircraft data. All stored documents are
validated against `AircraftProfileSchema` (Zod) before use in P1 calculations.
The migration strategy ensures that no stale or partially-migrated document can
reach the Safety Core, preserving the integrity of Go/No-Go advisories.
