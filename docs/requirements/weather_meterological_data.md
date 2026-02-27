# AeroDash Software Requirements - Weather & Meteorological Data (WX)

This document defines the weather & meteorological data behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-WX-001@ -->
### REQ-WX-001: METAR/TAF Retrieval

**Requirement:** When a user enters an ICAO airport code, the system shall fetch the current METAR and TAF from a public aviation weather API.
**Rationale:** Fetches real-time environmental input for Performance (e.g., CheckWX, NOAA).
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-WX-002@ -->
### REQ-WX-002: Time-Specific Weather Forecast

**Requirement:** When a departure or arrival time is defined, the system shall retrieve forecast weather data (Temperature, QNH, Wind) for that specific time and location from a meteorological data service.
**Rationale:** TAFs do not provide hourly Temp/QNH. Model data is required for accurate performance calculation.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-WX-003@ -->
### REQ-WX-003: Weather Auto-population

**Requirement:** While forecast weather data is unavailable, when METAR/TAF data is received, the system shall auto-populate Wind Direction/Speed, Temperature, and QNH fields based on the latest METAR/TAF.
**Rationale:** Automation reduces human entry errors.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-WX-004@ (FROM: @H-009@) -->
### REQ-WX-004: Precipitation Surface Default

**Requirement:** While a METAR/TAF indicates any form of liquid precipitation (RA, DZ), the system shall default the Runway Surface to "Wet".
**Rationale:** Safety-first default based on weather detection.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-WX-005@ (FROM: @H-009@) -->
### REQ-WX-005: Heavy Precipitation Surface Default

**Requirement:** While a METAR/TAF indicates heavy precipitation (+RA) or long-lasting precipitation (> 2h in TAF), the system shall default Grass runways to "Soft Ground".
**Rationale:** Safety-first default based on weather detection.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-WX-006@ -->
### REQ-WX-006: Manual Surface Override

**Requirement:** The system shall allow the user to manually override any weather-inferred surface condition.
**Rationale:** Pilot-in-command has final authority over runway state.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-WX-007@ -->
### REQ-WX-007: Wind Components Calculation

**Requirement:** When a runway is selected, the system shall calculate the Wind Components (Headwind, Tailwind, Crosswind) based on the latest METAR wind data and the selected runway's heading.
**Rationale:** Automation of wind correction for performance and safety.
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-WX-008@ -->
### REQ-WX-008: Weather Metadata Display

**Requirement:** When weather data is auto-populated, the system shall provide the metadata (Source, Timestamp) for all data points.
**Rationale:** Safety awareness: Pilot must know if data is measured (METAR) or predicted (Model).
**Priority:** P2
**Status:** Approved
**Design Reference:** n/a

<!-- @REQ-WX-009@ (FROM: @H-014@) -->
### REQ-WX-009: Wind Limit Exceedance Notification

**Requirement:** While the active aircraft has defined wind limits, if any wind or gust component (total wind/gust, headwind, tailwind, crosswind) exceeds a stored limit of the aircraft, then the system shall return a Notification with severity determined by the limit classification (REQ-AD-017): <ul><li>`Demonstrated`: `{ "id": "WARN-WX-001", "severity": "WARNING", "message": "Wind Limit Exceeded (Demonstrated)", "context": "Weather.Wind" }`</li><li>`Limit`: `{ "id": "CRIT-WX-001", "severity": "CRITICAL", "message": "Wind Limit Exceeded", "context": "Weather.Wind" }`</li></ul>
**Rationale:** A demonstrated value is advisory (PIC may exceed at discretion), while a hard POH limit is a mandatory operational boundary. The notification severity must reflect this distinction to avoid both under- and over-alerting.
**Priority:** P1
**Status:** Approved
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
