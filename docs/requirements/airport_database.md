# AeroDash Software Requirements - Airport Database (AP)

This document defines the airport database behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
 | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **<a name="REQ-AP-001"></a>REQ-AP-001** | The system shall define an Airport Data Object comprising Metadata (ICAO, Name, Elevation) and Runway Infrastructure (Designator, Magnetic Heading, Base Surface Type, Slope, TORA, TODA, ASDA, LDA). | Centralized schema required for performance and wind calculations. | P1 | n/a | Approved | n/a |
| **<a name="REQ-AP-002"></a>REQ-AP-002** | When a valid ICAO code is entered, the system shall query an integrated external aviation database to auto-populate the Airport Data Object and populate the `AvailableRunways` list in the Data Model. | E.g. Open AIP or OurAirports. Operational efficiency and reduction of manual lookup errors. | P2 | n/a | Approved | n/a |
| **<a name="REQ-AP-003"></a>REQ-AP-003** | If an ICAO code is not found in the database, then the system shall set the Airport Mode to `ManualEntry`. | PIC authority to operate from unlisted or private strips. | P1 | n/a | Approved | n/a |
| **<a name="REQ-AP-004"></a>REQ-AP-004** | When a runway is selected, the system shall require the user to select the current surface condition from a predefined list specific to the base surface type: <ol><li>Paved (e.g. Asphalt/Concrete): Dry, Wet, Standing Water, Slush, Snow, Ice</li> <li>Grass/Unpaved: Dry (Short grass ≤ 3cm), Long Grass (> 3cm to 8cm), Wet/Soft Ground, Damaged Turf, Snow/Ice</li></ol> | Conditions impact friction heavily. Grass runways require highly specific length/quality factors per standard POHs. Context-aware lists prevent impossible combinations (e.g. "Long Grass" on Asphalt). | P1 | [H-009](../risk_management/safety_hazards.md#H-009) | Approved | n/a |
| **<a name="REQ-AP-005"></a>REQ-AP-005** | When the system retrieves airport data from an external source, the system shall set the verification status of all retrieved parameters to `Unverified`. | Safety: Open-source DBs may have outdated LDA/TORA. PIC must verify against official AIP. | P1 | [H-015](../risk_management/safety_hazards.md#H-015) | Approved | n/a |
| **<a name="REQ-AP-006"></a>REQ-AP-006** | The system shall provide editable input fields for all auto-populated airport and runway parameters to enable manual pilot overrides. | Accommodates temporary changes like displaced thresholds published via NOTAM. | P1 | n/a | Approved | n/a |

---

## Design References

- None

---
