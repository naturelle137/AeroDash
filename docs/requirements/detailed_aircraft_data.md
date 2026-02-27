# AeroDash Software Requirements - Detailed Aircraft Data (AD)

This document defines the detailed aircraft data behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-AD-001@ -->
### REQ-AD-001: Basic Aircraft Attributes

**Requirement:** The system shall store for each aircraft: registration, manufacturer, model, ICAO type designator.
**Rationale:** Identification of the aircraft record.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-002@ -->
### REQ-AD-002: Load Point Configuration

**Requirement:** The system shall allow the configuration of up to $20$ load points containing the following attributes: <ul><li>Name,</li> <li>arm/moment,</li> <li>optional operational limit,</li> <li>default quantity, and</li> <li>unit.</li></ul>
**Rationale:** Defines the generic data structure for any station on the aircraft (seats, bags, tanks).
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-003@ (FROM: @H-003@) -->
### REQ-AD-003: Fuel Tank Configuration

**Requirement:** The system shall allow the configuration of up to 10 fuel tanks as a specific type of load point, extending it with the following additional attributes: <ul><li>Unusable fuel,</li> <li>permissible fuel types (MoGas, AvGas 100LL, Jet A-1, AvGas UL91, Diesel), and</li> <li>burn sequence order (ordinal position per named sequence, e.g., `Standard`, `Alternative`) for each tank across one or more named burn sequences.</li></ul> <br>Operational limit denotes tank capacity.
**Rationale:** Maps generic load points to fluid logic, adds safety-critical fuel specifics, and enables CG migration polygon computation for aircraft with tanks at different lever arms and alternate burn sequences (e.g., KL107B Standard: Tank II → Tank I; Alternative: Tank I → Tank II).
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-004@ -->
### REQ-AD-004: Weighing Report Data

**Requirement:** The system shall store BEM, empty CG and date of weighing report.
**Rationale:** Fundamental baseline for all mass calculations; legally required documentation.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-005@ -->
### REQ-AD-005: Flight Envelope Definition

**Requirement:** The system shall define flight envelope limits: graph type (arm or moment) and load range defined by a minimum of four and a maximum of 20 points (arm/moment + mass).
**Rationale:** Geometric basis for CG validation.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-006@ -->
### REQ-AD-006: Operating Cost Tracking

**Requirement:** The system shall store cost per hour and indicate whether fuel cost is included.
**Rationale:** Cost management feature for flight preparation.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-007@ -->
### REQ-AD-007: Reference Datum Storage

**Requirement:** The system shall store the reference datum definition (description and location) for each aircraft.
**Rationale:** Ensures pilot understands the origin of the coordinate system.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-008@ -->
### REQ-AD-008: Performance Profile Definition

**Requirement:** The system shall allow the configuration of Performance Profiles for distinct flight phases (Takeoff Roll, Takeoff Distance 50ft, Landing Roll, Landing Distance 50ft).
**Rationale:** Container for distance types.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-009@ -->
### REQ-AD-009: Performance Data Points

**Requirement:** The system shall allow the definition of a maximum of 1000 performance data points for each performance profile, consisting of a result value (Distance) and a set of condition values (Mass, Pressure Altitude, Temperature).
**Rationale:** Data points needed to calculate the actual takeoff and landing distances for the flight.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-010@ -->
### REQ-AD-010: Checklist Storage

**Requirement:** The system shall store checklists associated with each aircraft.
**Rationale:** Integrated safety documentation.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-011@ -->
### REQ-AD-011: Certification Categories

**Requirement:** The system shall store for each aircraft the available certification categories (Normal, Utility, Aerobatic) with a unique set of Mass & Balance limits (MTOM and CG Envelope polygon) per certification category.
**Rationale:** Necessary for aircraft with multiple categories (e.g. Klemm 107B).
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-012@ -->
### REQ-AD-012: Variable Loading Stations

**Requirement:** The system shall store loading station definitions as either a fixed scalar lever arm or a variable lookup table (Mass/Volume vs. Moment).
**Rationale:** Supports swept-wing or complex tank configurations where CG shifts with fuel level.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-013@ -->
### REQ-AD-013: Weighing Report Versioning

**Requirement:** The system shall store a "Valid From" date for each EM/arm value to support weighing report versioning.
**Rationale:** Traceability of legal weight data over the aircraft's lifecycle.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-014@ (FROM: @H-001@) -->
### REQ-AD-014: Original Unit Preservation

**Requirement:** The system shall store aircraft profile data (POH/AFM values and units of the values) in the original unit of the manufacturer's documentation.
**Rationale:** Prevent calculation errors due to using wrong units.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-015@ -->
### REQ-AD-015: Surface Condition Factors

**Requirement:** The system shall store surface condition definitions that include a distinct performance correction factor for Take-off and Landing distances.
**Rationale:** Ensures legal compliance while allowing POH-specific overrides.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-016@ -->
### REQ-AD-016: Operational Safety Factors

**Requirement:** The system shall store POH-mandated minimum Operational Safety Factors for Takeoff and Landing within the aircraft profile.
**Rationale:** For takeoff and landing distance claculation, safety factors shall be applied. Some Manufacturers provide these factors in their POH.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-017@ (FROM: @H-014@) -->
### REQ-AD-017: Wind Limit Storage

**Requirement:** The system shall store per-aircraft wind limits for each applicable component (Maximum Crosswind, Maximum Tailwind, Maximum Total Wind, Maximum Gust) with a classification of either `Demonstrated` (advisory, from certification flight testing) or `Limit` (mandatory, from POH limitations section).
**Rationale:** The distinction between a demonstrated value and a hard limitation determines the appropriate notification severity when the limit is exceeded. Most GA aircraft only publish demonstrated crosswind values, while some additionally publish hard tailwind or gust limits.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- None

---
