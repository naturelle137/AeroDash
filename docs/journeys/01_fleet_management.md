# User Journeys - Phase A: Fleet Management & Setup

Focus: Creating, validating, and managing aircraft profiles.

---

<!-- @UJ-A-001@ (FROM: @REQ-AC-001@, @REQ-AC-005@, @REQ-AD-005@, @REQ-AD-012@, @REQ-AD-014@, @REQ-UQ-005@) -->
## <a name="UJ-A-001"></a>UJ-A-001: The "Fleet Admin" Workflow (Complex Profile)

**Persona:** Fleet Admin / Owner

**Context:** The admin of a flying club needs to set up a Beechcraft Bonanza A36 — an aircraft with a complex CG envelope (forward limit varies from 74" at 3100 lbs to 80" at 3600 lbs) and a fuel moment lookup table (Volume/Weight to Moment as printed in the POH). They have the Pilot Operating Handbook open at the loading and envelope pages.

**Goal:** Wants to feel confident that every aircraft in the fleet is set up exactly like the book, and that no pilot can accidentally use an incomplete profile.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Profile Creation** | Initiates the creation of a new aircraft profile for a Bonanza A36. | "I have the POH here, let's get this new bird into the system." | A new, empty profile appears. The system identifies it as `Draft` (not yet verified for flight use). |
| **Envelope Entry** | Enters the CG envelope polygon points from the POH (e.g., forward limit 74" at 3100 lbs, 80" at 3600 lbs, and the corresponding aft limits). | "This envelope isn't a simple box — the forward limit shifts with weight. I'll enter each vertex exactly as it's drawn in the POH." | The system stores the envelope as a polygon definition with multiple coordinate points. The active unit (`in`, `lbs`) is displayed adjacent to each input field. |
| **Fuel Moment Table** | Enters the fuel loading station and selects the variable moment lookup table mode. Enters the POH rows mapping fuel volume/weight to moment (e.g., 40 gal → 300 lbs·in/100, 74 gal → 555 lbs·in/100). | "The POH gives me a table for fuel moment, not a simple arm. I'll enter it row by row." | The system stores the fuel station as a variable lookup table (Volume/Weight vs. Moment) in the original manufacturer's unit. |
| **Safety Gate** | Attempts to use the `Draft` profile to perform a flight calculation. | "Let me see if it's ready for a quick flight plan." | The system displays a persistent warning: `"Draft Profile Active"`. The calculation is flagged as using unverified profile data. |
| **Approval** | Reviews all entered data against the POH, then marks the profile as `Verified`. | "Double-checked every number against the POH — envelope, moments, MTOM. They match." | The profile status changes to `Verified`. The system locks all core data fields (MTOM, envelope, fuel table), making them read-only. |
| **Lock Enforcement** | Attempts to modify the locked MTOM value. | "Wait, was it really 3600 lbs? …Yes, it was." | The system prevents the edit. The profile remains read-only because it is in the `Verified` state. |

**Outcome:** The admin feels assured the Bonanza A36 is set up exactly per the POH — including its non-linear CG envelope and fuel moment table. The `Draft`/`Verified` status system and the locked fields guarantee that no pilot ever plans a flight against unverified data.

<!-- @UJ-A-002@ (FROM: @REQ-SYS-003@, @REQ-SYS-004@, @REQ-UQ-005@) -->
## <a name="UJ-A-002"></a>UJ-A-002: Unit-Safety Across a Mixed Fleet

**Persona:** Pilot

**Context:** A pilot who usually flies a Cessna 172 (Imperial) is taking out a Piper PA-28 (Metric) today. The two aircraft use fundamentally different measurement systems.

**Goal:** Wants to avoid a dangerous unit mix-up when switching between aircraft, and to feel certain that every number on screen is in the right system.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Metric Aircraft** | Selects the PA-28 profile and enters a bag mass of `15`. | "Okay, bag is 15 kilos. Easy." | The system displays the active unit `kg` adjacent to the mass field and `L` adjacent to all fuel fields. The entered value is shown as `15 kg`. |
| **Aircraft Switch** | Switches to the Cessna 172 profile. | "Actually, let's take the Cessna today." | The system reloads the profile. All displayed units update to the Cessna's native Imperial system (`lbs`, `gal`). |
| **Unit Awareness** | Notices that every field now displays `lbs` and `gal` as the active unit. | "Good — I can see right away that we're in pounds now. No guessing." | Every numerical input and output field consistently displays the active unit adjacent to it. |
| **Fuel Entry** | Enters `50` into the fuel field. | "50 gallons should be plenty for this flight." | The system accepts `50` as `gal` (the active unit for the loaded profile) and normalizes it internally to SI for calculation. The fuel field displays the value with `gal` adjacent. |
| **Result Review** | Reviews the calculated Mass & Balance results. | "Let me see the final weight and CG." | The system presents all results in the aircraft's native unit system. The active unit is displayed adjacent to every output value. No internal SI values are exposed to the user. |

**Outcome:** The pilot notices the unit labels change the moment aircraft are switched, feels confident every value is correctly labelled, and never needs to perform a manual conversion. The system handles all SI normalization internally and transparently.
