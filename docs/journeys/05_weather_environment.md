# User Journeys - Phase E: Weather & Environment

Focus: Meteorological data integration and surface condition logic.

---

## <a name="UJ-E-001"></a>UJ-E-001: The "Rainy Day" Scenario (WX Integration)
**Goal:** Verify automation of surface condition defaults based on live weather data.
* **Actor:** Pilot
* **Scenario:**
    1.  User enters Airport ICAO ("EDDH").
    2.  System fetches METAR: "EDDH 1234Z ... **RA** ...".
    3.  Verify: Runway Surface defaults to **"Wet"**.
    4.  Verify: Pilot can manually override to "Dry".
* **Traceability:**
    * **Requirements:** [REQ-WX-001](../requirements/weather_meterological_data.md#REQ-WX-001), [REQ-WX-003](../requirements/weather_meterological_data.md#REQ-WX-003), [REQ-WX-004](../requirements/weather_meterological_data.md#REQ-WX-004), [REQ-WX-006](../requirements/weather_meterological_data.md#REQ-WX-006), [REQ-AP-004](../requirements/airport_database.md#REQ-AP-004)

## <a name="UJ-E-002"></a>UJ-E-002: The "Crosswind Challenge"
**Goal:** Verify wind component calculation and critical alerts.
* **Actor:** Pilot
* **Scenario:**
    1.  User selects Runway 23 (Heading 230°).
    2.  METAR Wind: 320° at 25kt.
    3.  System calculates Crosswind Component (25kt).
    4.  Verify: **Critical Alert** "Crosswind Limit Exceeded" (Aircraft Max: 15kt).
    5.  User changes Runway to 33 -> Alert disappears.
* **Traceability:**
    * **Requirements:** [REQ-WX-007](../requirements/weather_meterological_data.md#REQ-WX-007), [REQ-WX-009](../requirements/weather_meterological_data.md#REQ-WX-009), [REQ-PF-014](../requirements/performance.md#REQ-PF-014)
