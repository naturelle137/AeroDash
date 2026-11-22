# AeroDash Software Requirements - Weather & Meteorological Data (WX)

## Requirements

### REQ-WX-001: METAR/TAF Retrieval

When a user enters an ICAO airport code, the system shall retrieve the current METAR from the configured aviation weather service.

### REQ-WX-002: Time-Specific Weather Forecast

When a departure or arrival time is defined, the system shall retrieve forecast weather data (Temperature, QNH, Wind) for that specific time and location from a meteorological data service.

### REQ-WX-003: Weather Auto-population

While forecast weather is unavailable, when the pilot selects a valid current METAR wind, the system shall apply it to Flight Prep wind inputs.

### REQ-WX-004: Precipitation Surface Default

While a METAR/TAF indicates any form of liquid precipitation (RA, DZ), the system shall default the Runway Surface to "Wet".

### REQ-WX-005: Heavy Precipitation Surface Default

While a METAR/TAF indicates heavy precipitation (+RA) or long-lasting precipitation (> 2h in TAF), the system shall default Grass runways to "Soft Ground".

### REQ-WX-006: Manual Surface Override

The system shall allow the user to manually override any weather-inferred surface condition.

### REQ-WX-007: Wind Components Calculation

When a runway is selected, the system shall calculate the Wind Components (Headwind, Tailwind, Crosswind) based on the latest METAR wind data and the selected runway's heading.

### REQ-WX-007a: Manual wind components

When the pilot enters a runway heading, wind direction and wind speed, the system shall display the headwind or tailwind and the signed crosswind component as advisory, user-entered values.

### REQ-WX-007b: Manual wind input rejection

If a required manual wind input is missing, outside 1–360° (speed 0–200) or variable, then the system shall show no wind components. Calm wind requires no direction.

### REQ-WX-007c: Manual wind in briefing

When valid manual wind components are available, the system shall include them and their inputs in the briefing.

### REQ-WX-008: Weather Metadata Display

While an applied METAR value remains unchanged, the system shall display its source and observation time.

### REQ-WX-009: Wind Limit Exceedance Notification

If a wind or gust component exceeds a stored Demonstrated limit, then the system shall emit WARNING `WARN-WX-001` identifying that exceedance.

Manual steady wind is compared with stored total-wind, tailwind and crosswind values in knots. Pilot-entered gusts are also compared with stored maximum-gust values. Equality is not an exceedance. Missing or invalid inputs do not imply safety; pilot-entered gusts use the same direction and unit and are cleared when the steady wind changes.

### REQ-WX-010: TAF retrieval

When a user enters an ICAO airport code, the system shall retrieve the current TAF from the configured aviation weather service.

### REQ-WX-011: Hard wind limit warning

If a wind or gust component exceeds a stored Limit value, then the system shall emit CRITICAL `CRIT-WX-001` identifying that exceedance.

### REQ-WX-012: Weather temperature population

While forecast weather is unavailable, when the pilot selects a valid current METAR temperature, the system shall apply it to the Flight Prep temperature input.

### REQ-WX-013: Weather QNH population

While forecast weather is unavailable, when the pilot selects a valid current METAR QNH, the system shall apply it to the Flight Prep QNH input.

### REQ-WX-014: Pilot-entered forecast application

When the pilot selects a valid forecast value entered for a future local time and location, the system shall apply that value to Flight Prep with its manual provenance.

### REQ-WX-015: Forecast selection changes

When the pilot changes the forecast phase, location or time, the system shall clear the entered forecast values.

### REQ-WX-016: Pilot-declared QNH validity

When the pilot declares a QNH validity interval, the system shall allow application only when the selected flight time is within its start-inclusive, end-exclusive interval.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
