# User Journeys - Phase F: Fuel & Endurance

Focus: Fuel management, endurance calculations, and complex mass & balance interactions.

---

<!-- @UJ-F-001@ (FROM: @REQ-FE-002@, @REQ-FE-003@, @REQ-FE-005@) -->
## <a name="UJ-F-001"></a>UJ-F-001: The "Long Haul" (Endurance Check)

**Persona:** Pilot

**Context:** Planning a long cross-country flight, maxing out the range capabilities of the aircraft.

**Goal:** Verify fuel endurance logic and reserve calculations against flight time.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Fuel Entry** | User enters usable fuel quantity (e.g., 40 USG). | "Topping off the tanks." | App accepts the fuel quantity. |
| **Consumption Setup** | User enters planned fuel flow (e.g., 10 USG/h). | "Cruise power setting today." | System calculates maximum Endurance (4.0h). |
| **Flight Time Setup** | User plans a flight of 3h 45m. | "It'll be a long leg, but we should make it." | System compares planned flight time (+ statutory reserves) against calculated Endurance. |
| **Violation Alert** | Verify system warning. | "Wait, that's cutting it close." | App displays a prominent **Warning**: "Insufficient Fuel" (due to breaking minimum reserves). |
| **Adjustment** | User reduces flight time input to 3h 00m (adding a fuel stop). | "Okay, I'll plan a stop halfway to be safe." | Warning clears, the calculation is marked as Safe. |

**Outcome:** The pilot avoids taking off on a flight path where unpredictable headwinds could drain their mandatory 30/45-minute VFR/IFR reserves, guided by the system’s firm mathematical boundary check.

<!-- @UJ-F-002@ (FROM: @REQ-AD-003@, @REQ-FE-001@, @REQ-MB-002@) -->
## <a name="UJ-F-002"></a>UJ-F-002: Fuel Type Density Mix-up

**Persona:** Pilot / Fleet Operator

**Context:** A club pilot initially plans to take the gasoline-powered (MoGas) Diamond DA40, but discovers it's booked. They switch their reservation to the identical-looking, but diesel-powered Diamond DA40 D.

**Goal:** Verify correct mass calculation based on differing fuel type densities configured per airframe fuel tank limits.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **MoGas Aircraft** | User selects the Diamond DA40 profile and navigates to the fuel section. | "Let's plan for the DA40 today." | App loads the profile. The fuel tank allows only "MoGas" or "AvGas". |
| **Volume Entry** | User enters 100 Liters of MoGas. | "Filling the mains." | Calculation outputs Fuel Mass = 72 kg (Density: 0.72 kg/L). |
| **Aircraft Switch** | User realizes the Diamond DA40 is booked and switches the active profile to the Diamond DA40 D. | "Ah, I'll have to take the diesel model instead." | App loads the new TDI profile. The fuel tank configuration now strictly enforces "Jet A-1" or "Diesel". |
| **Mass Comparison** | User enters the same 100 Liters of volume into the Diesel profile. | "Same 100 liters, let's see." | Mass calculates as 84 kg (Density: 0.84 kg/L). |
| **CG Consequence** | User checks the Envelope Chart. | "That's 12kg heavier just from the fuel type." | The Envelope Chart dynamically updates the CG plot. The point moves higher on the mass axis and shifts along the longitudinal axis, visually showing the reduced margin to the MTOW. |

**Outcome:** The pilot is physically prevented from selecting an incompatible fuel type for the airframe, and automatically avoids a latent Mass & Balance error (taking off 12kg heavier than expected) because the system dynamically couples the required fuel volumes to the specific chemical density configured for that aircraft's tanks.
