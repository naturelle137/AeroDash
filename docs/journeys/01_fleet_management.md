# User Journeys - Phase A: Fleet Management & Setup

Focus: Creating, validating, and managing aircraft profiles.

---

<!-- @UJ-A-001@ (FROM: @REQ-AC-001@, @REQ-AC-005@, @REQ-AD-012@, @REQ-AD-014@) -->
## <a name="UJ-A-001"></a>UJ-A-001: The "Fleet Admin" Workflow (Complex Profile)

**Persona:** Fleet Admin / Owner

**Context:** The admin of a flying club needs to set up a new Diamond DA40 aircraft with complex variable arms and different units.

**Goal:** Verify that complex aircraft data (variable arms, original units) can be modeled, verified, and locked.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Profile Creation** | User creates a new aircraft (e.g., DA40). | "I have the POH here, let's get this new bird into the system." | System creates an empty profile and defaults to Draft mode. |
| **Data Entry** | User enters MTOM in `lbs` and Fuel Arms as a `Variable Table`. | "These arms change based on fuel quantity, let's enter the table exactly as it is in the POH." | System parses the table and normalizes inputs to SI units internally. |
| **Validation Block** | User attempts to use the profile for a flight. | "Let's see if it works." | System warns "Draft Profile - Not Approved for Flight" and blocks calculation. |
| **Verification** | User marks profile as "Verified". | "Double-checked the numbers. They match. Good to go." | System locks the core data fields. |
| **Lock Enforcement** | User tries to edit MTOM. | "Wait, was it 2646 lbs?" | System blocks the edit because the profile is locked and verified. |

**Outcome:** The DA40 is safely added with complex configuration data, and the strict Draft/Verified states ensure no pilot uses half-finished data for actual flight planning.

<!-- @UJ-A-002@ (FROM: @REQ-SYS-003@, @REQ-SYS-004@, @REQ-UQ-005@) -->
## <a name="UJ-A-002"></a>UJ-A-002: Unit-Safety Check (Mixed Fleet)

**Persona:** Pilot

**Context:** A pilot who usually flies a Cessna 172 (Imperial) is taking out a Piper PA-28 (Metric) today.

**Goal:** Verify strict enforcement of input labeling and SI normalization to prevent dangerous unit mix-ups.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Metric Aircraft** | Load an aircraft defined in `kg`/`Liters`. Enter weights. | "Okay, bag is 15 kilos. Entered." | Application displays all mass fields in `kg` and fuel in `Liters`. |
| **Aircraft Switch** | Switch to an aircraft defined in `lbs`/`Gal`. | "Actually, let's take the Cessna today." | Application reloads profile. |
| **Label Verification** | Verify labels switch to `lbs`/`Gal`. | "Good, the labels changed. Need to remember we're in pounds now." | System updates all UI labels to match the aircraft's native unit configuration. |
| **Input Parsing** | Enter "50" into Fuel. | "50 gallons should be plenty." | Calculation clearly treats "50" as Gallons, automatically normalizing to SI for internal CG math without the user needing to manually convert. |

**Outcome:** The pilot easily switches between aircraft with different measurement systems without mathematical errors, relying on the system to visually enforce the active unit and handle backend conversions.
