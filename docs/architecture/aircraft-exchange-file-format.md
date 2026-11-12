# Aircraft Profile Exchange File Format

**Version:** 1.0
**Date:** 2026-04-10
**Status:** Approved
**ADR:** [003-aircraft-data-model](adr/003-aircraft-data-model.md)

## Overview

The AeroDash **aircraft profile exchange file** is a plain JSON document that
represents a single `AircraftProfile` aggregate root, serialised with
`JSON.stringify`. It is used to transfer aircraft configuration data between
AeroDash installations or to back up a profile offline.

The format is defined by and validated against the canonical
`AircraftProfileSchema` (Zod) in
`frontend/src/core/adapters/aircraft.schema.ts`.

## Safety Constraints

| Constraint | Rationale |
| :--------- | :-------- |
| Imported profile always forced to `status = 'draft'` | Prevents unverified data being used in safety calculations without pilot review |
| Imported profile always receives a new UUID | Prevents ID collisions with existing fleet entries |
| Malformed JSON → `ImportError`, fleet unmodified | Atomicity: fleet is never partially updated |
| Zod validation failure → `ImportError`, fleet unmodified | All safety-critical fields must pass schema constraints before persistence |

## File Format

### File Extension and Encoding

`.aerodash.json` — UTF-8, no BOM, MIME type `application/json`.

### Top-Level Structure

The file is a single JSON object mapping directly to an `AircraftProfile` document.

The executable format is `AircraftProfileSchema` in `frontend/src/core/adapters/aircraft.schema.ts`; use the existing test fixtures for synthetic examples. No example here is operational aircraft data.

## Required Fields

| Field | Type | Constraint |
| :---- | :--- | :--------- |
| `id` | `string` | UUID v4 format |
| `schemaVersion` | `integer` | Positive integer (currently `1`) |
| `ownerId` | `string` | Non-empty |
| `registration` | `string` | Non-empty |
| `manufacturer` | `string` | Non-empty |
| `model` | `string` | Non-empty |
| `icaoTypeDesignator` | `string` | Non-empty |
| `sourceUnit` | `string` | Non-empty |
| `referenceDatumDescription` | `string` | Non-empty |
| `referenceDatumLocation` | `string` | Non-empty |
| `shareCode` | `string \| null` | Nullable |
| `status` | `'draft' \| 'verified'` | Overridden to `'draft'` on import |
| `weighingReports` | `array` | Minimum 1 entry |
| `loadPoints` | `array` | Max 20; each entry must satisfy arm XOR armLookup |
| `certificationCategories` | `array` | Min 1; each envelope 4–20 points |

## Optional Fields

| Field | Type | Description |
| :---- | :--- | :---------- |
| `passengerProfiles` | `array` | Standard passenger weight profiles (defaults to `[]`) |
| `windLimits` | `array` | Wind component limits |
| `surfaceConditions` | `array` | Runway surface correction factors |
| `safetyFactors` | `object` | Takeoff and landing safety multipliers |
| `costPerHour` | `number` | Estimated operating cost per flight hour (non-negative). **Excluded from the default export** — see [Export](#export) (REQ-AD-023). |
| `fuelCostIncluded` | `boolean` | Whether fuel cost is bundled into `costPerHour` (REQ-AD-006). **Excluded from the default export** alongside `costPerHour` (REQ-AD-023). |
| `checklistScaffold` | `array` | Checklist section scaffold — structure only, no functional UI in M3 |
| `performanceProfiles` | `array` | One entry per flight phase (`TakeoffRoll`, `TakeoffDistance50ft`, `LandingRoll`, `LandingDistance50ft`); each carries up to 1000 interpolation data points (REQ-AD-008, REQ-AD-009) |

## Import Pipeline (`profile.import.ts`)

1. **JSON parse** — malformed JSON throws `ImportError`
2. **Zod validation** — `AircraftProfileSchema.safeParse`. Failure throws `ImportError`
3. **Status override** — `status` forced to `'draft'`
4. **ID reassignment** — new UUID v4 assigned to prevent collision
5. **Return** — caller persists via `fleetRepository.create()`

## Export

`exportProfileToJson(profile)` wraps the profile in the
`{ format: 'aerodash-aircraft', version, profile }` envelope (since #259) and
serialises it with `JSON.stringify(..., null, 2)`.

**Default data minimisation (REQ-AD-023, audit DP-008/DP-009):** the operating-cost
fields (`costPerHour`, `fuelCostIncluded`) are **excluded** from the exported
`profile` by default — they are private financial data not required to share or
back up an aircraft configuration. Pass `exportProfileToJson(profile, { includeOperatingCost: true })`
(and likewise `downloadProfileAsJson`) to retain them.

Round-trip fidelity: all fields except `id`, `status`, and the default-excluded
operating-cost fields are preserved (verified by `UT-AC-STORE-023` / `UT-AC-STORE-124`).

## Schema Versioning

| Version | Description |
| :------ | :---------- |
| `1` | M2 + M3 fields including `costPerHour`, `fuelCostIncluded`, `checklistScaffold`, `passengerProfiles`, `status`, and fully-typed `performanceProfiles` (REQ-AD-008, REQ-AD-009) |

## Related Documents

- `docs/architecture/aircraft_data_model.md` — Full aircraft data model
- `docs/architecture/adr/003-aircraft-data-model.md` — Aircraft data model ADR
- `docs/architecture/adr/006-indexeddb-fleet-persistence.md` — IndexedDB persistence ADR
- `frontend/src/core/adapters/aircraft.schema.ts` — Canonical Zod schema
- `frontend/src/modules/aircraft/services/profile.import.ts` — Import/export service
