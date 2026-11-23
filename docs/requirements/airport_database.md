# AeroDash Software Requirements - Airport Database (AP)

## Scope and source prerequisite

The shipped airport workflow is manual-only; no integrated airport source,
adapter, dataset or airport-currentness CI exists. `savedAt` is local save
metadata and does not verify an external source. REQ-AP-001, -002, -003, -005,
-006 and -007 describe future database behaviour.

The [AIRAC/source contract](../regulatory/airac-airport-data-contract.md) defines
the prerequisite: an accepted named authorised dataset/provider, coverage,
licence, delivery interface, source version/publication/effective/expiry and
NOTAM policy, and an actual consumer before dataset-freshness CI. Missing source
facts remain unknown; retrieved parameters remain `Unverified` independently of
calendar position. No generic 28-day validity is assumed. #284 remains open on
source hold owned by HQ terminal 1892, with event-based reassessment on a complete
accepted source/consumer contract.

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

The system shall use an explicit m or ft unit for each of TORA, LDA and field elevation.

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

### REQ-AP-019: Unavailable manual runway assessment

If the saved runway or an applicable correction source is unavailable, then the system shall not display a runway comparison.

The [manual runway contract](../architecture/manual-runway-entry.md) defines units, conversion and storage. REQ-AP-001, -002, -005 and -007 (airport database) remain future scope.

### REQ-AP-020: Manual source dates

When the pilot supplies effective or expiry dates, the system shall retain them with the manual runway.

### REQ-AP-021: Declared date check

When displaying a saved runway, the system shall compare its declared dates with a pilot-selectable date.

### REQ-AP-022: AIRAC calendar

When displaying a saved runway, the system shall display the AIRAC cycle start for a selected date within the supported published calendar.

### REQ-AP-023: Unsupported AIRAC date

If the selected date is outside the supported published calendar or invalid, then the system shall indicate that the AIRAC cycle is unavailable.

### REQ-AP-024: Shared declared date check

When displaying a saved runway in Performance or the briefing, the system shall include the selected date and declared date check with its unverified source status.

### REQ-AP-025: Manual source reference

When the pilot supplies a source reference, the system shall retain it with the manual runway and display it as unverified in Performance and the briefing.

### REQ-AP-026: Saved declaration dates

When displaying a saved manual runway, the system shall display its declared effective and expiry dates or indicate when either is unknown.

### REQ-AP-027: Reset check date

When the pilot selects today for the declared date check, the system shall use the device's current local date.

### REQ-AP-028: Selected date limitation

When displaying the declared date check in Performance or the briefing, the system shall indicate that the selected date does not advance automatically.

### REQ-AP-027: Automatic local check date

While the automatic local date is selected, the system shall update the check date when the device local date changes.

### REQ-AP-028: Fixed check date

When the pilot selects a check date, the system shall retain it until the pilot selects the automatic local date.

### REQ-AP-029: Recent declaration date checks

When displaying a recent manual runway declaration, the system shall show its declared date check for the selected date.

### REQ-AP-031: Recent runway date selection

While recent runway declarations are displayed, the system shall allow the pilot to change their check date.

### REQ-AP-032: Recent runway directions

When saving a manual runway declaration, the system shall retain recent declarations for other runway directions at the same aerodrome.

### REQ-AP-033: Recent declaration sources and dates

When displaying a recent manual runway declaration, the system shall display its unverified source reference and declared effective and expiry dates, indicating unknown values.
