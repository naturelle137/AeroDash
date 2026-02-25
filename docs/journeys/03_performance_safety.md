# User Journeys - Phase C: Performance & Safety (Edge Cases)

Focus: Testing limits, extrapolation, and overrides.

---

<!-- @UJ-C-001@ (FROM: @REQ-PF-010@, @REQ-PF-012@, @REQ-PF-015@, @REQ-PF-006@) -->
## <a name="UJ-C-001"></a>UJ-C-001: Hot & High + Controlled Extrapolation

**Persona:** Pilot

**Context:** A pilot is preparing a Tecnam P2008JC for departure from Luxor (HELX) during a severe summer heatwave, and later calculating for a high-altitude mountain lake departure.

**Goal:** Verify handling of "Edge of Envelope" conditions and controlled extrapolation with safety penalties.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Heat Envelope** | Inputs 54°C (4°C above the 50°C AFM max). | "It's roasting out here. Is it safe to take off?" | System calculates performance by extrapolating slightly beyond the mapped table and applies a +20% Safety Penalty. |
| **Review Extrapolation** | Verify calculation flagged "Extrapolated". | "The app noticed we're off the standard charts." | System displays a prominent UI warning: Performance is extrapolated. |
| **Temperature Breach** | Pilot inputs 57°C. | "What if we wait until the afternoon peak?" | System completely blocks the calculation, rendering a red "Out of Operational Envelope" error. |
| **Altitude Breach** | Attempts takeoff calculation at 11,100ft (11% above the 10,000ft AFM max altitude limit). | "This lake is high up, let's see if the app guesses." | System strictly blocks the calculation and renders an error. |

**Outcome:** The pilot avoids taking an uncalculated risk in hot/high conditions, receiving a highly conservative estimate and strict hard blocks for extremely unsafe temperatures and altitudes.

<!-- @UJ-C-002@ (FROM: @REQ-AP-003@, @REQ-AP-006@, @REQ-PF-008@, @REQ-PF-009@) -->
## <a name="UJ-C-002"></a>UJ-C-002: The "Unknown Airfield" (Manual Override)

**Persona:** Pilot

**Context:** Flying into an unregistered private grass strip to visit family.

**Goal:** Verify PIC authority for data outside system DB and appropriate warning flags.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Search DB** | Search ICAO "ZZZZ" -> Not found. | "Not surprised this farm strip isn't in the global database." | Airport search returns "No matching airports found." |
| **Manual Override** | Manually enter TORA and runway heading. | "I know the strip is exactly 600m long." | System accepts the manual override entry. |
| **Obstacle Setup** | Define custom obstacle (Tree) at the end of the runway. | "There's that 50ft tree near the fence." | System plots the calculation graph including the artificial obstacle constraint. |
| **Verification Flag** | Verify results flagged "Unverified Data". | "Makes sense. It's relying entirely on my own inputs." | Calculation succeeds but overlays an "Unverified Profile Data" warning to ensure the pilot knows they bear sole responsibility. |

**Outcome:** The pilot maintains full command authority to calculate performance off-grid, whilst the system maintains a clear division between validated database information and user-injected assumptions.
