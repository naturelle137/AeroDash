# AeroDash Architecture - Aircraft Data Model

<!-- @DES-ARCH-002@ (FROM: @REQ-AD-001@, @REQ-AD-002@, @REQ-AD-003@, @REQ-AD-004@, @REQ-AD-005@, @REQ-AD-006@, @REQ-AD-007@, @REQ-AD-008@, @REQ-AD-009@, @REQ-AD-010@, @REQ-AD-011@, @REQ-AD-012@, @REQ-AD-013@, @REQ-AD-014@, @REQ-AD-015@, @REQ-AD-016@, @REQ-AD-017@, @REQ-AD-018@, @REQ-AD-019@) -->

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

## 2. Entity Relationship Diagram

```mermaid
erDiagram
    AircraftProfile ||--o{ WeighingReport : "has (versioned)"
    AircraftProfile ||--o{ LoadPoint : "has (max 20)"
    AircraftProfile ||--o{ CertificationCategory : "has"
    AircraftProfile ||--o{ PerformanceProfile : "has"
    AircraftProfile ||--o{ SurfaceCondition : "has"
    AircraftProfile ||--o{ WindLimit : "has"
    AircraftProfile ||--o{ Checklist : "has"
    LoadPoint ||--o| FuelTankExtension : "optionally extends"
    LoadPoint ||--o{ ArmLookupEntry : "variable arm (opt.)"
    FuelTankExtension ||--o{ BurnSequenceEntry : "has"
    CertificationCategory ||--o{ EnvelopePoint : "has (4-20)"
    PerformanceProfile ||--o{ PerformanceDataPoint : "has (max 1000)"

    AircraftProfile {
        string id PK
        string ownerId
        string registration
        string manufacturer
        string model
        string icaoTypeDesignator
        string shareCode "nullable"
        string sourceUnit
        string referenceDatumDescription
        string referenceDatumLocation
    }

    WeighingReport {
        number bem
        number emptyCg
        date weighingDate
        date validFrom
    }

    LoadPoint {
        string name
        number arm "if fixed scalar"
        number operationalLimit "optional"
        number defaultQuantity
        string unit
        string[] allowableCategories "optional"
    }

    ArmLookupEntry {
        number massOrVolume
        number moment
    }

    FuelTankExtension {
        number unusableFuel
        string[] permissibleFuelTypes
    }

    BurnSequenceEntry {
        string sequenceName
        number ordinalPosition
    }

    CertificationCategory {
        string category "Normal | Utility | Aerobatic"
        number mtom
        string graphType "arm | moment"
    }

    EnvelopePoint {
        number armOrMoment
        number mass
    }

    PerformanceProfile {
        string flightPhase "enum (4 phases)"
    }

    PerformanceDataPoint {
        number distance
        number mass
        number pressureAltitude
        number temperature
    }

    SurfaceCondition {
        string name
        number takeoffFactor
        number landingFactor
    }

    WindLimit {
        string component "enum (4 components)"
        number value
        string classification "Demonstrated | Limit"
    }

    Checklist {
        string title
        string[] items
    }
```

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
| `sourceUnit`                | `string`                  |   Yes    | Original unit system from manufacturer's POH/AFM. |
| `referenceDatumDescription` | `string`                  |   Yes    | Textual description of the reference datum.       |
| `referenceDatumLocation`    | `string`                  |   Yes    | Physical location of the reference datum.         |
| `shareCode`                 | `string \| null`          |    No    | Share-code for ad-hoc profile sharing.            |
| `operatingCost`             | `OperatingCost`           |    No    | See Section 3.8.                                  |
| `weighingReports`           | `WeighingReport[]`        |   Yes    | See Section 3.2. At least one entry required.     |
| `loadPoints`                | `LoadPoint[]`             |   Yes    | See Section 3.3. Max 20.                          |
| `certificationCategories`   | `CertificationCategory[]` |   Yes    | See Section 3.5. At least one entry required.     |
| `performanceProfiles`       | `PerformanceProfile[]`    |   Yes    | See Section 3.6.                                  |
| `surfaceConditions`         | `SurfaceCondition[]`      |   Yes    | See Section 3.7.                                  |
| `safetyFactors`             | `SafetyFactors`           |    No    | See Section 3.7.                                  |
| `windLimits`                | `WindLimit[]`             |    No    | See Section 3.9.                                  |
| `checklists`                | `Checklist[]`             |    No    | See Section 3.10.                                 |

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

Container for performance data of a specific flight phase.

| Field         | Type                     | Required | Description                                                                       |
| :------------ | :----------------------- | :------: | :-------------------------------------------------------------------------------- |
| `flightPhase` | `string`                 |   Yes    | Enum: `TakeoffRoll`, `TakeoffDistance50ft`, `LandingRoll`, `LandingDistance50ft`. |
| `dataPoints`  | `PerformanceDataPoint[]` |   Yes    | Max 1000 entries.                                                                 |

#### 3.6.1 PerformanceDataPoint

A single interpolation point for performance calculations.

| Field              | Type     | Required | Description                   |
| :----------------- | :------- | :------: | :---------------------------- |
| `distance`         | `number` |   Yes    | Result value (distance).      |
| `mass`             | `number` |   Yes    | Condition: aircraft mass.     |
| `pressureAltitude` | `number` |   Yes    | Condition: pressure altitude. |
| `temperature`      | `number` |   Yes    | Condition: temperature.       |

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

### 3.8 OperatingCost

| Field              | Type      | Required | Description                                |
| :----------------- | :-------- | :------: | :----------------------------------------- |
| `costPerHour`      | `number`  |   Yes    | Operating cost per flight hour.            |
| `fuelCostIncluded` | `boolean` |   Yes    | Whether fuel cost is included in the rate. |

### 3.9 WindLimit

Per-component wind limitation with classification.

| Field            | Type     | Required | Description                                                     |
| :--------------- | :------- | :------: | :-------------------------------------------------------------- |
| `component`      | `string` |   Yes    | Enum: `MaxCrosswind`, `MaxTailwind`, `MaxTotalWind`, `MaxGust`. |
| `value`          | `number` |   Yes    | Limit value.                                                    |
| `classification` | `string` |   Yes    | Enum: `Demonstrated`, `Limit`.                                  |

### 3.10 Checklist

| Field   | Type       | Required | Description                      |
| :------ | :--------- | :------: | :------------------------------- |
| `title` | `string`   |   Yes    | Checklist title.                 |
| `items` | `string[]` |   Yes    | Ordered list of checklist items. |

## 4. Implementation Notes

1. **Zod Schema:** The authoritative runtime schema will be defined as a Zod object in `src/core/validation/`. Field constraints (array lengths, enum values, min/max points) shall mirror the limits stated in this document and the source requirements.
2. **IndexedDB Storage:** Each `AircraftProfile` is stored as a single JSON document keyed by `id`. The `ownerId` + `registration` pair shall have a compound index to support the uniqueness check required by.
3. **Unit Handling:** All numeric values within a profile are stored in the manufacturer's original unit. The Safety Core's unit normalization layer (`src/core/units/`) converts to SI at calculation time — never at storage time.
4. **JSON Export/Import:** The document structure is designed so that `JSON.stringify` / `JSON.parse` of an `AircraftProfile` produces a valid exchange file.
