# User Journeys - Phase B: Flight Preparation

Focus: Standard operational workflows for Mass & Balance and Hybrid Performance.

---

<!-- @UJ-B-001@ (FROM: @REQ-MB-008@, @REQ-MB-011@, @REQ-MB-004@, @REQ-UI-010@) -->
## <a name="UJ-B-001"></a>UJ-B-001: M&B with CG Migration (The "Burn-Out" Check)

**Persona:** Pilot

**Context:** Preparation for a weekend trip to the coast with heavy aft baggage.

**Goal:** Wants to feel certain that the aircraft remains stable and balanced not just at takeoff, but also after several hours of flight when the fuel tanks are nearly empty.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Loading** | Enters weights for two adult passengers in the rear and heavy weekend bags in the aft compartment. | "We're packed tight. I hope the balance holds up with all that gear in the back." | The system accepts the inputs and recalculates the Center of Gravity for the current loading state. |
| **Initial Review** | Reviews the CG Envelope Chart. | "We're heavy, but we're inside the safe zone for takeoff. Looks good." | The Takeoff CG is displayed as a point inside the envelope. |
| **The Discovery** | Notices the CG trend line connecting the Takeoff and Landing points. | (Anxiety): "Wait — as we burn fuel, the CG is moving backwards. It's going to cross the aft limit before we even land!" | The Envelope Chart displays a trend line showing the CG migrating aft as fuel is consumed. The Landing CG point falls outside the envelope boundary. The system displays a critical notification: "CG Migration Limit Exceeded." |
| **Mitigation** | Decides to redistribute the load — moves the heaviest bags forward. | "Glad I saw this now. I'll shift the water crates and the tool kit to the front seat." | The system recalculates in real time. The trend line and the Landing CG point move back inside the safe envelope. The critical notification clears. |
| **Confidence** | Saves the final configuration. | "Now I know exactly where everything needs to go. No stress at the hangar." | The system saves the configuration and displays the final summary showing both Takeoff and Landing CG within limits. |

**Outcome:** The pilot avoids a dangerous aft-CG situation during the landing phase by discovering a mid-flight CG migration during the planning stage, and resolves it by redistributing the load before leaving home.

<!-- @UJ-B-002@ (FROM: @REQ-PF-003@, @REQ-PF-004@, @REQ-PF-016@) -->
## <a name="UJ-B-002"></a>UJ-B-002: The "Hybrid Engine" Performance Calculation

**Persona:** Pilot

**Context:** A pilot is flying a Tecnam P2008JC from a familiar airfield to a new destination with a short runway and wet grass conditions.

**Goal:** Wants to feel safe departing a short, wet grass runway by getting reliable takeoff distance numbers — even for conditions the manufacturer's POH doesn't directly cover.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Setup** | Selects the aircraft and enters pressure altitude and temperature for the destination. | "Let's see the numbers for this trip. I want to be sure about the takeoff distance." | The system loads the aircraft profile and the associated performance data. |
| **Condition Entry** | Selects the current runway surface condition as "Wet Grass." | "It's been raining all day. The grass will be soaked." | The system calculates the base performance from the POH data and applies correction factors for the wet grass condition. |
| **Result Review** | Reviews the calculated takeoff and landing distances. | "The takeoff roll is tight but manageable. But the total takeoff distance is longer than the runway." | The system displays the results. The required distance exceeds the available runway length. The system displays a critical notification: "Runway Insufficient." |
| **Safety Factor Temptation** | Considers reducing the Operational Safety Factor to gain margin. | "I'm tempted to reduce the safety factor, but that feels risky." | The system displays a warning: "Safety Factor Low." |
| **Final Decision** | Decides to reduce fuel instead of lowering the safety factor. | "Too close for comfort. I'll take less fuel to get that margin back." | The system recalculates in real time as the fuel load is reduced. The required distance drops below the available runway length. The critical notification clears. |

**Outcome:** The pilot avoids guesswork for non-POH conditions. The system provides mathematically backed safety margins by combining POH data with standardized correction factors, leading to a conservative but informed Go/No-Go decision.
