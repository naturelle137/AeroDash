# AeroDash Software Requirements - User Interface (UI)

## Requirements

### REQ-UI-001: Manufacturer Model Population

When the user selects a manufacturer from the dropdown, the model dropdown shall be populated with models for that manufacturer.

### REQ-UI-002: Manual Model Entry

When 'Other' is selected for manufacturer, the system shall replace the model dropdown with a text input field for manual entry.

### REQ-UI-003: ICAO Designator Auto-fill

When a model is selected, the ICAO aircraft type designator field shall be auto-filled.

### REQ-UI-004: Bidirectional ICAO Lookup

When a valid ICAO type designator is entered, the system shall display a selection list of matching Manufacturer/Model combinations.

### REQ-UI-005: Recent Airports Display

The system shall display the 5 most recently used airports at the top of the airport selection interface.

### REQ-UI-006: Passenger Profile Selection

The system shall display available Passenger Profiles for quick selection within the load station input fields.

### REQ-UI-007

Retired ID; reserved for historical references.

### REQ-UI-008: Input Out of Range Warning

If QNH is outside 950–1100 hPa or temperature is outside −40–50 °C, then the system shall emit WARNING `WARN-UI-001` identifying the out-of-range input.

### REQ-UI-009: Category Change Recalculation

When the certification category changes, the system shall recalculate category-dependent limits.

### REQ-UI-010: CG Migration Rendering

While an aircraft has a single fuel sequence, the system shall render a trend line connecting takeoff and landing CG.

### REQ-UI-011: Dark Mode Support

The system shall provide a toggleable "Dark Mode" (high contrast, black/red or black/green theme).

### REQ-UI-012: Contextual Tooltips

When the user activates the dedicated information icon adjacent to a complex data field or acronym, the system shall display a contextual explanation of that term in a pop-over element (Tooltip).

### REQ-UI-013: SemVer and Date Display

The system shall display its current semantic version in the About view.

### REQ-UI-014: Unverified Data Toggle

The system shall provide a toggle control adjacent to each Unverified data field that transitions the status to Verified upon user activation.

### REQ-UI-015: Unverified Data Export Warning

When Save or Export is triggered with unverified calculation parameters, the system shall emit CRITICAL `CRIT-UI-001` identifying the presence of unverified data.

### REQ-UI-016: Mark All as Verified Option

The confirmation dialog [REQ-UI-015](#req-ui-015-unverified-data-export-warning) shall provide an option to "Mark all as Verified" which transitions the status of all current airport parameters to `Verified` in the local database.

### REQ-UI-017: Low Safety Factor Export Warning

When Save or Export is triggered with a factor below the greater of the POH minimum and the baseline (takeoff 1.25, landing 1.43), the system shall emit CRITICAL `CRIT-UI-002` identifying the low factor.

### REQ-UI-018: Severity-Based Notification Rendering

When an INFO notification is active, the system shall render it as a toast or banner.

### REQ-UI-019: CG Envelope Polygon Rendering

The system shall render the active CG envelope polygon as the loading-chart background.

### REQ-UI-020: Connectivity State Indicator

The system shall display a persistent visual indicator of the current connectivity state (`Online`/`Offline`) in the application header or status bar.

### REQ-UI-021: Powertrain Selector in Aircraft Wizard

When creating an aircraft profile, the system shall offer `Combustion` and `Electric` powertrain choices.

### REQ-UI-022: Powertrain-Gated Editor Sections

While an aircraft is electric, the wizard and editor shall hide the fuel-tank toggle, Add Fuel Tank action, fuel-type selector and burn-sequence editor.

### REQ-UI-023: Powertrain Field Immutability in Aircraft Editor

While editing a persisted aircraft profile, the system shall display its powertrain as a read-only label.

### REQ-UI-024: Range override

While an operational-range warning is active, the system shall allow entry confirmation.

### REQ-UI-025: Category display

When category-dependent limits change, the system shall update their displayed values.

### REQ-UI-026: Multi-sequence trend

While an aircraft has multiple fuel sequences, the system shall render the burn-down region as a shaded trend area.

### REQ-UI-027: Release date display

The system shall display its release date in the About view.

### REQ-UI-028: Unverified review action

While the unverified-data warning is displayed, the system shall offer a review action listing every unverified parameter.

### REQ-UI-029: Low-factor confirmation

While the low-factor export warning is active, the system shall offer a confirmation action.

### REQ-UI-030: Warning rendering

When a WARNING notification is active, the system shall render it as a dismissible alert or field indicator.

### REQ-UI-031: Critical rendering

When a CRITICAL notification is active, the system shall render it as a blocking modal or flashing alert.

### REQ-UI-032: Flight-state points

The system shall overlay the ZFM CG point on the loading chart.

### REQ-UI-033: Burn-region overlay

While an aircraft has multiple fuel sequences, the system shall overlay the burn-down polygon as a shaded area on the loading chart.

### REQ-UI-034: Catalogue powertrain hint

When a selected catalogue model declares an electric powertrain during profile creation, the system shall preselect `Electric`.

### REQ-UI-035: Powertrain override

When creating an aircraft profile, the system shall allow the pilot to override the preselected powertrain.

### REQ-UI-036: Electric battery section

While an aircraft is electric, the wizard and editor shall show the Battery Pack section.

### REQ-UI-037: Combustion battery section

While an aircraft is combustion-powered, the wizard and editor shall hide the Battery Pack section.

### REQ-UI-038: Editor powertrain controls

While editing a persisted aircraft profile, the system shall provide no input control that writes to powertrain.

### REQ-UI-039: Editor catalogue mismatch

When a different-powertrain catalogue model is selected while editing a persisted profile, the system shall retain the stored powertrain value.

### REQ-UI-040: Takeoff point overlay

The system shall overlay the takeoff CG point on the loading chart.

### REQ-UI-041: Landing point overlay

The system shall overlay the landing CG point on the loading chart.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
