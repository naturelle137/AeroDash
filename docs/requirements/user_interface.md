# AeroDash Software Requirements - User Interface (UI)

This document defines the user interface behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-UI-001">REQ-UI-001</a>** | When the user selects a manufacturer from the dropdown, the model dropdown shall be populated with models for that manufacturer. | Context-aware selection. | P2 |  n/a | Draft |
| **<a name="REQ-UI-002">REQ-UI-002</a>** | When 'Other' is selected for manufacturer, the system shall replace the model dropdown with a text input field for manual entry. | Support for rare or one-off aircraft. | P1 |  n/a | Draft |
| **<a name="REQ-UI-003">REQ-UI-003</a>** | When a model is selected, the ICAO aircraft type designator field shall be auto-filled. | Faster and more accurate identification. | P2 |  n/a | Draft |
| **<a name="REQ-UI-004">REQ-UI-004</a>** | When a valid ICAO type designator is entered, the system shall display a selection list of matching Manufacturer/Model combinations. | Bidirectional lookup for convenience. | P2 |  n/a | Draft |
| **<a name="REQ-UI-005">REQ-UI-005</a>** | The system shall display the 5 most recently used airports at the top of the airport selection interface. | Ensure... | P3 |  n/a | Draft |
| **<a name="REQ-UI-006">REQ-UI-006</a>** | The system shall display available Passenger Profiles for quick selection within the load station input fields | Operational efficiency for frequent flyers. | P2 |  n/a | Draft |
| **<a name="REQ-UI-007">REQ-UI-007</a>** | The system shall aggregate the validation states returned by the calculation modules (Mass & Balance, Performance, Weather) and display a consolidated "Traffic Light" status (Green/Amber/Red) visible at all times during flight preparation. | Safety check at high-frequency entry. | P1 |  H-008 | Draft |
| **<a name="REQ-UI-008">REQ-UI-008</a>** | The system shall display a visual warning message when numeric inputs are outside standard operational ranges (1100 hPa < QNH < 950 hPa, +50°C < Temperature < -40°C), but shall allow entry confirmation. | Prevents fat-finger errors during planning. | P1 |  n/a | Draft |
| **<a name="REQ-UI-009">REQ-UI-009</a>** | When a certification category is changed, the system shall immediately recalculate all limits and update the display. | Dynamic context switching (e.g., for aerobatics). | P1 |  H-005 | Draft |
| **<a name="REQ-UI-010">REQ-UI-010</a>** | The CG envelope chart shall render a "Trend Line" connecting the Take-off CG point and the Landing CG point to visualize the fuel burn shift. | Provides intuitive feedback on how the aircraft balance changes during flight. | P1 |  H-006 | Draft |
| **<a name="REQ-UI-011">REQ-UI-011</a>** | The system shall provide a toggleable "Dark Mode" (high contrast, black/red or black/green theme). | Preserve pilot night vision during night operations. | P3 |  n/a | Draft |
| **<a name="REQ-UI-012">REQ-UI-012</a>** | When the user activates the dedicated information icon adjacent to a complex data field or acronym, the system shall display a contextual explanation of that term in a tooltip or pop-over element. | Clarifies complex aviation terminology (e.g., TORA, ASDA, MZFM) to prevent misinterpretation and data entry errors. "Activates" ensures compatibility with touch devices. | P2 |  n/a | Draft |
| **<a name="REQ-UI-013">REQ-UI-013</a>** | The system shall display the current Semantic Version (SemVer) and Release Date in a dedicated "About" view. | Enables manual verification of the software state by the pilot. | P2 | [H-019](docs/risk_management/safety_hazards.md#H-019) | Draft |
| **<a name="REQ-UI-014">REQ-UI-014</a>** | The system shall provide a toggle control adjacent to each Unverified data field that transitions the status to Verified upon user activation. | Allows granular verification during planning ("Clean as you go"). | P2 | n/a | Draft |
| **<a name="REQ-UI-015">REQ-UI-015</a>** | When the user triggers the "Save" or "Export" action for a calculation containing parameters with `Unverified` status, the system shall interrupt the process and display a modal confirmation dialog. The dialog shall list all parameters with `Unverified` status and their current values. | Safety Gate. Prevents silent usage of unverified data. | P1 | [H-015](docs/risk_management/safety_hazards.md#H-015) | Draft |
| **<a name="REQ-UI-016">REQ-UI-016</a>** | The confirmation dialog [REQ-UI-015](#REQ-UI-015) shall provide an option to "Mark all as Verified" which transitions the status of all current airport parameters to `Verified` in the local database. | Efficiency for "Verify at the end" workflow. | P2 | n/a | Draft |
| **<a name="REQ-UI-017">REQ-UI-017</a>** | When the user triggers the "Save" or "Export" action for a calculation containing an Operational Safety Factor below the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), the system shall interrupt the process and display a modal confirmation dialog. | Safety Gate. Prevents silent usage of too low safety factors. | P1 | [H-016](docs/risk_management/safety_hazards.md#H-016) | Draft |

---