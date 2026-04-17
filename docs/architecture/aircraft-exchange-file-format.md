# Aircraft Profile Exchange File Format

<!-- @DES-ARCH-010@ (FROM: @REQ-AC-004@) -->

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
| Imported profile always forced to `status = 'Draft'` | Prevents unverified data being used in safety calculations without pilot review |
| Imported profile always receives a new UUID | Prevents ID collisions with existing fleet entries |
| Malformed JSON → `ImportError`, fleet unmodified | Atomicity: fleet is never partially updated |
| Zod validation failure → `ImportError`, fleet unmodified | All safety-critical fields must pass schema constraints before persistence |

## File Format

### File Extension and Encoding

`.aerodash.json` — UTF-8, no BOM, MIME type `application/json`.

### Top-Level Structure

The file is a single JSON object mapping directly to an `AircraftProfile` document.

```json
{
  "id": "<uuid-v4>",
  "schemaVersion": 1,
  "status": "Verified",
  "ownerId": "<user-identifier>",
  "registration": "D-EBPN",
  "manufacturer": "Tecnam",
  "model": "P2008 JC",
  "icaoTypeDesignator": "P208",
  "sourceUnit": "kg",
  "referenceDatumDescription": "Leading edge of wing",
  "referenceDatumLocation": "Station 0",
  "shareCode": null,
  "passengerProfiles": [],
  "weighingReports": [
    { "bem": 432.0, "emptyCg": 1.882, "weighingDate": "2025-01-01", "validFrom": "2025-01-01" }
  ],
  "loadPoints": [
    {
      "name": "Pilot", "arm": 1.8, "armLookup": [], "operationalLimit": 110,
      "defaultQuantity": 0, "unit": "kg", "allowableCategories": null, "fuelTank": null
    }
  ],
  "certificationCategories": [
    {
      "category": "Normal", "mtom": 650, "maxZeroFuelMass": null, "graphType": "arm",
      "envelope": [
        { "armOrMoment": 1.841, "mass": 432 }, { "armOrMoment": 1.841, "mass": 650 },
        { "armOrMoment": 1.978, "mass": 650 }, { "armOrMoment": 1.978, "mass": 432 }
      ]
    }
  ],
  "costPerHour": 185.5,
  "checklistScaffold": [{ "title": "Pre-flight", "items": ["Check fuel", "Check oil"] }]
}
```

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
| `status` | `'Draft' \| 'Verified'` | Overridden to `'Draft'` on import |
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
| `costPerHour` | `number` | Estimated operating cost per flight hour (non-negative) |
| `checklistScaffold` | `array` | Checklist section scaffold — structure only, no functional UI in M3 |
| `performanceProfiles` | `array` | M4 placeholder — ignored until milestone spec finalised |

## Import Pipeline (`profile.import.ts`)

1. **JSON parse** — malformed JSON throws `ImportError`
2. **Zod validation** — `AircraftProfileSchema.safeParse`. Failure throws `ImportError`
3. **Status override** — `status` forced to `'Draft'`
4. **ID reassignment** — new UUID v4 assigned to prevent collision
5. **Return** — caller persists via `fleetRepository.create()`

## Export

`exportProfileToJson(profile)` outputs `JSON.stringify(profile, null, 2)`.
Round-trip fidelity: all fields except `id` and `status` are preserved (verified by `UT-AC-STORE-023`).

## Schema Versioning

| Version | Description |
| :------ | :---------- |
| `1` | M2 + M3 fields including `costPerHour`, `checklistScaffold`, `passengerProfiles`, `status` |

## Related Documents

- `docs/architecture/aircraft_data_model.md` — Full aircraft data model
- `docs/architecture/adr/003-aircraft-data-model.md` — Aircraft data model ADR
- `docs/architecture/adr/006-indexeddb-fleet-persistence.md` — IndexedDB persistence ADR
- `frontend/src/core/adapters/aircraft.schema.ts` — Canonical Zod schema
- `frontend/src/modules/aircraft/services/profile.import.ts` — Import/export service
