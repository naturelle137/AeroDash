# User Journeys - Phase B: Flight Preparation

Focus: Standard operational workflows for Mass & Balance and Hybrid Performance.

---

<!-- @UJ-B-001@ (FROM: @REQ-MB-002@, @REQ-MB-008@, @REQ-MB-011@, @REQ-MB-004@, @REQ-UI-010@) -->
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

<!-- @UJ-B-002@ (FROM: @REQ-PF-003@, @REQ-PF-004@, @REQ-PF-006@, @REQ-PF-015@, @REQ-PF-016@, @REQ-UI-017@, @REQ-DOC-005@) -->
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
| **Safety Factor Temptation** | Reduces the Operational Safety Factor below 1.25 to gain margin. | "Maybe if I lower the safety factor just a bit, the runway fits." | The system displays a warning: "Safety Factor Low." The required distance drops below the runway length, but the warning remains active. |
| **Export Gate** | Attempts to export the briefing pack with the low safety factor still active. | "Let me save this and see what happens." | The system fires a CRITICAL notification: "Safety Factor Low" — a confirmation dialog forces the pilot to explicitly acknowledge that the safety factor is below the regulatory baseline before the export proceeds. The pilot confirms. |
| **PDF Review** | Reviews the exported PDF. | "There's a big warning stamp right on the Performance section." | The exported PDF renders the "Safety Factor Low" warning prominently within the Performance section, ensuring the paper copy carries the same safety information. |
| **Final Decision** | Returns to the app, raises the safety factor back to 1.25, and reduces fuel instead. | "That warning on the PDF sealed it. I'll take less fuel to get the margin back properly." | The system recalculates in real time as the fuel load is reduced. The required distance drops below the available runway length. The warnings clear. |

**Outcome:** The pilot avoids guesswork for non-POH conditions. The system provides mathematically backed safety margins by combining POH data with standardized correction factors. The export gate and the warning rendered in the PDF reinforce that lowering the safety factor is a deliberate, documented act — not a silent shortcut.

<!-- @UJ-B-003@ (FROM: @REQ-MB-005@, @REQ-MB-009@) -->
## <a name="UJ-B-003"></a>UJ-B-003: The "Overweight" Discovery

**Persona:** Pilot

**Context:** Planning a weekend trip with four adults and heavy luggage in a Cessna 172. The aircraft has both a Maximum Takeoff Mass (MTOM) and a Maximum Zero Fuel Mass (MZFM) limit.

**Goal:** Wants to load the aircraft for a full weekend trip and feel confident that all structural mass limits are respected — not just the obvious ones.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Full Load** | Enters weights for four adults and heavy weekend luggage. | "We're all going — gear, food, camping stuff. Let's see if it fits." | The system calculates total mass. A critical notification appears: "MTOM Exceeded." |
| **First Fix** | Removes one bag from the aft compartment. | "Okay, we'll leave the heavy cooler behind. That should fix it." | The total mass drops below MTOM. The "MTOM Exceeded" notification clears. |
| **Fuel Entry** | Enters the planned fuel quantity. | "Good, we're under MTOM now. Let me add the fuel." | The system recalculates. MTOM is still within limits. |
| **Second Discovery** | Notices a new notification. | (Surprise): "Wait — what's MZFM? I didn't even know that was a thing." | The system displays a critical notification: "MZFM Exceeded." The zero-fuel mass (total mass minus fuel) exceeds the aircraft's Maximum Zero Fuel Mass — a structural wing-bending limit. |
| **Second Fix** | Removes additional weight from the aft compartment. | "I need to take even more stuff out. The wings can't handle all this weight without fuel." | The system recalculates. The ZFM drops below MZFM. The notification clears. Both MTOM and MZFM are now within limits. |

**Outcome:** The pilot learns that MTOM compliance alone is insufficient. The MZFM protects wing structural integrity (bending relief) and is often overlooked. The system surfaces both limits independently, preventing a dangerous configuration that would pass a simple "total weight" check.

<!-- @UJ-B-004@ (FROM: @REQ-FE-004@, @REQ-MB-008@, @REQ-MB-011@, @REQ-UI-010@, @REQ-UI-019@) -->
## <a name="UJ-B-004"></a>UJ-B-004: The "Burn-Down Polygon" (Multi-Tank CG Migration)

**Persona:** Pilot

**Context:** A pilot is preparing an aircraft with two fuel tanks at different lever arms — Tank A is forward of the CG (e.g., arm 0.8 m) and Tank B is aft of the CG (e.g., arm 3.2 m). The Standard burn sequence is "Tank B (aft) first, then Tank A (forward)," which is operationally preferred because draining the aft tank first moves the CG forward into a safe region. The Alternative sequence reverses the order in case of a fuel system failure. Both tanks hold 60 L each.

