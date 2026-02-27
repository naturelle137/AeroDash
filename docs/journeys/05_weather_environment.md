# User Journeys - Phase E: Weather & Environment

Focus: Meteorological data integration and surface condition logic.

---

<!-- @UJ-E-001@ (FROM: @REQ-WX-001@, @REQ-WX-003@, @REQ-WX-004@, @REQ-WX-005@, @REQ-WX-006@, @REQ-AP-004@) -->
## <a name="UJ-E-001"></a>UJ-E-001: The "Rainy Day" Scenario (WX Integration)

**Persona:** Pilot

**Context:** Preparing for an IFR departure from Hamburg (EDDH) during a heavy autumn rainstorm.

**Goal:** Wants the system to automatically account for rainy conditions without manual guesswork, while retaining the authority to override if the situation on the ground is different from the METAR.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Airport Selection** | Enters the airport ICAO code "EDDH." | "Let's pull up the data for Hamburg." | The system matches the ICAO code and loads the airport data. |
| **Weather Ingestion** | Notices the weather fields have been auto-populated. | "Looks awful out there." | The system fetches the current METAR and auto-populates the wind, temperature, and QNH fields. |
| **Surface Automation** | Notices the runway surface condition has defaulted to "Wet." | "Good — it noticed the rain." | Because the METAR contains precipitation, the system has automatically defaulted the runway surface condition to "Wet" and applied the corresponding performance correction factors. |
| **Manual Override** | Overrides the surface condition back to "Dry." | "Wait, the rain just stopped and the runway is visibly dry now. I'll switch it back." | The system accepts the manual override and recalculates performance with the "Dry" surface condition. |
| **Heavy Rain Escalation** | Later, the METAR updates to `+RA` (heavy rain). The pilot refreshes weather data. | "It's pouring now. This is worse than before." | The system detects heavy precipitation and defaults the surface to "Standing Water" (not just "Wet"), applying a significantly harsher correction factor. The takeoff distance increases substantially. |
| **Go/No-Go** | Reviews the updated takeoff distance. | "That distance is way beyond what this runway can give me. We're not going." | The required takeoff distance now exceeds the available runway length. The system displays a critical notification: "Runway Insufficient." |

**Outcome:** The pilot benefits from automated, safety-conservative surface defaults based on real-world METAR data, but retains full PIC authority to override inaccurate or outdated weather conditions. The distinction between "Wet" and "Standing Water" is safety-critical — the correction factor difference can be the difference between Go and No-Go.

<!-- @UJ-E-002@ (FROM: @REQ-WX-003@, @REQ-WX-007@, @REQ-WX-009@) -->
## <a name="UJ-E-002"></a>UJ-E-002: The "Crosswind Challenge"

**Persona:** Pilot

**Context:** Planning a departure during a strong frontal passage with stiff, gusty winds.

**Goal:** Wants to know if the crosswind is safe before committing to a runway, and to feel confident in making the right runway choice.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Runway Selection** | Selects Runway 23 (Heading 230°). | "Runway 23 is the active." | The system loads the runway parameters. |
| **Wind Awareness** | Notices the auto-populated wind data from the METAR: 320° at 25 kt. | "That wind is almost perpendicular to the runway." | The system displays the wind direction and speed. |
| **Component Review** | Reviews the calculated wind components on the Performance screen. | "Let's see the crosswind number." | The system displays the calculated crosswind component (~25 kt). |
| **Limit Alert** | Notices a critical notification. | (Concern): "Can this aircraft handle that?" | The system displays a critical notification: "Crosswind Limit Exceeded" — the aircraft's maximum demonstrated crosswind is 15 kt. |
| **Runway Change** | Changes to Runway 33 (more aligned with the wind). | "I'll ask ATC for Runway 33 instead." | The system recalculates the wind components. The crosswind drops to ~5 kt. The critical notification clears. |

**Outcome:** The pilot avoids a potential loss-of-control situation during the takeoff roll by discovering that the crosswind exceeds the aircraft's structural limits, and resolves it by selecting a more favorable runway.

