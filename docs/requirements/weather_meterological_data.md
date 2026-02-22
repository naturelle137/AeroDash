# AeroDash Software Requirements - Weather & Meteorological Data (WX)

This document defines the weather & meteorological data behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status | Design Reference |
 | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
<!-- @REQ-WX-001@ -->
| **<a name="REQ-WX-001"></a>REQ-WX-001** | When a user enters an ICAO airport code, the system shall fetch the current METAR and TAF from a public aviation weather API. | Fetches real-time environmental input for Performance (e.g., CheckWX, NOAA). | P2 | n/a | Approved | n/a |
<!-- @REQ-WX-002@ -->
| **<a name="REQ-WX-002"></a>REQ-WX-002** | When a departure or arrival time is defined, the system shall retrieve forecast weather data (Temperature, QNH, Wind) for that specific time and location from a meteorological data service. | TAFs do not provide hourly Temp/QNH. Model data is required for accurate performance calculation. | P2 | n/a | Approved | n/a |
<!-- @REQ-WX-003@ -->
| **<a name="REQ-WX-003"></a>REQ-WX-003** | While forecast weather data is unavailable, when METAR/TAF data is received, the system shall auto-populate Wind Direction/Speed, Temperature, and QNH fields based on the latest METAR/TAF. | Automation reduces human entry errors. | P2 | n/a | Approved | n/a |
<!-- @REQ-WX-004@ (FROM: @H-009@, @H-009@) -->
| **<a name="REQ-WX-004"></a>REQ-WX-004** | While a METAR/TAF indicates any form of liquid precipitation (RA, DZ), the system shall default the Runway Surface to "Wet". | Safety-first default based on weather detection. | P2 | [H-009](../risk_management/safety_hazards.md#H-009) | Approved | n/a |
<!-- @REQ-WX-005@ (FROM: @H-009@, @H-009@) -->
| **<a name="REQ-WX-005"></a>REQ-WX-005** | While a METAR/TAF indicates heavy precipitation (+RA) or long-lasting precipitation (> 2h in TAF), the system shall default Grass runways to "Soft Ground". | Safety-first default based on weather detection. | P2 | [H-009](../risk_management/safety_hazards.md#H-009) | Approved | n/a |
<!-- @REQ-WX-006@ -->
| **<a name="REQ-WX-006"></a>REQ-WX-006** | The system shall allow the user to manually override any weather-inferred surface condition. | Pilot-in-command has final authority over runway state. | P2 | n/a | Approved | n/a |
<!-- @REQ-WX-007@ -->
| **<a name="REQ-WX-007"></a>REQ-WX-007** | When a runway is selected, the system shall calculate the Wind Components (Headwind, Tailwind, Crosswind) based on the latest METAR wind data and the selected runway's heading. | Automation of wind correction for performance and safety. | P2 | n/a | Approved | n/a |
<!-- @REQ-WX-008@ -->
| **<a name="REQ-WX-008"></a>REQ-WX-008** | When weather data is auto-populated, the system shall provide the metadata (Source, Timestamp) for all data points. | Safety awareness: Pilot must know if data is measured (METAR) or predicted (Model). | P2 | n/a | Approved | n/a |
<!-- @REQ-WX-009@ (FROM: @H-014@, @H-014@) -->
| **<a name="REQ-WX-009"></a>REQ-WX-009** | While the active aircraft has defined wind limits, if any wind or gust component (total wind/gust, headwind, tailwind, crosswind) exceeds the limits of the aircraft, then the system shall return a Notification: `{ "id": "WARN-WX-001", "severity": "WARNING", "message": "Wind Limit Exceeded", "context": "Weather.Wind" }`. | Safety awareness: Pilot should know when wind exceeds the aircraft limits. | P2 | [H-014](../risk_management/safety_hazards.md#H-014) | Approved | [Notification Scheme](#notificationScheme) |

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
