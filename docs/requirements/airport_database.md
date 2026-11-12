# AeroDash Software Requirements - Airport Database (AP)

## Requirements

### REQ-AP-001: Airport Data Object Definition

The system shall store an airport record comprising Metadata (ICAO, Name, Elevation) and Runway Infrastructure (Designator, Magnetic Heading, Base Surface Type, Slope, TORA, TODA, ASDA, LDA).

### REQ-AP-002: Database Auto-population

When a valid ICAO code is entered, the system shall populate the Airport Data Object from the integrated external aviation database.

### REQ-AP-003: Manual Entry Fallback

If an ICAO code is not found in the database, then the system shall set the Airport Mode to `ManualEntry`.

### REQ-AP-004: Surface Condition Selection

When a paved runway is selected, the system shall require a surface condition from Dry, Wet, Standing Water, Slush, Snow or Ice.

### REQ-AP-005: Unverified State for External Data

When the system retrieves airport data from an external source, the system shall set the verification status of all retrieved parameters to `Unverified`.

### REQ-AP-006: Manual Override Fields

The system shall provide editable input fields for all auto-populated airport and runway parameters to enable manual pilot overrides.

### REQ-AP-007: Populate runway choices

When airport data is retrieved, the system shall populate the available-runways selection from that data.

### REQ-AP-008: Unpaved conditions

When a grass/unpaved runway is selected, the system shall require a surface condition from Dry (short grass ≤3 cm), Long Grass (>3–8 cm), Wet/Soft Ground, Damaged Turf or Snow/Ice.