<!-- @UJ-E-003@ (FROM: @REQ-PF-010@, @REQ-PF-011@, @REQ-PF-012@) -->
## <a name="UJ-E-003"></a>UJ-E-003: Deep Winter Departure

**Persona:** Pilot

**Context:** A pilot preparing a Tecnam P2008JC for departure from a frozen runway at 2,000 ft elevation in deep winter at -30°C. The AFM's lowest valid temperature is -25°C.

**Goal:** Wants to feel safe departing in extreme cold without the system underestimating takeoff distances based on optimistic extrapolation.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Temperature Entry** | Enters -30°C as the outside temperature. | "The air is super dense. We should lift off in no time — at least in theory." | The system detects the temperature is below the AFM limit and calculates performance with a safety floor. |
| **Result Review** | Reviews the calculated takeoff distance. | "The distance isn't as short as I expected. The system seems to be holding back." | The system displays a distance that is no lower than the AFM value at -25°C for the given weight and altitude. The result is flagged as extrapolated. The system requires explicit acknowledgment. |

**Outcome:** The pilot departs safely with realistic expectations. The system prevents aggressive mathematical optimization below mapped limits by flooring the result at the best documented AFM value.

<!-- @UJ-E-004@ (FROM: @REQ-AD-017@, @REQ-WX-009@) -->
## <a name="UJ-E-004"></a>UJ-E-004: Wind Limit Classification (Demonstrated vs. Limit)

**Persona:** Fleet Admin / Pilot

**Context:** A flying club operates two SEP aircraft — a Tecnam P2008JC with demonstrated (advisory) wind values and a Diamond DA40 with hard POH wind limits. A gusty day tests both configurations.

**Goal:** Wants to understand the difference between an advisory wind warning and a hard wind limit, and to make the right Go/No-Go decision for each aircraft.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Profile Setup** | The fleet admin enters the Tecnam P2008JC wind limits: maximum demonstrated crosswind 15 kt (classified `Demonstrated`) and maximum demonstrated total wind 25 kt (classified `Demonstrated`). | "These are the demonstrated values from the POH — advisory, not hard limits." | The system stores the wind limits with their `Demonstrated` classification. |
| **Headwind Warning** | A pilot plans a departure with a 26 kt headwind (aligned with the runway). | "Strong headwind, but it's right down the runway. Should be fine." | The system fires a WARNING: "Wind Limit Exceeded (Demonstrated)" — total wind (26 kt) exceeds the 25 kt demonstrated maximum. The pilot notes the advisory but, exercising PIC authority, decides to proceed. |
| **Crosswind Warning** | The wind shifts. The pilot updates to 20 kt crosswind. | "The wind turned. Let me recalculate with a crosswind component." | The system fires a WARNING: "Wind Limit Exceeded (Demonstrated)" — the 20 kt crosswind exceeds the 15 kt demonstrated maximum. |
| **Aircraft Switch** | The pilot switches to the Diamond DA40, which has a hard POH crosswind `Limit` of 20 kt and a hard total wind `Limit` of 35 kt. The METAR shows 320° at 30 kt, runway heading 230°. | "Let me see how the DA40 handles this wind." | The system calculates the crosswind component (~23 kt). A CRITICAL notification fires: "Wind Limit Exceeded" — the crosswind exceeds the 20 kt hard limit. |
| **Limit Recognition** | The pilot sees the CRITICAL notification and selects a different runway. | "This is a hard limit, not just advisory. I need a different runway for the DA40." | The pilot selects a runway more aligned with the wind. The crosswind drops below 20 kt. The CRITICAL notification clears. |

**Outcome:** The pilot experiences the full spectrum of wind limit notifications in a single session. `Demonstrated` limits produce an advisory WARNING — the pilot may proceed at their discretion. Hard `Limit` values produce a CRITICAL notification — these represent structural or regulatory boundaries that should not be exceeded.
