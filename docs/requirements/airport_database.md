# AeroDash Software Requirements - Airport Database (AP)

This document defines the airport database behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-AP-001@ -->
### REQ-AP-001

**Requirement:** The system shall define an Airport Data Object comprising Metadata (ICAO, Name, Elevation) and Runway Infrastructure (Designator, Magnetic Heading, Base Surface Type, Slope, TORA, TODA, ASDA, LDA).
**Rationale:** Centralized schema required for performance and wind calculations.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AP-002@ -->
### REQ-AP-002

**Requirement:** When a valid ICAO code is entered, the system shall query an integrated external aviation database to auto-populate the Airport Data Object and populate the `AvailableRunways` list in the Data Model.
**Rationale:** E.g. Open AIP or OurAirports. Operational efficiency and reduction of manual lookup errors.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AP-003@ -->
### REQ-AP-003

**Requirement:** If an ICAO code is not found in the database, then the system shall set the Airport Mode to `ManualEntry`.
**Rationale:** PIC authority to operate from unlisted or private strips.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AP-004@ (FROM: @H-009@, @H-009@) -->
### REQ-AP-004

**Requirement:** When a runway is selected, the system shall require the user to select the current surface condition from a predefined list specific to the base surface type: <ol><li>Paved (e.g. Asphalt/Concrete): Dry, Wet, Standing Water, Slush, Snow, Ice</li> <li>Grass/Unpaved: Dry (Short grass ≤ 3cm), Long Grass (> 3cm to 8cm), Wet/Soft Ground, Damaged Turf, Snow/Ice</li></ol>
**Rationale:** Conditions impact friction heavily. Grass runways require highly specific length/quality factors per standard POHs. Context-aware lists prevent impossible combinations (e.g. "Long Grass" on Asphalt).
**Priority:** P1
**Mitigation Hazard:** [H-009](../risk_management/safety_hazards.md#H-009)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AP-005@ (FROM: @H-015@, @H-015@) -->
### REQ-AP-005

**Requirement:** When the system retrieves airport data from an external source, the system shall set the verification status of all retrieved parameters to `Unverified`.
**Rationale:** Safety: Open-source DBs may have outdated LDA/TORA. PIC must verify against official AIP.
**Priority:** P1
**Mitigation Hazard:** [H-015](../risk_management/safety_hazards.md#H-015)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-AP-006@ -->
### REQ-AP-006

**Requirement:** The system shall provide editable input fields for all auto-populated airport and runway parameters to enable manual pilot overrides.
**Rationale:** Accommodates temporary changes like displaced thresholds published via NOTAM.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- None

---
