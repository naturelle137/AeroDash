# AeroDash Software Requirements - User Interface (UI)

This document defines the user interface behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-UI-001@ -->
### REQ-UI-001

**Requirement:** When the user selects a manufacturer from the dropdown, the model dropdown shall be populated with models for that manufacturer.
**Rationale:** Context-aware selection.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-002@ -->
### REQ-UI-002

**Requirement:** When 'Other' is selected for manufacturer, the system shall replace the model dropdown with a text input field for manual entry.
**Rationale:** Support for rare or one-off aircraft.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-003@ -->
### REQ-UI-003

**Requirement:** When a model is selected, the ICAO aircraft type designator field shall be auto-filled.
**Rationale:** Faster and more accurate identification.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-004@ -->
### REQ-UI-004

**Requirement:** When a valid ICAO type designator is entered, the system shall display a selection list of matching Manufacturer/Model combinations.
**Rationale:** Bidirectional lookup for convenience.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-005@ -->
### REQ-UI-005

**Requirement:** The system shall display the 5 most recently used airports at the top of the airport selection interface.
**Rationale:** Speed up data entry for frequent routes.
**Priority:** P3
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-006@ -->
### REQ-UI-006

**Requirement:** The system shall display available Passenger Profiles for quick selection within the load station input fields
**Rationale:** Operational efficiency for frequent flyers.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-007@ (FROM: @H-008@, @H-008@) -->
### REQ-UI-007

