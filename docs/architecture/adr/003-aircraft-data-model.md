# 003-aircraft-data-model: Aggregate-Root Document Model for Aircraft Profiles

- **Status:** Accepted
- **Date:** 2026-03-05

## Context

AeroDash must store detailed aircraft configuration data covering 19 requirements (REQ-AD-001 through REQ-AD-019). This data includes identification attributes, load points, fuel tanks with burn sequences, weighing reports with versioning, multiple certification categories each with their own CG envelope, performance profiles with up to 1000 data points, wind limits, surface conditions, safety factors, checklists, operating costs, a share-code, and owner identity.

The data model must support:

1. **Offline-first access** — fast, single-lookup reads from IndexedDB without network dependency.
2. **Zod schema validation** — structural validation in the Safety Core (`core/validation/`) before any data enters the calculation pipeline.
3. **JSON export/import** — direct serialization/deserialization for data portability (REQ-SC-007, REQ-SC-008).
4. **Cloud sync** — atomic sync units to avoid partial-profile conflicts during bidirectional synchronization.
5. **Original unit preservation** — all values stored in the manufacturer's POH/AFM units (REQ-AD-014), never silently converted.

## Considered Options

- **Flat document model:** Store the entire aircraft profile as a single flat JSON object with all fields at the top level. Simple to implement, but loses structural clarity for nested concepts like fuel tank ↔ load point relationships, certification categories with independent envelopes, and versioned weighing reports. Validation logic becomes unwieldy.

- **Normalised relational-like model:** Separate entity types (LoadPoints, WeighingReports, PerformanceProfiles, etc.) stored as distinct IndexedDB object stores joined by foreign keys. Provides clean separation but introduces multi-store transactions, complex join logic for reads, and partial-sync risks — all antithetical to an offline-first PWA where single-read speed and atomic consistency are essential.

- **Aggregate-root document with typed sub-entities:** A single `AircraftProfile` document acts as the aggregate root. Sub-entities (LoadPoint, FuelTankExtension, CertificationCategory, WeighingReport, etc.) are embedded arrays/objects within the root. Complex relationships (e.g., a LoadPoint optionally extended by FuelTankExtension) are expressed through composition rather than foreign keys.

## Decision

We adopt the **aggregate-root document with typed sub-entities** pattern.

Each `AircraftProfile` is a self-contained JSON document stored as a single IndexedDB record. Sub-entities are embedded within the root, not stored separately. The model is defined and documented in [`docs/architecture/aircraft_data_model.md`](../aircraft_data_model.md).

Key design choices within this model:

1. **Composition over inheritance for FuelTanks:** Fuel tanks are `LoadPoint` entities with an optional `FuelTankExtension` property, rather than a separate subclass. This keeps the LoadPoint array uniform while cleanly adding fuel-specific fields (unusable fuel, permissible types, burn sequences).

2. **Weighing reports as versioned array:** `WeighingReport` entries are stored as an array with a `validFrom` date, supporting historical traceability without separate stores.

3. **Envelope per certification category:** Each `CertificationCategory` carries its own `mtom` and `envelope` polygon, supporting aircraft like the Klemm 107B with distinct limits per category.

4. **Conditional arm representation:** `LoadPoint.arm` (scalar) and `LoadPoint.armLookup` (table) are mutually exclusive, modelled as conditional nullable fields validated by Zod refinement.

5. **Compound index for owner uniqueness:** `ownerId` + `registration` is indexed to enforce per-owner registration uniqueness (REQ-AC-003, REQ-AD-019).

6. **MTOM and envelope owned by CertificationCategory, not the reverse:** Each certification category has a completely independent MTOM and CG envelope polygon — they are not subsets or filtered views of a shared pool. Storing them on `CertificationCategory` ensures the calculation engine (REQ-MB-001, REQ-MB-004) can access MTOM, envelope, and graph type via a single dereference (`selectedCategory.envelope`) rather than joining separate structures. The alternative — storing envelope polygons at the profile level with a category tag — was rejected because it would artificially split cohesive data that is always consumed together.

7. **Load point availability stored on LoadPoint, not on CertificationCategory:** Each `LoadPoint` carries an optional `allowableCategories` field listing the certification categories in which it is available (`null` = all). The alternative — storing allowed load point indices on `CertificationCategory` — was rejected because index-based references into the `loadPoints` array are fragile (they break on reorder, insert, or delete) and require cascading updates across every category. Placing the restriction on the load point itself provides a single point of edit, avoids fragile coupling, and yields a natural filter: `loadPoints.filter(lp => lp.allowableCategories?.includes(activeCategory) ?? true)`.

## Consequences

### Positive

- **Single-read performance:** One IndexedDB `get()` call retrieves everything needed for a calculation — critical for offline responsiveness.
- **Atomic sync:** The entire profile syncs as one unit, eliminating partial-profile inconsistencies.
- **Natural JSON mapping:** `JSON.stringify` / `JSON.parse` of the document produces a valid exchange file, trivially satisfying REQ-SC-007/008.
- **Zod-friendly structure:** The nested type hierarchy maps directly to Zod's `z.object()` / `z.array()` composition, with refinements for conditional fields and cardinality constraints.

### Negative

- **Document size:** Heavily configured aircraft (many load points, 1000+ performance data points across four profiles) may produce documents of several hundred KB. This is acceptable for IndexedDB but should be monitored.
- **Partial updates:** Updating a single field requires reading and rewriting the entire document. Given the relatively low write frequency (profile editing, not real-time telemetry), this is an acceptable trade-off.

## Compliance

The data model preserves manufacturer-original units (REQ-AD-014 / H-001), ensuring no silent unit conversions occur at the storage layer. All unit normalization is deferred to the Safety Core's runtime conversion layer (`src/core/units/`).
