# AeroDash Software Requirements - Detailed Aircraft Data (AD)

This document defines the detailed aircraft data behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-AD-001@ -->
### REQ-AD-001

**Requirement:** The system shall store for each aircraft: registration, manufacturer, model, ICAO type designator.
**Rationale:** Identification of the aircraft record.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-002@ -->
### REQ-AD-002

**Requirement:** The system shall allow the configuration of up to $20$ load points containing the following attributes: <ul><li>Name,</li> <li>arm/moment,</li> <li>optional operational limit,</li> <li>default quantity, and</li> <li>unit.</li></ul>
**Rationale:** Defines the generic data structure for any station on the aircraft (seats, bags, tanks).
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-003@ (FROM: @H-003@, @H-003@) -->
### REQ-AD-003

**Requirement:** The system shall allow the configuration of up to 10 fuel tanks as a specific type of load point, extending it with the following additional attributes: <ul><li>Unusable fuel, and</li> <li>permissible fuel types (MoGas, AvGas 100LL, Jet A-1, AvGas UL91, Diesel).</li></ul> <br>Operational limit denotes tank capacity.
**Rationale:** Maps generic load points to fluid logic and adds safety-critical fuel specifics.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-004@ -->
### REQ-AD-004

**Requirement:** The system shall store BEM, empty CG and date of weighing report.
**Rationale:** Fundamental baseline for all mass calculations; legally required documentation.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-005@ -->
### REQ-AD-005

**Requirement:** The system shall define flight envelope limits: graph type (arm or moment) and load range defined by a minimum of four and a maximum of 20 points (arm/moment + mass).
**Rationale:** Geometric basis for CG validation.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-006@ -->
### REQ-AD-006

**Requirement:** The system shall store cost per hour and indicate whether fuel cost is included.
**Rationale:** Cost management feature for flight preparation.
**Priority:** P3
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-007@ -->
### REQ-AD-007

**Requirement:** The system shall store the reference datum definition (description and location) for each aircraft.
**Rationale:** Ensures pilot understands the origin of the coordinate system.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-008@ -->
### REQ-AD-008

**Requirement:** The system shall allow the configuration of Performance Profiles for distinct flight phases (Takeoff Roll, Takeoff Distance 50ft, Landing Roll, Landing Distance 50ft).
**Rationale:** Container for distance types.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-009@ -->
### REQ-AD-009

**Requirement:** The system shall allow the definition of a maximum of 1000 performance data points for each performance profile, consisting of a result value (Distance) and a set of condition values (Mass, Pressure Altitude, Temperature).
**Rationale:** Data points needed to calculate the actual takeoff and landing distances for the flight.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-010@ -->
### REQ-AD-010

**Requirement:** The system shall store checklists associated with each aircraft.
**Rationale:** Integrated safety documentation.
**Priority:** P3
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-011@ -->
### REQ-AD-011

**Requirement:** The system shall store for each aircraft the available certification categories (Normal, Utility, Aerobatic) with a unique set of Mass & Balance limits (MTOM and CG Envelope polygon) per certification category.
**Rationale:** Necessary for aircraft with multiple categories (e.g. Klemm 107B).
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-012@ -->
### REQ-AD-012

**Requirement:** The system shall store loading station definitions as either a fixed scalar lever arm or a variable lookup table (Mass/Volume vs. Arm/Moment).
**Rationale:** Supports swept-wing or complex tank configurations where CG shifts with fuel level.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-013@ -->
### REQ-AD-013

**Requirement:** The system shall store a "Valid From" date for each EM/arm value to support weighing report versioning.
**Rationale:** Traceability of legal weight data over the aircraft's lifecycle.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-014@ (FROM: @H-001@, @H-001@) -->
### REQ-AD-014

**Requirement:** The system shall store aircraft profile data (POH/AFM values and units of the values) in the original unit of the manufacturer's documentation.
**Rationale:** Prevent calculation errors due to using wrong units.
**Priority:** P1
**Mitigation Hazard:** [H-001](../risk_management/safety_hazards.md#H-001)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-015@ -->
### REQ-AD-015

**Requirement:** The system shall store surface condition definitions that include a distinct performance correction factor for Take-off and Landing distances.
**Rationale:** Ensures legal compliance while allowing POH-specific overrides.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AD-016@ -->
### REQ-AD-016

**Requirement:** The system shall store POH-mandated minimum Operational Safety Factors for Takeoff and Landing within the aircraft profile.
**Rationale:** For takeoff and landing distance claculation, safety factors shall be applied. Some Manufacturers provide these factors in their POH.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- None

---
