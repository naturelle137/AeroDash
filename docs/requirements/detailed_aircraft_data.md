# AeroDash Software Requirements - Detailed Aircraft Data (AD)

## Requirements

### REQ-AD-001: Basic Aircraft Attributes

The system shall store for each aircraft: registration, manufacturer, model, ICAO type designator.

### REQ-AD-002: Load Point Configuration

The system shall allow the configuration of up to $20$ load points containing the following attributes: Name, arm/moment, optional operational limit, default quantity, unit, and optional allowable certification categories.

### REQ-AD-003: Fuel Tank Configuration

The system shall allow the configuration of up to 10 fuel tanks as a specific type of load point, extending it with the following additional attributes: Unusable fuel, permissible fuel types (MoGas, AvGas 100LL, Jet A-1, AvGas UL91, Diesel), and burn sequence order (ordinal position per named sequence, e.g., `Standard`, `Alternative`) for each tank across one or more named burn sequences.

### REQ-AD-004: Weighing Report Data

The system shall store BEM, empty CG and date of weighing report.

**Status:** Implemented. Test: `frontend/src/core/adapters/aircraft.schema.spec.ts` (synthetic values).

### REQ-AD-005: Flight Envelope Definition

The system shall store flight envelope limits: graph type (arm or moment) and load range defined by a minimum of four and a maximum of 20 points (arm/moment + mass).

### REQ-AD-006: Operating Cost Tracking

The system shall store an aircraft’s cost per hour.

### REQ-AD-007: Reference Datum Storage

The system shall store the reference datum definition (description and location) for each aircraft.

### REQ-AD-008: Performance Profile Definition

The system shall allow the configuration of Performance Profiles for distinct flight phases (Takeoff Roll, Takeoff Distance 50ft, Landing Roll, Landing Distance 50ft).

**Status:** Implemented. Tests: `frontend/src/core/adapters/aircraft.schema.spec.ts`, `frontend/src/core/logic/profile-migrations.spec.ts` (synthetic values).

### REQ-AD-009: Performance Data Points

The system shall allow the definition of a maximum of 1000 performance data points for each performance profile, consisting of a result value (Distance) and a set of condition values (Mass, Pressure Altitude, Temperature).

**Status:** Implemented. Tests: `frontend/src/core/adapters/aircraft.schema.spec.ts` (1000-point boundary), `frontend/src/core/logic/profile-migrations.spec.ts`.

### REQ-AD-010: Checklist Storage

The system shall store checklists associated with each aircraft.

### REQ-AD-011: Certification Categories

The system shall store for each aircraft the available certification categories (Normal, Utility, Aerobatic) with a unique set of Mass & Balance limits (MTOM and CG Envelope polygon) per certification category.

### REQ-AD-012: Variable Loading Stations

The system shall store loading station definitions as either a fixed scalar lever arm or a variable lookup table (Mass/Volume vs. Moment).

### REQ-AD-013: Weighing Report Versioning

The system shall store a "Valid From" date for each EM/arm value to support weighing report versioning.

**Status:** Implemented. Test: `frontend/src/core/adapters/aircraft.schema.spec.ts`.

### REQ-AD-014: Original Unit Preservation

The system shall store aircraft profile data (POH/AFM values and units of the values) in the original unit of the manufacturer's documentation.

### REQ-AD-015: Surface Condition Factors

The system shall store surface condition definitions that include a distinct performance correction factor for Take-off and Landing distances.

**Status:** Implemented. Tests: `frontend/src/core/adapters/aircraft.schema.spec.ts`, `frontend/src/core/logic/profile-migrations.spec.ts`.

### REQ-AD-016: Operational Safety Factors

The system shall store POH-mandated minimum Operational Safety Factors for Takeoff and Landing within the aircraft profile.

**Status:** Implemented. Tests: `frontend/src/core/adapters/aircraft.schema.spec.ts`, `frontend/src/core/logic/profile-migrations.spec.ts`.

### REQ-AD-017: Wind Limit Storage

The system shall store per-aircraft wind limits for each applicable component (Maximum Crosswind, Maximum Tailwind, Maximum Total Wind, Maximum Gust) with a classification of either `Demonstrated` (advisory, from certification flight testing) or `Limit` (mandatory, from POH limitations section).

**Status:** Implemented. Tests: `frontend/src/core/adapters/aircraft.schema.spec.ts`, `frontend/src/core/logic/profile-migrations.spec.ts`.

### REQ-AD-018: Share-Code Storage

When the user creates a share code for an aircraft, the system shall store the share-code in the aircraft profile.

**Status:** Partial. Storage of a share code is tested in `frontend/src/core/adapters/aircraft.schema.spec.ts`; no user flow creates share codes while synchronization is unimplemented.

### REQ-AD-019: Owner Identifier Storage

While synchronization is unimplemented, the system shall persist `ownerId: null` for a new local profile without a supplied owner value.

**Status:** Implemented. Tests: `frontend/src/modules/aircraft/__tests__/fleet.store.spec.ts`, `frontend/src/modules/aircraft/__tests__/IdentitySection.spec.ts`.

### REQ-AD-020: Powertrain Discriminator

The system shall store each aircraft profile’s powertrain as `combustion` or `electric`.

**Status:** Implemented. Tests: `frontend/src/core/adapters/aircraft.schema.spec.ts`, `frontend/src/modules/aircraft/__tests__/fleet.repository.int.spec.ts`.

### REQ-AD-021: Battery Pack Description

While `powertrain` is `electric`, the system shall store exactly one battery pack record containing `usableEnergyKwh` (> 0), `reserveFloorKwh` (≥ 0 and < `usableEnergyKwh`), and optionally `nominalVoltage` (V, > 0) and `chemistry` (free text).

**Status:** Implemented. Tests: `frontend/src/core/adapters/aircraft.schema.spec.ts`, `frontend/src/modules/aircraft/components/__tests__/BatteryPackSection.spec.ts`.

### REQ-AD-022: Powertrain Field Exclusivity

If an electric aircraft profile contains a fuel tank load point, then the system shall reject the profile.

**Status:** Implemented. Test: `frontend/src/core/adapters/aircraft.schema.spec.ts`.

### REQ-AD-023: Operating-Cost Export Minimisation

When the user exports an aircraft profile, the system shall exclude the operating-cost fields (`costPerHour`, `fuelCostIncluded`) from the exported exchange file, unless the user explicitly opts in to include operating-cost data.

**Status:** Implemented. Test: `frontend/src/modules/aircraft/__tests__/profile.import.spec.ts`.

### REQ-AD-024: Fuel inclusion

The system shall store whether the aircraft’s cost per hour includes fuel.

### REQ-AD-025: Legacy powertrain

If an existing aircraft record has no powertrain value, then the system shall treat it as `combustion`.

### REQ-AD-026: Combustion battery exclusion

If a combustion aircraft profile contains a battery pack, then the system shall reject the profile.

### REQ-AD-027: Legacy owner preservation

When loading or importing a profile with a string owner value, the system shall preserve that value exactly.

### REQ-AD-028: Invalid owner rejection

If a profile owner value is neither omitted, null nor a string, then the system shall reject the profile.

## Design References

- **<a name="aircraftDataModel"></a>Aircraft Data Model:** [`docs/architecture/aircraft_data_model.md`](../architecture/aircraft_data_model.md)
