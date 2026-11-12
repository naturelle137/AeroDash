# AeroDash Architecture - Aircraft Data Model

**Version:** 1.0
**Date:** 2026-03-05
**Status:** Approved
**ADR:** [003-aircraft-data-model](adr/003-aircraft-data-model.md)

## 1. Overview

This document defines the **Aircraft Profile** data model — the aggregate-root document that represents a single aircraft configuration within AeroDash. It is the central data structure consumed by the Safety Core (Mass & Balance, Performance, Fuel & Endurance), stored in IndexedDB, and exported/imported as JSON.

The model is designed as a **single document aggregate** optimized for:

- Single-key IndexedDB lookups (offline-first)
- Zod schema validation in `core/validation/`
- Direct JSON serialization for export/import
- Cloud sync as an atomic unit

## 2. Executable model

`frontend/src/core/adapters/aircraft.schema.ts` is the executable record contract. The field descriptions below preserve domain meaning and limits; schema validation and reference tests govern accepted data. [ADR-008](adr/008-indexeddb-migration-strategy.md) defines actual version handling.

Powertrain is `combustion` (legacy default) or `electric`. Electric profiles require exactly one battery pack and reject fuel tanks; combustion profiles reject a battery pack. Battery usable energy must be positive, reserve nonnegative and below usable energy, optional voltage positive. [Native electric UX](../ux/native-electric-aircraft.md) separates creation choices from the persisted editor’s locked powertrain.

