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
| Imported profile is always forced to `status = 'Draft'` | Prevents unverified data from being used in safety calculations without pilot review |
| Imported profile always receives a new UUID | Prevents ID collisions with existing fleet entries |
| Malformed JSON → `ImportError` thrown, fleet unmodified | Atomicity: the fleet is never partially updated |
| Zod validation failure → `ImportError` thrown, fleet unmodified | All safety-critical fields must pass schema constraints before persistence |

## File Format

### File Extension

`.aerodash.json`

### Encoding

UTF-8, no BOM.

### MIME Type

`application/json`

### Top-Level Structure

The file is a single JSON object that maps directly to an `AircraftProfile`
document. All fields defined in `AircraftProfileSchema` may appear. The
`schemaVersion` field determines which version of the schema the file was
written against.

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
    {
      "bem": 432.0,
      "emptyCg": 1.882,
      "weighingDate": "2025-01-01",
      "validFrom": "2025-01-01"
    }
  ],
  "loadPoints": [
    {
      "name": "Pilot",
      "arm": 1.8,
      "armLookup": [],
      "operationalLimit": 110,
      "defaultQuantity": 0,
      "unit": "kg",
      "allowableCategories": null,
      "fuelTank": null
    }
  ],
  "certificationCategories": [
    {
      "category": "Normal",
      "mtom": 650,
      "maxZeroFuelMass": null,
      "graphType": "arm",
      "envelope": [
        { "armOrMoment": 1.841, "mass": 432 },
        { "armOrMoment": 1.841, "mass": 650 },
        { "armOrMoment": 1.978, "mass": 650 },
        { "armOrMoment": 1.978, "mass": 432 }
      ]
    }
  ],
  "costPerHour": 185.5,
  "checklistScaffold": [
    {
      "title": "Pre-flight",
      "items": ["Check fuel", "Check oil"]
    }
  ]
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
| `loadPoints` | `array` | Maximum 20 entries; each entry must satisfy arm XOR armLookup |
| `certificationCategories` | `array` | Minimum 1 entry; each envelope has 4–20 points |

## Optional Fields

| Field | Type | Description |
| :---- | :--- | :---------- |
| `passengerProfiles` | `array` | Standard passenger weight profiles (defaults to `[]`) |
| `windLimits` | `array` | Wind component limits |
| `surfaceConditions` | `array` | Runway surface correction factors |
| `safetyFactors` | `object` | Takeoff and landing safety multipliers |
| `costPerHour` | `number` | Estimated operating cost per flight hour (non-negative) |
| `checklistScaffold` | `array` | Checklist section scaffold (title + items) |
| `performanceProfiles` | `array` | M4 placeholder — ignored until milestone spec finalised |

## Import Behaviour

The import pipeline (`profile.import.ts`) performs the following steps:

1. **JSON parse** — `JSON.parse(jsonText)`. Malformed JSON throws `ImportError`.
2. **Zod validation** — `AircraftProfileSchema.safeParse(parsed)`. Any
   validation failure throws `ImportError` with a human-readable issues summary.
3. **Status override** — `status` is forced to `'Draft'` regardless of file value.
4. **ID reassignment** — A new UUID v4 is assigned to prevent collision with
   existing fleet entries.
5. **Return** — The validated `AircraftProfile` object is returned to the
   caller (typically the fleet store), which then persists it via
   `fleetRepository.create()`.

At no point is the fleet modified unless step 5 completes successfully.

## Export Behaviour

`exportProfileToJson(profile)` serialises the profile as:

```typescript
JSON.stringify(profile, null, 2)
```

The result is a pretty-printed JSON string with 2-space indentation. The
exported file can be re-imported with full round-trip fidelity (all fields
except `id` and `status` are preserved exactly).

## Round-Trip Fidelity

A profile exported with `exportProfileToJson` and re-imported with
`importProfileFromJson` must satisfy:

- All fields **except** `id` (reassigned) and `status` (forced `'Draft'`)
  are byte-identical to the original.

This guarantee is verified by unit test `UT-AC-STORE-023`.

## Versioning and Compatibility

The `schemaVersion` field tracks the data model version:

| Version | Description |
| :------ | :---------- |
| `1` | M2 + M3 fields: all current fields including `costPerHour`, `checklistScaffold`, `passengerProfiles`, `status` |

## Related Documents

- `docs/architecture/aircraft_data_model.md` — Full aircraft data model
- `docs/architecture/adr/003-aircraft-data-model.md` — Aircraft data model ADR
- `docs/architecture/adr/006-indexeddb-fleet-persistence.md` — IndexedDB persistence ADR
- `frontend/src/core/adapters/aircraft.schema.ts` — Canonical Zod schema
- `frontend/src/modules/aircraft/services/profile.import.ts` — Import/export service
