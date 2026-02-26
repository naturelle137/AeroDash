# User Journeys - Phase F: Fuel & Endurance

Focus: Fuel management, endurance calculations, and fuel type interactions.

---

<!-- @UJ-F-001@ (FROM: @REQ-FE-002@, @REQ-FE-003@, @REQ-FE-005@) -->
## <a name="UJ-F-001"></a>UJ-F-001: The "Long Haul" (Endurance Check)

**Persona:** Pilot

**Context:** Planning a long cross-country flight, pushing the range capabilities of the aircraft.

**Goal:** Wants to be certain there is enough fuel for the planned trip, including the required reserves, before committing to a long leg without a fuel stop.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Fuel Entry** | Enters the usable fuel quantity (e.g., 40 USG). | "Topping off the tanks." | The system accepts the fuel quantity. |
| **Consumption Setup** | Enters the planned fuel flow rate (e.g., 10 USG/h). | "Cruise power setting today." | The system calculates and displays the maximum Endurance (4.0 h). |
| **Flight Time Entry** | Enters a planned flight time of 3 h 45 m. | "It'll be a long leg, but we should make it." | The system compares the planned flight time (including reserves) against the calculated maximum endurance. |
| **Fuel Warning** | Notices a warning notification. | (Concern): "Wait, that's cutting it too close." | The system displays a warning: "Insufficient Fuel" — the planned flight time including reserves exceeds the available endurance. |
| **Adjustment** | Reduces the planned flight time to 3 h 00 m (adding a fuel stop en route). | "Okay, I'll plan a stop halfway to be safe." | The warning clears. The planned flight time including reserves is now within the available endurance. |

**Outcome:** The pilot avoids departing on a flight where unexpected headwinds or diversions could drain the required fuel reserves, guided by the system's endurance calculation.

<!-- @UJ-F-002@ (FROM: @REQ-AD-003@, @REQ-FE-001@, @REQ-FE-004@, @REQ-MB-002@) -->
## <a name="UJ-F-002"></a>UJ-F-002: Fuel Type Density Mix-up

**Persona:** Pilot / Fleet Operator

**Context:** A club pilot initially plans to take the gasoline-powered (MoGas) Diamond DA40, but discovers it's booked. They switch to the identical-looking but diesel-powered Diamond DA40 D.

**Goal:** Wants to avoid a hidden weight error when switching between aircraft with different fuel types.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Original Aircraft** | Selects the Diamond DA40 profile and opens the fuel section. | "Let's plan for the DA40 today." | The system loads the profile. The fuel section displays the permitted fuel types for this aircraft: "MoGas" or "AvGas." |
| **Volume Entry** | Enters 100 Liters of MoGas. | "Filling the mains." | The system calculates and displays: Fuel Mass = 72 kg (using a density of 0.72 kg/L). |
| **Aircraft Switch** | Realizes the DA40 is booked. Switches to the Diamond DA40 D profile. | "Ah, I'll have to take the diesel model instead." | The system loads the new profile. The fuel section now displays the permitted fuel types: "Jet A-1" or "Diesel." |
| **Mass Comparison** | Enters the same 100 Liters into the Diesel profile. | "Same 100 liters — let's see the difference." | The system calculates and displays: Fuel Mass = 84 kg (using a density of 0.84 kg/L). |
| **CG Consequence** | Reviews the Envelope Chart. | "That's 12 kg heavier just from the fuel type. Good thing I noticed." | The Envelope Chart updates. The CG point moves higher on the mass axis, visually showing the reduced margin to the MTOM. |

**Outcome:** The pilot avoids a latent 12 kg mass error by noticing the density difference between fuel types. The system enforces fuel type restrictions per aircraft profile, preventing an incompatible fuel selection.