Stations carry optional `occupancy: required | optional` independently of kind. See [occupancy](optional-occupancy.md) for conservative missing-metadata behavior and exchange/persistence rules. Verification provenance contains sign-off date, initials, POH revision and weighing-report identity; see [fleet verification](aircraft-fleet-module.md#verification-provenance).

## 3. Entity Definitions

### 3.1 AircraftProfile (Root)

The top-level aggregate root. One IndexedDB record = one `AircraftProfile`.

| Field                       | Type                      | Required | Description                                       |
| :-------------------------- | :------------------------ | :------: | :------------------------------------------------ |
| `id`                        | `string`                  |   Yes    | Unique profile identifier (UUID v4).              |
| `ownerId`                   | `string`                  |   Yes    | Identifier of the owning user.                    |
| `registration`              | `string`                  |   Yes    | Aircraft registration (e.g., `D-EBPF`).           |
| `manufacturer`              | `string`                  |   Yes    | Aircraft manufacturer.                            |
| `model`                     | `string`                  |   Yes    | Aircraft model designation.                       |
| `icaoTypeDesignator`        | `string`                  |   Yes    | ICAO type designator code.                        |
| `sourceUnit`                | `string`                  |   Yes    | M&B units; performance units are independent.     |
| `referenceDatumDescription` | `string`                  |   Yes    | Textual description of the reference datum.       |
| `referenceDatumLocation`    | `string`                  |   Yes    | Physical location of the reference datum.         |
| `shareCode`                 | `string \| null`          |    No    | Share-code for ad-hoc profile sharing.            |
| `costPerHour`               | `number`                  |    No    | See Section 3.8. Non-negative.                    |
| `fuelCostIncluded`          | `boolean`                 |    No    | See Section 3.8. True when fuel is included.      |
| `weighingReports`           | `WeighingReport[]`        |   Yes    | See Section 3.2. At least one entry required.     |
| `loadPoints`                | `LoadPoint[]`             |   Yes    | See Section 3.3. Max 20.                          |
| `certificationCategories`   | `CertificationCategory[]` |   Yes    | See Section 3.5. At least one entry required.     |
| `performanceProfiles`       | `PerformanceProfile[]`    |    No    | See Section 3.6.                                  |
| `surfaceConditions`         | `SurfaceCondition[]`      |    No    | See Section 3.7.                                  |
| `safetyFactors`             | `SafetyFactors`           |    No    | See Section 3.7.                                  |
| `windLimits`                | `WindLimit[]`             |    No    | See Section 3.9.                                  |
| `checklistScaffold`         | `ChecklistScaffoldItem[]` |    No    | See Section 3.10.                                 |
| `passengerProfiles`         | `PassengerProfile[]`      |    No    | Standard passenger weight profiles (M3).          |
| `status`                    | `'draft' \| 'verified'`   |    No    | Profile verification state (defaults to `draft`). |
| `schemaVersion`             | `number`                  |    No    | Schema version, currently `2` (defaults to `2`).  |

### 3.2 WeighingReport

Stored as an array on `AircraftProfile` to support versioning via the `validFrom` date.

| Field          | Type     | Required | Description                                |
| :------------- | :------- | :------: | :----------------------------------------- |
| `bem`          | `number` |   Yes    | Basic Empty Mass.                          |
| `emptyCg`      | `number` |   Yes    | CG position at empty mass.                 |
| `weighingDate` | `string` |   Yes    | Date of the weighing report (ISO 8601).    |
| `validFrom`    | `string` |   Yes    | Effective date for this record (ISO 8601). |

### 3.3 LoadPoint

Generic loading station (seats, baggage compartments, tanks). Up to 20 per profile.

| Field                 | Type                        | Required | Description                                                                                                                                    |
| :-------------------- | :-------------------------- | :------: | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                | `string`                    |   Yes    | Human-readable station name.                                                                                                                   |
| `arm`                 | `number \| null`            |  Cond.   | Fixed scalar lever arm. Required if `armLookup` is null.                                                                                       |
| `armLookup`           | `ArmLookupEntry[] \| null`  |  Cond.   | Variable arm table. Required if `arm` is null.                                                                                                 |
| `operationalLimit`    | `number \| null`            |    No    | Maximum capacity for this station.                                                                                                             |
| `defaultQuantity`     | `number`                    |   Yes    | Pre-filled default value.                                                                                                                      |
| `unit`                | `string`                    |   Yes    | Measurement unit (stored in source unit).                                                                                                      |
| `allowableCategories` | `string[] \| null`          |    No    | Certification categories in which this load point is available (e.g., `["Normal"]`). If `null`, the load point is available in all categories. |
| `fuelTank`            | `FuelTankExtension \| null` |    No    | Fuel-specific extension. See Section 3.4.                                                                                                      |

`kind` (optional, `occupant` \| `baggage` \| `fuel`) classifies the station for the zero-mass plausibility check (REQ-UQ-006): only `occupant` stations raise `WARN-UQ-001` at 0. A station with `fuelTank` is always `fuel`; `kind: "fuel"` without `fuelTank` or a non-fuel `kind` with `fuelTank` is rejected (`STATION_KIND_MISMATCH`). A non-fuel station without `kind` (legacy/imported data) is treated as `occupant` — the conservative default, so a missed seat entry still warns.

#### 3.3.1 ArmLookupEntry

Used when the arm/moment relationship is non-linear (e.g., swept-wing fuel tanks).

| Field          | Type     | Required | Description                        |
| :------------- | :------- | :------: | :--------------------------------- |
| `massOrVolume` | `number` |   Yes    | Input value (mass or volume).      |
| `moment`       | `number` |   Yes    | Corresponding moment at that load. |

### 3.4 FuelTankExtension

Optional extension applied to a `LoadPoint` to specialise it as a fuel tank. Up to 10 load points may carry this extension.

| Field                  | Type                  | Required | Description                                                                     |
| :--------------------- | :-------------------- | :------: | :------------------------------------------------------------------------------ |
| `unusableFuel`         | `number`              |   Yes    | Unusable fuel quantity.                                                         |
| `permissibleFuelTypes` | `string[]`            |   Yes    | Allowed fuel types (`MoGas`, `AvGas 100LL`, `Jet A-1`, `AvGas UL91`, `Diesel`). |
| `burnSequences`        | `BurnSequenceEntry[]` |   Yes    | One or more named burn sequences with ordinal position for this tank.           |

#### 3.4.1 BurnSequenceEntry

Defines the ordinal position of a tank within a named burn sequence.

| Field             | Type     | Required | Description                                             |
| :---------------- | :------- | :------: | :------------------------------------------------------ |
| `sequenceName`    | `string` |   Yes    | Name of the sequence (e.g., `Standard`, `Alternative`). |
| `ordinalPosition` | `number` |   Yes    | Position in the sequence (1-based).                     |

### 3.5 CertificationCategory

Each category defines its own Mass & Balance limits. At least one category required per profile. Load point availability per category is determined by each load point's `allowableCategories` field (Section 3.3).

| Field       | Type              | Required | Description                                 |
| :---------- | :---------------- | :------: | :------------------------------------------ |
| `category`  | `string`          |   Yes    | Enum: `Normal`, `Utility`, `Aerobatic`.     |
| `mtom`      | `number`          |   Yes    | Maximum Takeoff Mass for this category.     |
| `graphType` | `string`          |   Yes    | Enum: `arm`, `moment`.                      |
| `envelope`  | `EnvelopePoint[]` |   Yes    | CG envelope polygon (min 4, max 20 points). |

#### 3.5.1 EnvelopePoint

A single vertex of the CG envelope polygon.

| Field         | Type     | Required | Description                                             |
| :------------ | :------- | :------: | :------------------------------------------------------ |
| `armOrMoment` | `number` |   Yes    | Arm or moment value (determined by parent `graphType`). |
| `mass`        | `number` |   Yes    | Mass value at this vertex.                              |

### 3.6 PerformanceProfile

Container for performance data of a specific flight phase. Backs `REQ-AD-008`
(flight phase container) and `REQ-AD-009` (data points).

| Field         | Type                     | Required | Description                                                                       |
| :------------ | :----------------------- | :------: | :-------------------------------------------------------------------------------- |
| `flightPhase` | `string`                 |   Yes    | Enum: `TakeoffRoll`, `TakeoffDistance50ft`, `LandingRoll`, `LandingDistance50ft`. |
| `dataPoints`  | `PerformanceDataPoint[]` |   Yes    | 0–1000 entries. Zod-enforced upper bound.                                         |

Tables may also carry `sourceUnits` (all four axes: mass kg/lb, pressure altitude
ft/m, temperature °C/°F, distance m/ft) and optional `sourceReference` (1–500
characters, preserved verbatim). Unknown table/point keys fail validation.
Original numbers persist; Fleet shows original and normalized points together.
Absent declarations retain the labelled legacy kg/ft/°C/m contract. See the
[source-unit contract](performance-source-units.md) for migration, definitions
and independent reference vectors.

#### 3.6.1 PerformanceDataPoint

A single source point in its table's declared units (or legacy normalized units). All numeric fields must be finite.

| Field              | Type     | Required | Description                                  |
| :----------------- | :------- | :------: | :------------------------------------------- |
| `distance`         | `number` |   Yes    | Result value (distance). Non-negative.       |
| `mass`             | `number` |   Yes    | Condition: aircraft mass. Positive.          |
| `pressureAltitude` | `number` |   Yes    | Condition: pressure altitude (may be < 0).   |
| `temperature`      | `number` |   Yes    | Condition: temperature (may be < 0).         |

### 3.7 SurfaceCondition & SafetyFactors

#### SurfaceCondition

| Field           | Type     | Required | Description                                         |
| :-------------- | :------- | :------: | :-------------------------------------------------- |
| `name`          | `string` |   Yes    | Surface type name (e.g., `Dry Grass`, `Wet Grass`). |
| `takeoffFactor` | `number` |   Yes    | Correction factor for takeoff distance.             |
| `landingFactor` | `number` |   Yes    | Correction factor for landing distance.             |

#### SafetyFactors

| Field     | Type     | Required | Description                                     |
| :-------- | :------- | :------: | :---------------------------------------------- |
| `takeoff` | `number` |   Yes    | POH-mandated minimum safety factor for takeoff. |
| `landing` | `number` |   Yes    | POH-mandated minimum safety factor for landing. |

### 3.8 Operating Cost (REQ-AD-006)

Operating cost is represented as two optional flat fields on the `AircraftProfile`
root, rather than a nested object. Both are optional; if `costPerHour` is set,
`fuelCostIncluded` SHOULD also be set to disambiguate the rate.

| Field              | Type      | Required | Description                                         |
| :----------------- | :-------- | :------: | :-------------------------------------------------- |
| `costPerHour`      | `number`  |    No    | Operating cost per flight hour. Non-negative.       |
| `fuelCostIncluded` | `boolean` |    No    | Whether fuel cost is included in `costPerHour`.     |

### 3.9 WindLimit

Per-component wind limitation with classification.

| Field            | Type     | Required | Description                                                     |
| :--------------- | :------- | :------: | :-------------------------------------------------------------- |
| `component`      | `string` |   Yes    | Enum: `MaxCrosswind`, `MaxTailwind`, `MaxTotalWind`, `MaxGust`. |
| `value`          | `number` |   Yes    | Limit value.                                                    |
| `classification` | `string` |   Yes    | Enum: `Demonstrated`, `Limit`.                                  |

### 3.10 ChecklistScaffoldItem (REQ-AD-010)

Checklists are stored as a scaffold (title + ordered item strings); functional
UI interaction is not included in M3. The canonical field name on the root is
`checklistScaffold`.

| Field   | Type       | Required | Description                      |
| :------ | :--------- | :------: | :------------------------------- |
| `title` | `string`   |   Yes    | Checklist title (non-empty).     |
| `items` | `string[]` |   Yes    | Ordered list of checklist items. |

## 4. Implementation Notes

1. **Zod Schema:** The authoritative runtime schema will be defined as a Zod object in `src/core/validation/`. Field constraints (array lengths, enum values, min/max points) shall mirror the limits stated in this document and the source requirements.
2. **IndexedDB Storage:** Each `AircraftProfile` is stored as a single JSON document keyed by `id`. The `ownerId` + `registration` pair shall have a compound index to support the uniqueness check required by.
3. **Unit Handling:** All numeric values within a profile are stored in the manufacturer's original unit. The Safety Core's unit adapters converts to SI at calculation time — never at storage time.
4. **JSON Export/Import:** Use the validated [exchange pipeline](aircraft-exchange-file-format.md); export excludes operating-cost data by default and import creates a draft copy.
