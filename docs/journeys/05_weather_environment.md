# User Journeys - Phase E: Weather & Environment

Focus: Meteorological data integration and surface condition logic.

---

<!-- @UJ-E-001@ (FROM: @REQ-WX-001@, @REQ-WX-003@, @REQ-WX-004@, @REQ-WX-006@, @REQ-AP-004@) -->
## <a name="UJ-E-001"></a>UJ-E-001: The "Rainy Day" Scenario (WX Integration)

**Persona:** Pilot

**Context:** Preparing for an IFR departure from Hamburg (EDDH) during a heavy autumn rainstorm.

**Goal:** Verify automation of surface condition defaults based on live weather data.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Airport Selection** | User enters Airport ICAO ("EDDH"). | "Let's pull up the data for Hamburg." | System matches ICAO. |
| **METAR Ingestion** | System fetches METAR: "EDDH 1234Z ... **RA** ...". | "Looks awful out there." | App parses METAR precipitation codes natively. |
| **Surface Automation** | Verify: Runway Surface defaults to **"Wet"**. | "Good, it noticed the rain." | Because the METAR contains "RA" (Rain), the performance module immediately flips the runway state to "Wet" and applies performance degradation factors. |
| **Manual Correction** | Verify: Pilot can manually override to "Dry". | "Wait, the rain just stopped and the runway is visibly dry now. I'll switch it back." | App allows the manual override, ignoring the stale METAR condition for that specific parameter. |

**Outcome:** The pilot benefits from automated safety-conservative configurations based on real-world METAR data, but retains the ultimate PIC authority to override inaccurate or outdated weather feeds.

<!-- @UJ-E-002@ (FROM: @REQ-WX-007@, @REQ-WX-009@, @REQ-PF-014@) -->
## <a name="UJ-E-002"></a>UJ-E-002: The "Crosswind Challenge"

**Persona:** Pilot

**Context:** Planning a departure during a strong frontal passage with stiff, gusty winds.

**Goal:** Verify wind component calculation and critical crosswind limit alerts.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Runway Setup** | User selects Runway 23 (Heading 230°). | "Runway 23 is the active." | App loads Runway 23 parameters. |
| **Wind Data Entry** | METAR Wind: 320° at 25kt. | "That wind is almost perpendicular." | App parses wind velocity and direction. |
| **Vector Calculation** | Navigates to Performance. | "Let's see the crosswind component." | System calculates a Crosswind Component of ~25kts. |
| **Exceedance Alert** | Verify system reaction. | "Can this plane handle that?" | App fires a **Critical Alert**: "Crosswind Limit Exceeded" (Aircraft Max Demonstrated is 15kt). |
| **Mitigation** | User changes Runway to 33 -> Alert disappears. | "I'll ask ATC for Runway 33 instead." | System recalculates vector. Crosswind drops to ~5kts, the alert clears, and the UI shifts to green. |

**Outcome:** The pilot avoids a loss-of-control incident during the takeoff roll by being visually warned that the current wind conditions exceed the certified aerodynamic boundaries of the airframe.
