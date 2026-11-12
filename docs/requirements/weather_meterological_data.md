# AeroDash Software Requirements - Weather & Meteorological Data (WX)

## Requirements

### REQ-WX-001: METAR/TAF Retrieval

When a user enters an ICAO airport code, the system shall retrieve the current METAR from the configured aviation weather service.

### REQ-WX-002: Time-Specific Weather Forecast

When a departure or arrival time is defined, the system shall retrieve forecast weather data (Temperature, QNH, Wind) for that specific time and location from a meteorological data service.

### REQ-WX-003: Weather Auto-population

While forecast weather is unavailable, when METAR/TAF data is received, the system shall populate wind direction/speed from the latest report.

### REQ-WX-004: Precipitation Surface Default

While a METAR/TAF indicates any form of liquid precipitation (RA, DZ), the system shall default the Runway Surface to "Wet".

### REQ-WX-005: Heavy Precipitation Surface Default

While a METAR/TAF indicates heavy precipitation (+RA) or long-lasting precipitation (> 2h in TAF), the system shall default Grass runways to "Soft Ground".

### REQ-WX-006: Manual Surface Override

The system shall allow the user to manually override any weather-inferred surface condition.

### REQ-WX-007: Wind Components Calculation

When a runway is selected, the system shall calculate the Wind Components (Headwind, Tailwind, Crosswind) based on the latest METAR wind data and the selected runway's heading.

### REQ-WX-008: Weather Metadata Display

When weather data is auto-populated, the system shall provide the metadata (Source, Timestamp) for all data points.

### REQ-WX-009: Wind Limit Exceedance Notification

If a wind or gust component exceeds a stored Demonstrated limit, then the system shall emit WARNING `WARN-WX-001` identifying that exceedance.

### REQ-WX-010: TAF retrieval

When a user enters an ICAO airport code, the system shall retrieve the current TAF from the configured aviation weather service.

### REQ-WX-011: Hard wind limit warning

If a wind or gust component exceeds a stored Limit value, then the system shall emit CRITICAL `CRIT-WX-001` identifying that exceedance.

### REQ-WX-012: Weather temperature population

While forecast weather is unavailable, when METAR/TAF data is received, the system shall populate temperature from the latest report.

### REQ-WX-013: Weather QNH population

While forecast weather is unavailable, when METAR/TAF data is received, the system shall populate QNH from the latest report.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