**Goal:** Wants to understand how the fuel burn order affects CG migration and to feel confident that the aircraft stays within the envelope under all plausible burn scenarios — including an in-flight failure that reverses the burn order.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Loading** | Loads the aircraft profile with a pilot, rear passenger, and aft baggage. Fills both tanks to 60 L each. | "Full tanks, two on board. Let's see the CG chart." | The system calculates the Takeoff CG and displays the point inside the envelope — close to the aft limit due to the heavy rear loading. |
| **Polygon Discovery** | Reviews the CG Envelope Chart. Notices it shows a shaded area instead of a single trend line. | "That's not a line — it's a polygon. What does that mean?" | The system renders a burn-down polygon (shaded area) connecting the CG paths for both the Standard and Alternative burn sequences. The Standard path (drain aft first) curves forward — safe. The Alternative path (drain forward first) curves aft — potentially dangerous. |
| **Boundary Alert** | Notices the Alternative path exits the aft envelope limit. | (Concern): "If the fuel system fails and I drain the forward tank first, the CG shifts aft — the heavy rear load plus the remaining aft fuel push the CG past the limit." | The system displays a critical notification: "CG Migration Limit Exceeded" — the Alternative burn sequence path exits the envelope as the forward tank empties and the aft fuel remains. |
| **Mitigation** | Moves the heavy passenger forward and reduces aft baggage. | "I'll move the heavier person to the front seat and leave one bag behind." | The system recalculates. The entire burn-down polygon — both Standard and Alternative paths — now fits inside the envelope. The critical notification clears. |
| **Confidence** | Reviews the final polygon. Both sequences are within limits. | "Now even the worst-case failure scenario stays inside the envelope. Safe to fly." | The CG Envelope Chart shows the burn-down polygon fully enclosed within the limits. All CG waypoints for both sequences are within bounds. |

**Outcome:** The pilot discovers that a simple single-line CG trend (Standard sequence only) would have shown a safe forward migration — hiding the danger of the Alternative path. When the forward tank drains first, the remaining aft fuel and heavy rear loading push the CG beyond the aft limit. The shaded polygon reveals the full range of risk, and the pilot mitigates it before engine start.

<!-- @UJ-B-005@ (FROM: @REQ-AP-002@, @REQ-FE-002@, @REQ-MB-003@, @REQ-UI-005@, @REQ-WX-002@, @REQ-WX-003@, @REQ-WX-008@) -->
## <a name="UJ-B-005"></a>UJ-B-005: The "Textbook" Flight Prep (Happy Path)

**Persona:** Pilot

**Context:** A sunny Saturday morning. A pilot is preparing a Tecnam P2008JC for a routine VFR cross-country flight from their home field (EDHE) to a familiar destination (EDXW). No weather concerns, no special conditions. Everything is verified and ready.

**Goal:** Wants to complete a clean, efficient flight preparation and leave with a printed briefing pack — no surprises, no warnings.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Aircraft** | Selects the Tecnam P2008JC from the recent aircraft list. | "Same bird as always. Let's go." | The system loads the verified profile. No warnings. |
| **Destination** | Selects "EDXW" from the recent airports list. | "We flew there last month. The data should already be in." | The system auto-populates the airport data (TORA, LDA, elevation, heading) from the database. All fields are marked `Verified`. The current METAR auto-populates wind, temperature, and QNH. The TAF shows VFR conditions throughout the planned arrival window. Weather metadata (source, observation time) is displayed beneath the weather fields. |
| **Loading** | Enters two passengers and a light weekend bag. | "Traveling light today." | The CG Envelope Chart updates live as each load is entered. The CG point stays comfortably in the center of the envelope. Total mass is well below MTOM. |
| **Fuel** | Enters 80 L of AvGas. | "Full mains. Should be plenty." | The endurance calculation shows ample fuel for the trip plus reserves. No warnings. The CG trend line shifts slightly but stays inside the envelope. |
| **Performance** | Reviews the takeoff and landing distances. | "Good margins. The runway is more than long enough." | Takeoff and landing distances are well within the available runway lengths. Safety factor is at 1.25. No notifications. |
| **Export** | Generates the briefing pack. | "All green. Let me print this and head to the hangar." | The PDF is generated cleanly. No warnings, no disclaimers beyond the standard data source note. |

**Outcome:** The pilot completes a textbook flight preparation in under five minutes. No warnings, no critical notifications — just a clean, methodical workflow that produces a reliable briefing pack. This is the standard flow for the majority of flights.
