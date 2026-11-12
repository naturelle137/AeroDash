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

### REQ-AP-009: Manual runway inputs

The system shall let the pilot enter an aerodrome identifier, runway designator, TORA, LDA, field elevation, surface type and surface condition without network access.

### REQ-AP-010: Explicit runway units

The system shall require an explicit m or ft unit for each of TORA, LDA and field elevation without a default.

### REQ-AP-011: Available distance validation

If TORA or LDA is empty, nonfinite, zero or negative, then the system shall reject the manual runway inputs.

### REQ-AP-012: Field elevation scope

The system shall accept any finite field elevation, including zero and negative values, and shall not use it as pressure altitude.

### REQ-AP-013: Required manual surface

If surface type or a surface condition belonging to that type is missing, then the system shall reject the manual runway inputs.

### REQ-AP-014: Manual runway persistence

When valid manual runway inputs are saved, the system shall persist their original values and units in a versioned local record.

### REQ-AP-015: Manual runway recovery

If a stored manual runway record is damaged, invalid or of an unsupported version, then the system shall not use it and shall display a storage problem.

### REQ-AP-016: Manual runway storage failure

If saving or clearing manual runway inputs fails, then the system shall display the storage failure.

### REQ-AP-017: Manual runway provenance

While saved manual runway inputs are displayed, the system shall label them user-entered and not airport-validated.

### REQ-AP-018: Manual runway invalidation

When a manual runway input changes, the system shall immediately stop displaying the saved runway as current.

### REQ-AP-019: No manual runway assessment

While runway corrections and comparison are unimplemented, the system shall state that a runway assessment is unavailable.

The [manual runway contract](../architecture/manual-runway-entry.md) defines units, conversion and storage. REQ-AP-001, -002, -005 and -007 (airport database) remain future scope.
