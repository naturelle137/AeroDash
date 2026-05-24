# AeroDash Software Requirements - User Interface (UI)

This document defines the user interface behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-UI-001@ -->

### REQ-UI-001: Manufacturer Model Population

**Requirement:** When the user selects a manufacturer from the dropdown, the model dropdown shall be populated with models for that manufacturer.
**Rationale:** Context-aware selection.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UI-002@ -->

### REQ-UI-002: Manual Model Entry

**Requirement:** When 'Other' is selected for manufacturer, the system shall replace the model dropdown with a text input field for manual entry.
**Rationale:** Support for rare or one-off aircraft.
**Priority:** P1
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UI-003@ -->

### REQ-UI-003: ICAO Designator Auto-fill

**Requirement:** When a model is selected, the ICAO aircraft type designator field shall be auto-filled.
**Rationale:** Faster and more accurate identification.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UI-004@ -->

### REQ-UI-004: Bidirectional ICAO Lookup

**Requirement:** When a valid ICAO type designator is entered, the system shall display a selection list of matching Manufacturer/Model combinations.
**Rationale:** Bidirectional lookup for convenience.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UI-005@ -->

### REQ-UI-005: Recent Airports Display

**Requirement:** The system shall display the 5 most recently used airports at the top of the airport selection interface.
**Rationale:** Speed up data entry for frequent routes.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-006@ -->

### REQ-UI-006: Passenger Profile Selection

**Requirement:** The system shall display available Passenger Profiles for quick selection within the load station input fields
**Rationale:** Operational efficiency for frequent flyers.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

### REQ-UI-007

**Status:** Deprecated

<!-- @REQ-UI-008@ -->

### REQ-UI-008: Input Out of Range Warning

**Requirement:** When numeric inputs are outside standard operational ranges ($QNH \notin [950, 1100]\,\text{hPa}$, Temperature $\notin [-40, +50]\,\text{°C}$), the system shall emit a WARNING notification (`WARN-UI-001`) alerting the user that the input is out of range, but shall allow entry confirmation.
**Rationale:** Prevents fat-finger errors during planning.
**Priority:** P1
**Status:** Implemented
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-UI-009@ (FROM: @H-005@) -->

### REQ-UI-009: Category Change Recalculation

**Requirement:** When a certification category is changed, the system shall immediately recalculate all limits and update the display.
**Rationale:** Dynamic context switching (e.g., for aerobatics).
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-010@ (FROM: @H-006@) -->

### REQ-UI-010: CG Migration Rendering

**Requirement:** The CG envelope chart shall render a CG migration visualization: a **Trend Line** connecting the Take-off CG point and the Landing CG point for single-sequence aircraft, or a **Trend Area** (shaded polygon) representing the burn-down region for multi-sequence aircraft.
**Rationale:** Provides intuitive feedback on how the aircraft balance changes during flight. For multi-tank aircraft with alternate burn sequences, a single line is insufficient — the shaded polygon shows all possible CG states.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-011@ (FROM: @H-018@) -->

### REQ-UI-011: Dark Mode Support

**Requirement:** The system shall provide a toggleable "Dark Mode" (high contrast, black/red or black/green theme).
**Rationale:** Preserve pilot night vision during night operations.
**Priority:** P3
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-012@ -->

### REQ-UI-012: Contextual Tooltips

**Requirement:** When the user activates the dedicated information icon adjacent to a complex data field or acronym, the system shall display a contextual explanation of that term in a pop-over element (Tooltip).
**Rationale:** Clarifies complex aviation terminology (e.g., TORA, ASDA, MZFM) to prevent misinterpretation and data entry errors. "Activates" ensures compatibility with touch devices.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-013@ (FROM: @H-019@) -->

### REQ-UI-013: SemVer and Date Display

**Requirement:** The system shall display the current Semantic Version (SemVer) and Release Date in a dedicated "About" view.
**Rationale:** Enables manual verification of the software state by the pilot.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UI-014@ -->

### REQ-UI-014: Unverified Data Toggle

**Requirement:** The system shall provide a toggle control adjacent to each Unverified data field that transitions the status to Verified upon user activation.
**Rationale:** Allows granular verification during planning ("Clean as you go").
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UI-015@ (FROM: @H-015@) -->

### REQ-UI-015: Unverified Data Export Warning

**Requirement:** When the user triggers the "Save" or "Export" action for a calculation containing parameters with `Unverified` status, the system shall emit a CRITICAL notification (`CRIT-UI-001`) alerting the user that unverified data is present and offering a review action that lists all unverified parameters.
**Rationale:** Safety Gate. Prevents silent usage of unverified data.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-UI-016@ -->

### REQ-UI-016: Mark All as Verified Option

