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

### REQ-WX-017: QNH unit drafts

When the pilot switches forecast QNH units, the system shall retain the separate entry and its source details for each unit until the selection or QNH entry is cleared.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

### REQ-WX-018: Clear one QNH draft

When the pilot clears the selected forecast QNH draft, the system shall retain the other unit’s draft.

### REQ-WX-019: Manual QNH entry access

When the pilot selects manual QNH entry, the system shall focus the forecast QNH input.

### REQ-WX-020: Nonexistent local forecast times

When a selected forecast time or declared QNH source or validity time does not exist in the device time zone, the system shall prevent application of the affected forecast value.

### REQ-WX-021: Repeated local QNH times

When a QNH flight, source or validity time occurs twice in the device time zone, the system shall require the pilot to confirm the displayed UTC interpretations before applying QNH.

### REQ-WX-022: QNH source time type

When the pilot declares a QNH source time type, the system shall retain it with the applied QNH provenance.

### REQ-WX-023: Current QNH before replacement

While a pilot-entered forecast QNH is present, the system shall show the current Flight Prep QNH and its unit or indicate that it is empty.

### REQ-WX-024: QNH validity feedback

When a declared QNH validity interval cannot be applied, the system shall explain the validity error.

### REQ-WX-025: UTC QNH time entry

When the pilot copies a representable UTC time to a QNH source or validity field, the system shall convert it to device-local time.

### REQ-WX-026: Unrepresentable UTC QNH time

When a UTC time maps to the second occurrence of a repeated local time, the system shall reject copying it to a QNH time field.

### REQ-WX-027: UTC flight time entry

When the pilot selects a representable UTC flight time, the system shall convert it to device-local time.

### REQ-WX-028: Unrepresentable UTC flight time

When a UTC flight time maps to the second occurrence of a repeated local time, the system shall reject it.

### REQ-WX-027: Model gust forecast

When a global model gust forecast is available for the selected hour, the system shall show the maximum gust for the preceding hour without applying it to calculations.

### REQ-WX-028: Model precipitation probability

When a global model precipitation probability is available for the selected hour, the system shall show the probability for the preceding hour without determining runway conditions.

### REQ-WX-029: Model cloud cover and visibility

When global model cloud cover or visibility is available for the selected hour, the system shall show it as model data without applying it to calculations.

### REQ-WX-030: Model dew point

When global model dew point is available for the selected hour, the system shall show it as model data without applying it to calculations.

### REQ-WX-031: Model precipitation amount

When a global model precipitation amount is available for the selected hour, the system shall show the total for the preceding hour without applying it to calculations.

### REQ-WX-032: Model freezing level

When a global model freezing level is available for the selected hour, the system shall show it in metres above mean sea level as model data without applying it to calculations.

### REQ-WX-033: Model CAPE

When a global model convective available potential energy is available for the selected hour, the system shall show it in J/kg as model data without applying it to calculations.

### REQ-WX-034: Model cloud cover layers

When global model low, mid or high cloud cover is available for the selected hour, the system shall show each available layer in percent as model data without applying it to calculations.

### REQ-WX-035: Model snowfall

When a global model snowfall is available for the selected hour, the system shall show it in centimetres for the preceding hour as model data without applying it to calculations.

### REQ-WX-036: Model sea-level pressure

When a global model mean sea-level pressure is available for the selected hour, the system shall show it in hectopascals labelled as not aviation QNH without applying it to calculations.

### REQ-WX-037: Model weather classification

When a global model WMO weather code of a known category is available for the selected hour, the system shall show its description as model data without applying it to calculations.

### REQ-WX-038: Model boundary layer height

When a global model boundary layer height is available for the selected hour, the system shall show it in metres as model data without applying it to calculations.

### REQ-WX-039: Model relative humidity

When a global model 2 m relative humidity is available for the selected hour, the system shall show it in percent as model data without applying it to calculations.

### REQ-WX-040: Model lifted index

When a global model lifted index is available for the selected hour, the system shall show it as model data without applying it to calculations.

### REQ-WX-041: Model convective inhibition

When a global model convective inhibition is available for the selected hour, the system shall show it in J/kg as model data without applying it to calculations.

### REQ-WX-042: Model 80 m wind

When a global model wind at 80 m above ground is available for the selected hour, the system shall show it in knots and true degrees as model data without applying it to calculations.

### REQ-WX-043: Model 850 hPa wind

When a global model wind at the 850 hPa pressure level is available for the selected hour, the system shall show it in knots and true degrees, with the model temperature and geopotential height where available, as model data without applying it to calculations.

### REQ-WX-044: Model dew point spread

When a global model 2 m temperature and dew point are both available for the selected hour, the system shall show their difference in °C as model data without applying it to calculations.

### REQ-WX-045: Model daylight flag

When a global model day or night flag is available for the selected hour, the system shall show it as a model sun-position value, not sunrise, sunset or legal night, without applying it to calculations.

### REQ-WX-046: Model snow depth

When a global model snow depth is available for the selected hour, the system shall show it in metres as model data without applying it to calculations.

### REQ-WX-047: Model 700 hPa wind

When a global model wind at the 700 hPa pressure level is available for the selected hour, the system shall show it in knots and true degrees, with the model geopotential height where available, as model data without applying it to calculations.
