# AeroDash Software Requirements - User Interface (UI)

This document defines the user interface behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **n/a** | n/a |

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
| **<a name="REQ-UI-007">REQ-UI-007</a>** | The UI shall provide immediate visual feedback (Green/Amber/Red) for all limit checks (Mass, CG, Runway Length, Crosswind) without requiring a "Calculate" button press. | Safety check at high-frequency entry. | P1 |  H-008 | Draft |
| **<a name="REQ-UI-008">REQ-UI-008</a>** | The system shall display a visual warning message when numeric inputs are outside standard operational ranges (1100 hPa < QNH < 950 hPa, +50°C < Temperature < -40°C), but shall allow entry confirmation. | Prevents fat-finger errors during planning. | P1 |  n/a | Draft |
| **<a name="REQ-UI-009">REQ-UI-009</a>** | When a certification category is changed, the system shall immediately recalculate all limits and update the display. | Dynamic context switching (e.g., for aerobatics). | P1 |  H-005 | Draft |
| **<a name="REQ-UI-010">REQ-UI-010</a>** | The CG envelope chart shall render a "Trend Line" connecting the Take-off CG point and the Landing CG point to visualize the fuel burn shift. | Provides intuitive feedback on how the aircraft balance changes during flight. | P1 |  H-006 | Draft |
| **<a name="REQ-UI-011">REQ-UI-011</a>** | The system shall provide a toggleable "Dark Mode" (high contrast, black/red or black/green theme). | Preserve pilot night vision during night operations. | P |  n/a | Draft |

---
