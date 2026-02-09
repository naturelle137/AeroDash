# AeroDash Software Requirements - Weather & Meteorological Data (WX)

This document defines the weather & meteorological data behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **API** | **A**pplication **P**rogramming **I**nterface |
| **DZ** | Drizzle |
| **ICAO** | **I**nternational **C**ivil **A**viation **O**rganization |
| **METAR** | **MET**eorological **A**erodrome **R**eport |
| **RA** | Rain |
| **+RA** | Heavy Rain |
| **TAF** | **T**erminal **A**erodrome **F**orecast |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-WX-001">REQ-WX-001</a>** | When a user enters an ICAO airport code, the system shall fetch the current METAR and TAF from a public aviation weather API. | Fetches real-time environmental input for Performance (e.g., CheckWX, NOAA). | P2 |  n/a | Draft |
| **<a name="REQ-WX-002">REQ-WX-002</a>** | When a departure or arrival time is defined, the system shall retrieve forecast weather data (Temperature, QNH, Wind) for that specific time and location from a meteorological data service. | TAFs do not provide hourly Temp/QNH. Model data is required for accurate performance calculation. | P2 |  n/a | Draft |
| **<a name="REQ-WX-003">REQ-WX-003</a>** | While forecast wether data is unavailable, when METAR/TAF data is received, the system shall auto-populate Wind Direction/Speed, Temperature, and QNH fields based on the latest METAR/TAF. | Automation reduces human entry errors. | P2 |  n/a | Draft |
| **<a name="REQ-WX-004">REQ-WX-004</a>** | While a METAR/TAF indicates any form of liquid precipitation (RA, DZ), the system shall default the Runway Surface to "Wet". | Safety-first default based on weather detection. | P2 |  n/a | Draft |
| **<a name="REQ-WX-005">REQ-WX-005</a>** | While a METAR/TAF indicates heavy precipitation (+RA) or long-lasting precipitation (> 2h in TAF), the system shall default Grass runways to "Soft Ground". | Safety-first default based on weather detection. | P2 |  n/a | Draft |
| **<a name="REQ-WX-006">REQ-WX-006</a>** | The system shall allow the user to manually override any weather-inferred surface condition. | Pilot-in-command has final authority over runway state. | P2 |  n/a | Draft |
| **<a name="REQ-WX-007">REQ-WX-007</a>** | When a runway is selected, the system shall calculate and display the Wind Components (Headwind, Tailwind, Crosswind) based on the latest METAR wind data and the selected runway's heading. | Automation of wind correction for performance and safety. | P2 |  n/a | Draft |
| **<a name="REQ-WX-008">REQ-WX-008</a>** | When weather data is auto-populated, the system shall indicate the source (METAR, TAF, or Forecast Model) and the age of the data to the user. | Safety awareness: Pilot must know if data is measured (METAR) or predicted (Model). | P2 |  n/a | Draft |
| **<a name="REQ-WX-009">REQ-WX-009</a>** | While wind limits are saved for the selected aircraft, if any wind or gust component (total wind/gust, headwind, tailwind, crosswind) exceeds the limits of the aircraft, then the system shall display a warning.  | Safety awareness: Pilot should know when wind exceeds the aircraft limits. | P2 |  n/a | Draft |

---