**Requirement:** The system shall aggregate the validation states returned by the calculation modules (Mass & Balance, Performance, Weather) and display a consolidated "Traffic Light" status (Green/Amber/Red) visible at all times during flight preparation.
**Rationale:** Safety check at high-frequency entry.
**Priority:** P1
**Mitigation Hazard:** [H-008](../risk_management/safety_hazards.md#H-008)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-008@ -->
### REQ-UI-008

**Requirement:** The system shall return a Notification: `{ "id": "WARN-UI-001", "severity": "WARNING", "message": "Input Out of Range", "context": "UI.Input" }` when numeric inputs are outside standard operational ranges ($QNH \notin [950, 1100]\,\text{hPa}$, Temperature $\notin [-40, +50]\,\text{°C}$), but shall allow entry confirmation.
**Rationale:** Prevents fat-finger errors during planning.
**Priority:** P1
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** [Notification Scheme](#notificationScheme)

<!-- @REQ-UI-009@ (FROM: @H-005@, @H-005@) -->
### REQ-UI-009

**Requirement:** When a certification category is changed, the system shall immediately recalculate all limits and update the display.
**Rationale:** Dynamic context switching (e.g., for aerobatics).
**Priority:** P1
**Mitigation Hazard:** [H-005](../risk_management/safety_hazards.md#H-005)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-010@ (FROM: @H-006@, @H-006@) -->
### REQ-UI-010

**Requirement:** The CG envelope chart shall render a "Trend Line" connecting the Take-off CG point and the Landing CG point to visualize the fuel burn shift.
**Rationale:** Provides intuitive feedback on how the aircraft balance changes during flight.
**Priority:** P1
**Mitigation Hazard:** [H-006](../risk_management/safety_hazards.md#H-006)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-011@ (FROM: @H-018@, @H-018@) -->
### REQ-UI-011

**Requirement:** The system shall provide a toggleable "Dark Mode" (high contrast, black/red or black/green theme).
**Rationale:** Preserve pilot night vision during night operations.
**Priority:** P3
**Mitigation Hazard:** [H-018](../risk_management/safety_hazards.md#H-018)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-012@ -->
### REQ-UI-012

**Requirement:** When the user activates the dedicated information icon adjacent to a complex data field or acronym, the system shall display a contextual explanation of that term in a pop-over element (Tooltip).
**Rationale:** Clarifies complex aviation terminology (e.g., TORA, ASDA, MZFM) to prevent misinterpretation and data entry errors. "Activates" ensures compatibility with touch devices.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-013@ (FROM: @H-019@, @H-019@) -->
### REQ-UI-013

**Requirement:** The system shall display the current Semantic Version (SemVer) and Release Date in a dedicated "About" view.
**Rationale:** Enables manual verification of the software state by the pilot.
**Priority:** P2
**Mitigation Hazard:** [H-019](../risk_management/safety_hazards.md#H-019)
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-014@ -->
### REQ-UI-014

**Requirement:** The system shall provide a toggle control adjacent to each Unverified data field that transitions the status to Verified upon user activation.
**Rationale:** Allows granular verification during planning ("Clean as you go").
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-015@ (FROM: @H-015@, @H-015@) -->
### REQ-UI-015

**Requirement:** When the user triggers the "Save" or "Export" action for a calculation containing parameters with `Unverified` status, the system shall return a Notification: `{ "id": "CRIT-UI-001", "severity": "CRITICAL", "message": "Unverified Data Present", "context": "UI.Validation", "action": { "label": "Review", "event": "ui.review_unverified", "payload": { "parameters": ["<list_of_field_paths>"], "canForceSave": true } } }`. The action shall list all parameters with `Unverified` status and their current values.
**Rationale:** Safety Gate. Prevents silent usage of unverified data.
**Priority:** P1
**Mitigation Hazard:** [H-015](../risk_management/safety_hazards.md#H-015)
**Status:** Approved
**Design Reference:** [Notification Scheme](#notificationScheme)

<!-- @REQ-UI-016@ -->
### REQ-UI-016

**Requirement:** The confirmation dialog [REQ-UI-015](#req-ui-015) shall provide an option to "Mark all as Verified" which transitions the status of all current airport parameters to `Verified` in the local database.
**Rationale:** Efficiency for "Verify at the end" workflow.
**Priority:** P2
**Mitigation Hazard:** n/a
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-UI-017@ (FROM: @H-016@, @H-016@) -->
### REQ-UI-017

**Requirement:** When the user triggers the "Save" or "Export" action for a calculation containing an Operational Safety Factor below the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), the system shall return a Notification: `{ "id": "CRIT-UI-002", "severity": "CRITICAL", "message": "Safety Factor Low", "context": "UI.Validation", "action": { "label": "Confirm", "event": "ui.confirm_safety_factor", "payload": { "currentFactor": 1.10, "requiredFactor": 1.25, "context": "Takeoff" } } }`.
**Rationale:** Safety Gate. Prevents silent usage of too low safety factors.
**Priority:** P1
**Mitigation Hazard:** [H-016](../risk_management/safety_hazards.md#H-016)
**Status:** Approved
**Design Reference:** [Notification Scheme](#notificationScheme)

<!-- @REQ-UI-018@ -->
### REQ-UI-018

**Requirement:** The system shall subscribe to the Notification Service and render notifications based on their severity: <ul><li>`INFO`: Toast/Banner</li> <li>`WARNING`: Dismissible Alert or Field Indicator</li> <li>`CRITICAL`: Blocking Modal or Flashing Alert</li></ul>
**Rationale:** Consistent user experience for different urgency levels.
**Priority:** P1
**Mitigation Hazard:** [H-008](../risk_management/safety_hazards.md#H-008)
**Status:** Approved
**Design Reference:** [Notification Scheme](#notificationScheme)

<!-- @REQ-UI-019@ (FROM: @H-006@, @H-006@) -->
### REQ-UI-019

**Requirement:** The system shall render the CG Envelope Polygon defined by the Mass & Balance module as the background layer of the loading chart, with the Zero Fuel Mass (ZFM), Take-off Mass (TOM), and Landing Mass (LM) points overlaid.
**Rationale:** Ensure clear visualization of the aircraft's safe loading limits and flight progression.
**Priority:** P1
**Mitigation Hazard:** [H-006](../risk_management/safety_hazards.md#H-006)
**Status:** Approved
**Design Reference:** n/a

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
