# User Journeys - Phase C: Performance & Safety (Edge Cases)

Focus: Behaviour at the limits of the performance envelope — extrapolation, overrides, and unknown airfields.

---

<!-- @UJ-C-001@ (FROM: @REQ-PF-010@, @REQ-PF-012@) -->

## <a name="UJ-C-001"></a>UJ-C-001: Hot & High + Controlled Extrapolation

**Persona:** Pilot

**Context:** A pilot is preparing a Tecnam P2008JC for departure from Luxor (HELX) during a severe summer heatwave, and later calculating for a high-altitude mountain lake departure.

**Goal:** Wants to know if the aircraft can safely take off in extreme heat or at high altitude — even when conditions go beyond the POH charts.

**Journey:**

| Phase                       | User Action                                                                    | Thoughts / Feelings                                                                | Observable System Reaction                                                                                                                                                                 |
| :-------------------------- | :----------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Heat Envelope**           | Enters a temperature of 54°C (4°C above the 50°C AFM maximum).                 | "It's roasting out here. Is it even safe to take off?"                             | The system extrapolates performance slightly beyond the mapped table and applies a +20% safety penalty. The result is flagged as extrapolated.                                             |
| **Extrapolation Awareness** | Notices the extrapolation flag on the result.                                  | "The app noticed we're off the standard charts. At least it's being conservative." | The system displays a prominent warning indicating that performance data is extrapolated beyond the AFM limits. The system requires explicit acknowledgment before the result can be used. |
| **Temperature Breach**      | Enters 57°C (exceeding the 10% extrapolation limit).                           | "What if we wait until the afternoon peak?"                                        | The system blocks the calculation entirely and displays an error: conditions exceed the maximum extrapolation boundary.                                                                    |
| **Altitude Breach**         | Enters a pressure altitude of 11,100 ft (11% above the 10,000 ft AFM maximum). | "This lake is high up. Let's see if the numbers work."                             | The system blocks the calculation and displays an error: altitude exceeds the maximum extrapolation boundary.                                                                              |

**Outcome:** The pilot avoids taking an uncalculated risk in extreme conditions. Within the 10% extrapolation band, the system provides a highly conservative estimate with a penalty and requires acknowledgment. Beyond that, it refuses to calculate entirely.

<!-- @UJ-C-002@ (FROM: @REQ-AP-003@, @REQ-AP-004@, @REQ-AP-006@, @REQ-PF-008@, @REQ-PF-009@) -->

## <a name="UJ-C-002"></a>UJ-C-002: The "Unknown Airfield" (Manual Override)

**Persona:** Pilot

**Context:** Flying into an unregistered private grass strip to visit family.

**Goal:** Wants to plan a safe arrival at an unlisted private strip using personal knowledge of the runway.

**Journey:**

| Phase                   | User Action                                                         | Thoughts / Feelings                                                               | Observable System Reaction                                                                                                                 |
| :---------------------- | :------------------------------------------------------------------ | :-------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **Airport Search**      | Enters ICAO code "ZZZZ" into the airport search.                    | "Not surprised this farm strip isn't in the global database."                     | The system returns no matching airport. The system switches to manual entry mode.                                                          |
| **Manual Entry**        | Enters the runway length (TORA) and heading manually.               | "I know the strip is exactly 600m long."                                          | The system accepts the manual entry and uses the values for performance calculation.                                                       |
| **Obstacle Definition** | Defines a custom obstacle — a 50ft tree near the end of the runway. | "There's that big oak near the fence line."                                       | The system includes the obstacle constraint in the performance calculation. A persistent warning is displayed: "Unverified Obstacle Data." |
| **Awareness**           | Notices the "Unverified" flag on the results.                       | "Makes sense. It's relying entirely on my own inputs. I bear the responsibility." | The calculation produces results but the system overlays a warning indicating the data is pilot-provided and unverified.                   |

**Outcome:** The pilot maintains full PIC authority to calculate performance for unlisted airfields, while the system clearly communicates that the results depend on unverified, pilot-provided data.

<!-- @UJ-C-003@ (FROM: @REQ-PF-005@, @REQ-PF-017@) -->

## <a name="UJ-C-003"></a>UJ-C-003: Estimation Transparency (Missing Distance Type)

**Persona:** Pilot

**Context:** A pilot is calculating takeoff performance for an older aircraft whose POH only provides Takeoff Roll (TOR) distances — no 50ft obstacle clearance (Takeoff Distance) data is published.

**Goal:** Wants to get a usable takeoff distance figure even when the POH doesn't provide one, and wants to understand the origin and reliability of the number.

**Journey:**

| Phase             | User Action                                                                                  | Thoughts / Feelings                                                                                                                                                                                                | Observable System Reaction                                                                                                                                                           |
| :---------------- | :------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setup**         | Selects the aircraft profile and enters the flight conditions (mass, altitude, temperature). | "Let's see the takeoff distance for this short runway."                                                                                                                                                            | The system calculates the Takeoff Roll from the POH data via interpolation.                                                                                                          |
| **Result Review** | Reviews the calculated Takeoff Distance.                                                     | "There's a distance figure, but it has a flag on it. What does that mean?"                                                                                                                                         | The system displays the Takeoff Distance, derived from the Takeoff Roll using the CAA SSL 07 conversion ($TOD = TOR \times 1.9$). The result is flagged as "ESTIMATED (CAA SSL 07)." |
| **Understanding** | Reads the estimation flag.                                                                   | "So the POH only gives me a roll distance, and the system is using a standard industry factor to estimate the obstacle clearance distance. That's conservative but generic — not tested for my specific airframe." | The "ESTIMATED" flag is clearly visible, distinguishing this value from POH-backed calculations.                                                                                     |
| **Export**        | Generates a PDF briefing pack.                                                               | "Let me print this for my kneeboard."                                                                                                                                                                              | The exported PDF carries the "ESTIMATED (CAA SSL 07)" flag on the derived distance value, ensuring the paper copy reflects the same data provenance the pilot saw on screen.         |

**Outcome:** The pilot receives a usable — but clearly flagged — takeoff distance even when the POH lacks the data. The "ESTIMATED" flag ensures full transparency: the pilot knows the obstacle clearance distance is a conservative generic factor ($\times 1.9$), not a certified airframe-specific value.
