# AeroDash Software Requirements - Detailed Aircraft Data (AD)

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **AFM** | Aircraft flight manual |
| **CG** | Center of gravity |
| **BEM** | Basic empty mass |
| **MTOM** | Maximum takeoff mass |
| **POH** | Pilot operating handbook |
| **TM** | Taxi mass |
| **ZFM** | Zero fuel mass |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-AD-001">REQ-AD-001</a>** | The system shall store for each aircraft: registration, manufacturer, model, ICAO type designator. | Identification of the aircraft record. | P1 | n/a | Draft |
| **<a name="REQ-AD-002">REQ-AD-002</a>** | The system shall allow the configuration of up to 20 load points containing the following attributes: <ul><li>Name,</li> <li>arm/moment,</li> <li>optional operational limit,</li> <li>default quantity, and</li> <li>unit.</li></ul> | Defines the generic data structure for any station on the aircraft (seats, bags, tanks). | P1 | n/a | Draft |
| **<a name="REQ-AD-003">REQ-AD-003</a>** | The system shall allow the configuration of up to 10 fuel tanks as a specific type of load point, extending it with the following additional attributes: <ul><li>Unusable fuel, and</li> <li>permissible fuel types (MoGas, AvGas 100LL, Jet A-1, AvGas UL91, Diesel).</li></ul> <br>Operational limit denotes tank capacity. | Maps generic load points to fluid logic and adds safety-critical fuel specifics. | P1 | n/a | Draft |
| **<a name="REQ-AD-004">REQ-AD-004</a>** | The system shall store BEM, empty CG and date of weighing report. | Weighing report data. | P1 | n/a | Draft |
| **<a name="REQ-AD-005">REQ-AD-005</a>** | The system shall define flight envelope limits: graph type (arm or moment) and load range defined by a minimum of four and a maximum of 20 points (arm/moment + mass). | Geometric basis for CG validation. | P1 | n/a | Draft |
| **<a name="REQ-AD-006">REQ-AD-006</a>** | The system shall store cost per hour and indicate whether fuel cost is included. | Cost management feature for flight preparation. | P3 | n/a | Draft |
| **<a name="REQ-AD-007">REQ-AD-007</a>** | The system shall store the reference datum definition (description and location) for each aircraft. | Ensures pilot understands the origin of the coordinate system. | P2 | n/a | Draft |
| **<a name="REQ-AD-008">REQ-AD-008</a>** | The system shall allow the configuration of Performance Profiles for distinct flight phases (Takeoff Roll, Takeoff Distance 50ft, Landing Roll, Landing Distance 50ft). | Container for distance types. | P1 | n/a | Draft |
| **<a name="REQ-AD-009">REQ-AD-009</a>** | The system shall allow the definition of a maximum of 1000 performance data points for each performance profile, consisting of a result value (Distance) and a set of condition values (Mass, Pressure Altitude, Temperature). | Data points needed to calculate the actual takeoff and landing distances for the flight. | P1 | n/a | Draft |
| **<a name="REQ-AD-010">REQ-AD-010</a>** | The system should store checklists associated with each aircraft. | Integrated safety documentation. | P3 | n/a | Draft |
| **<a name="REQ-AD-011">REQ-AD-011</a>** | The system shall store for each aircraft the available certification categories (Normal, Utility, Aerobatic) with a unique set of Mass & Balance limits (MTOM and CG Envelope polygon) per certification category. | Necessary for aircraft with multiple categories (e.g. Klemm 107B). | P1 | [H-004](../risk_management/safety_hazards.md#H-004) | Draft |
| **<a name="REQ-AD-012">REQ-AD-012</a>** | The system shall store loading station definitions as either a fixed scalar lever arm or a variable lookup table (Mass/Volume vs. Arm/Moment). | Supports swept-wing or complex tank configurations where CG shifts with fuel level. | P2 | n/a | Draft |
| **<a name="REQ-AD-013">REQ-AD-013</a>** | The system shall store a "Valid From" date for each EM/arm value to support weighing report versioning. | Traceability of legal weight data over the aircraft's lifecycle. | P2 | n/a | Draft |
| **<a name="REQ-AD-014">REQ-AD-014</a>** | The system shall store aircraft profile data (POH/AFM values and units of the values) in the original unit of the manufacturer's documentation. | Prevent calculation errors due to using wrong units. | P1 | [H-001](../risk_management/safety_hazards.md#H-001) | Draft |
| **<a name="REQ-AD-015">REQ-AD-015</a>** | The system shall allow the definition of Surface Factors (e.g. Grass, Wet) as percentage surcharges. <ul><li>Default values shall be pre-filled according to FSM 3/75 (e.g. Grass +20%, Wet +10%).</li> <li>User can override these if the POH specifies different values.</li></ul> | Ensures legal compliance while allowing POH-specific overrides. | P1 | n/a | Draft |

---
