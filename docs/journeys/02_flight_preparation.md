# User Journeys - Phase B: Flight Preparation

Focus: Standard operational workflows for Mass & Balance and Hybrid Performance.

---

<!-- @UJ-B-001@ (FROM: @REQ-MB-008@, @REQ-MB-011@, @REQ-MB-004@, @REQ-UI-010@) -->
## <a name="UJ-B-001"></a>UJ-B-001: M&B with CG Migration (The "Burn-Out" Check)

**Persona:** Pilot

**Context:** Preparation for a weekend trip to the coast with heavy aft baggage.

**Goal:** The pilot wants to ensure that the aircraft remains stable and within safety limits not just at takeoff, but also after several hours of flight when the fuel tanks are nearly empty (the "Burn-Out" scenario).

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Loading** | Enters weights for two adult passengers in the rear and heavy weekend bags in the aft compartment. | "We’re packed tight. I hope the balance holds up with all that gear in the back." | App accepts inputs and calculates the Center of Gravity (CG) for the current state. |
| **Initial Check** | Reviews the Weight & Balance Envelope Chart. | "Green light for takeoff. We're heavy, but we're legal. Looks good." | Takeoff Plot is shown as a green dot inside the safe zone. |
| **The Discovery** | Examines the "Fuel Burn" migration line (the vector from Takeoff to Landing). | (Anxiety): "Wait—as we burn fuel, the point is moving backwards. We're going to cross the line before we even land!" | Envelope Chart displays a vector showing the CG shifting aft as fuel is consumed, ending in the Red Zone. |
| **Mitigation** | Decides to move the heaviest bags to the forward floor or asks a passenger to sit up front. | "Glad I saw this now. I'll just shift the water crates and the heavy tool kit to the front seat." | App updates the vector in real-time. The entire "migration path" stays within the green limits. |
| **Confidence** | Saves the configuration and prepares to head to the airfield. | "Now I know exactly where everything needs to go. No stress at the hangar." | Generates a final summary showing a safe "Landing CG" (Zero Fuel Weight). |

**Outcome:** The pilot avoids a dangerous "out-of-trim" situation during the landing phase by identifying a mid-flight CG shift during the planning stage.

<!-- @UJ-B-002@ (FROM: @REQ-PF-003@, @REQ-PF-004@, @REQ-PF-016@) -->
## <a name="UJ-B-002"></a>UJ-B-002: The "Hybrid Engine" Performance Calculation

**Persona:** Pilot

**Context:** A pilot is flying a Tecnam P2008JC from a familiar airfield to a new destination with a short runway and wet grass conditions.

**Goal:** Calculate a safe takeoff and landing distances by combining official POH data with recognized safety factors (FSM 3/75) for conditions not covered by the manufacturer, ensuring safety on a challenging runway.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Setup** | Selects the aircraft "Tecnam P2008JC" and enters pressure altitude and temperature. | "Let's check the numbers for this trip. I want to be sure about the takeoff distance." | System loads the aircraft profile and retrieves the default performance data source (POH). |
| **Data Source Check** | Navigates to the "Performance" tab and examines the "Data Source" indicator. | "Hmm, it says 'POH'. That's good, I trust the manufacturer's numbers." | System displays "Data Source: POH" and shows the specific POH document version. |
| **Performance Input** | Enters the current Runway Condition (Wet Grass). | "It's a bit warm and the grass is wet. That'll affect the takeoff roll." | System calculates the "Base Performance" using the POH data and applies the "Wet Grass" correction factors. |
| **Review & Verify** | Reviews the calculated "Takeoff Distance". | "Okay, the takeoff roll is tight but acceptable for this runway but the total takeoff distance is longer than the runway length." | System displays the results with clear visual indicators. |
| **Safety Override** | Considers overriding the "Safety Factor" to 1.0 (minimum safety margin). | "I'm tempted to reduce the safety factor to get a better number, but that feels risky." | The system warns the user about a non-standard safety margin. |
| **Final Decision** | Rejects the override and accepts the calculated performance. | "Too close for comfort. I'll take less fuel to get that green margin back." | Real-time update: The distance shrinks as weight is reduced, bringing the calculation back into the "Safe" zone. |

**Outcome:** The pilot avoids "guesswork" for non-POH conditions. By using the hierarchical fallback logic, they obtain a mathematically backed safety margin that leads to a conservative, safe "No-Go" decision for the current wet conditions.
