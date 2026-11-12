# 008: Aircraft document migration

## Decision

Keep IndexedDB database version and aircraft document schema version separate. The database is version 2 for legacy status normalization; `CURRENT_PROFILE_SCHEMA_VERSION` in `core/logic/profile-migrations.ts` is 1 at this baseline.

Repository reads run the pure `migrateProfileDocument()` boundary before accepting a profile. Missing or nonnumeric versions are treated as legacy version 0; the `0 → 1` migration stamps the version and the schema supplies its existing defaults. Structurally invalid documents return `corrupt`; newer unsupported versions return `unsupported-future-version` rather than silently losing unknown fields. The repository retains stored records and reports read issues; no automatic deletion is authorized.

On-read migration does not write migrated documents back to IndexedDB. Keep the legacy stamping step until an explicit persistent migration establishes a new floor; removing it would strand old profiles. Future version bumps must update the schema default, current-version constant, sequential pure transforms and boundary/reference tests together.

## Consequences

Existing user data remains recoverable on corrupt input or a downgrade. Database upgrades and document migrations have different responsibilities; a database version bump alone does not prove compatibility with a future profile schema. See [fleet persistence](006-indexeddb-fleet-persistence.md) and the executable migration/repository tests.