**Requirement:** The confirmation dialog [REQ-UI-015](#req-ui-015-unverified-data-export-warning) shall provide an option to "Mark all as Verified" which transitions the status of all current airport parameters to `Verified` in the local database.
**Rationale:** Efficiency for "Verify at the end" workflow.
**Priority:** P2
**Status:** Implemented
**Design Reference:** n/a

<!-- @REQ-UI-017@ (FROM: @H-016@) -->

### REQ-UI-017: Low Safety Factor Export Warning

**Requirement:** When the user triggers the "Save" or "Export" action for a calculation containing an Operational Safety Factor below the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), the system shall emit a CRITICAL notification (`CRIT-UI-002`) alerting the user that the safety factor is below the recommended minimum and offering a confirmation action.
**Rationale:** Safety Gate. Prevents silent usage of too low safety factors.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-UI-018@ -->

### REQ-UI-018: Severity-Based Notification Rendering

**Requirement:** The system shall subscribe to the Notification Service and render notifications based on their severity: <ul><li>`INFO`: Toast/Banner</li> <li>`WARNING`: Dismissible Alert or Field Indicator</li> <li>`CRITICAL`: Blocking Modal or Flashing Alert</li></ul>
**Rationale:** Consistent user experience for different urgency levels.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

<!-- @REQ-UI-019@ (FROM: @H-006@) -->

### REQ-UI-019: CG Envelope Polygon Rendering

**Requirement:** The system shall render the CG Envelope Polygon defined by the Mass & Balance module as the background layer of the loading chart, with the Zero Fuel Mass (ZFM), Take-off Mass (TOM), and Landing Mass (LM) points overlaid. For multi-sequence aircraft, the burn-down polygon shall also be overlaid as a shaded area within the envelope.
**Rationale:** Ensure clear visualization of the aircraft's safe loading limits, flight progression, and — for multi-tank aircraft — the full range of possible CG states during fuel consumption.
**Priority:** P1
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-020@ -->

### REQ-UI-020: Connectivity State Indicator

**Requirement:** The system shall display a persistent visual indicator of the current connectivity state (`Online`/`Offline`) in the application header or status bar.
**Rationale:** Replaces individual API failure notifications with a single, always-visible state indicator. Reduces notification fatigue for an offline-first application where disconnected operation is expected.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-021@ (FROM: @REQ-AD-020@) -->

### REQ-UI-021: Powertrain Selector in Aircraft Wizard

**Requirement:** The aircraft wizard shall present a Powertrain selector with the options `Combustion` and `Electric`. When the selected catalogue entry declares an `electric` powertrain, the system shall pre-select `Electric`. The pilot shall be able to override the selection.
**Rationale:** Pilots choose the powertrain once at creation; the catalogue hint turns picking "Pipistrel Velis Electro" into the correct configuration without extra clicks, while the override keeps one-off or non-catalogued aircraft supported.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Native Electric Aircraft UX](../ux/native-electric-aircraft.md)

<!-- @REQ-UI-022@ (FROM: @REQ-AD-020@, @REQ-AD-022@) -->

### REQ-UI-022: Powertrain-Gated Editor Sections

**Requirement:** While `powertrain` is `electric`, the aircraft wizard and editor shall hide every fuel-tank control (fuel-tank toggle on load points, `+ Add Fuel Tank` button, fuel-type selector, burn-sequence editor) and shall show the Battery Pack section. While `powertrain` is `combustion`, the aircraft wizard and editor shall hide the Battery Pack section.
**Rationale:** Combustion pilots must never see battery fields and electric pilots must never see fuel fields; mixed UI invites invalid data and is the defect called out in issue #225.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Native Electric Aircraft UX](../ux/native-electric-aircraft.md)

<!-- @REQ-UI-023@ (FROM: @H-011@, @REQ-AD-022@) -->

### REQ-UI-023: Powertrain Field Immutability in Aircraft Editor

**Requirement:** While the user is editing a persisted aircraft profile, the system shall render the profile's `powertrain` value as a read-only label, shall not present any input control that writes to `powertrain`, and shall retain the stored `powertrain` value when the user selects a model whose catalogue entry declares a different powertrain.
**Rationale:** A persisted profile has a topology (fuel tanks or battery pack) bound to its `powertrain` by [REQ-AD-022](./detailed_aircraft_data.md#req-ad-022-powertrain-field-exclusivity). Any path that mutates `powertrain` on an existing profile without rebuilding the dependent fields produces orphaned state that the schema then rejects on save (`BATTERY_PACK_NOT_ALLOWED_FOR_COMBUSTION`, `ELECTRIC_AIRCRAFT_HAS_FUEL_TANK`, `BATTERY_PACK_REQUIRED_FOR_ELECTRIC`). Locking both the direct radio control and the catalogue-driven hint closes the two known pathways and mirrors the physical reality that an airframe does not change propulsion type after it has been weighed. The wizard retains the selector per [REQ-UI-021](#req-ui-021-powertrain-selector-in-aircraft-wizard); lock applies only to the editor flow.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Native Electric Aircraft UX](../ux/native-electric-aircraft.md)

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
