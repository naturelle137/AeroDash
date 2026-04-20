# User Journeys - Phase A: Fleet Management & Setup

Focus: Creating, validating, and managing aircraft profiles.

---

<!-- @UJ-A-001@ (FROM: @REQ-AC-001@, @REQ-AC-005@, @REQ-AD-005@, @REQ-AD-012@, @REQ-AD-014@, @REQ-UQ-005@) -->

## <a name="UJ-A-001"></a>UJ-A-001: The "Fleet Admin" Workflow (Complex Profile)

**Persona:** Fleet Admin / Owner

**Context:** The admin of a flying club needs to set up a Beechcraft Bonanza A36 — an aircraft with a complex CG envelope (forward limit varies from 74" at 3100 lbs to 80" at 3600 lbs) and a fuel moment lookup table (Volume/Weight to Moment as printed in the POH). They have the Pilot Operating Handbook open at the loading and envelope pages.

**Goal:** Wants to feel confident that every aircraft in the fleet is set up exactly like the book, and that no pilot can accidentally use an incomplete profile.

**Journey:**

| Phase                 | User Action                                                                                                                                                                                           | Thoughts / Feelings                                                                                                                 | Observable System Reaction                                                                                                                                       |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile Creation**  | Initiates the creation of a new aircraft profile for a Bonanza A36.                                                                                                                                   | "I have the POH here, let's get this new bird into the system."                                                                     | A new, empty profile appears. The system identifies it as `Draft` (not yet verified for flight use).                                                             |
| **Envelope Entry**    | Enters the CG envelope polygon points from the POH (e.g., forward limit 74" at 3100 lbs, 80" at 3600 lbs, and the corresponding aft limits).                                                          | "This envelope isn't a simple box — the forward limit shifts with weight. I'll enter each vertex exactly as it's drawn in the POH." | The system stores the envelope as a polygon definition with multiple coordinate points. The active unit (`in`, `lbs`) is displayed adjacent to each input field. |
| **Fuel Moment Table** | Enters the fuel loading station and selects the variable moment lookup table mode. Enters the POH rows mapping fuel volume/weight to moment (e.g., 40 gal → 300 lbs·in/100, 74 gal → 555 lbs·in/100). | "The POH gives me a table for fuel moment, not a simple arm. I'll enter it row by row."                                             | The system stores the fuel station as a variable lookup table (Volume/Weight vs. Moment) in the original manufacturer's unit.                                    |
| **Safety Gate**       | Attempts to use the `Draft` profile to perform a flight calculation.                                                                                                                                  | "Let me see if it's ready for a quick flight plan."                                                                                 | The system displays a persistent warning: `"Draft Profile Active"`. The calculation is flagged as using unverified profile data.                                 |
| **Approval**          | Reviews all entered data against the POH, then marks the profile as `Verified`.                                                                                                                       | "Double-checked every number against the POH — envelope, moments, MTOM. They match."                                                | The profile status changes to `Verified`. The system locks all core data fields (MTOM, envelope, fuel table), making them read-only.                             |
| **Lock Enforcement**  | Attempts to modify the locked MTOM value.                                                                                                                                                             | "Wait, was it really 3600 lbs? …Yes, it was."                                                                                       | The system prevents the edit. The profile remains read-only because it is in the `Verified` state.                                                               |

**Outcome:** The admin feels assured the Bonanza A36 is set up exactly per the POH — including its non-linear CG envelope and fuel moment table. The `Draft`/`Verified` status system and the locked fields guarantee that no pilot ever plans a flight against unverified data.

<!-- @UJ-A-002@ (FROM: @REQ-SYS-003@, @REQ-SYS-004@, @REQ-UQ-005@) -->

## <a name="UJ-A-002"></a>UJ-A-002: Unit-Safety Across a Mixed Fleet

**Persona:** Pilot

**Context:** A pilot who usually flies a Cessna 172 (Imperial) is taking out a Piper PA-28 (Metric) today. The two aircraft use fundamentally different measurement systems.

**Goal:** Wants to avoid a dangerous unit mix-up when switching between aircraft, and to feel certain that every number on screen is in the right system.

**Journey:**

| Phase               | User Action                                                               | Thoughts / Feelings                                                  | Observable System Reaction                                                                                                                                                           |
| :------------------ | :------------------------------------------------------------------------ | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Metric Aircraft** | Selects the PA-28 profile and enters a bag mass of `15`.                  | "Okay, bag is 15 kilos. Easy."                                       | The system displays the active unit `kg` adjacent to the mass field and `L` adjacent to all fuel fields. The entered value is shown as `15 kg`.                                      |
| **Aircraft Switch** | Switches to the Cessna 172 profile.                                       | "Actually, let's take the Cessna today."                             | The system reloads the profile. All displayed units update to the Cessna's native Imperial system (`lbs`, `gal`).                                                                    |
| **Unit Awareness**  | Notices that every field now displays `lbs` and `gal` as the active unit. | "Good — I can see right away that we're in pounds now. No guessing." | Every numerical input and output field consistently displays the active unit adjacent to it.                                                                                         |
| **Fuel Entry**      | Enters `50` into the fuel field.                                          | "50 gallons should be plenty for this flight."                       | The system accepts `50` as `gal` (the active unit for the loaded profile) and normalizes it internally to SI for calculation. The fuel field displays the value with `gal` adjacent. |
| **Result Review**   | Reviews the calculated Mass & Balance results.                            | "Let me see the final weight and CG."                                | The system presents all results in the aircraft's native unit system. The active unit is displayed adjacent to every output value. No internal SI values are exposed to the user.    |

**Outcome:** The pilot notices the unit labels change the moment aircraft are switched, feels confident every value is correctly labelled, and never needs to perform a manual conversion. The system handles all SI normalization internally and transparently.

<!-- @UJ-A-003@ (FROM: @REQ-AD-011@, @REQ-MB-001@, @REQ-UI-009@) -->

## <a name="UJ-A-003"></a>UJ-A-003: Certification Category Switch

**Persona:** Pilot

**Context:** A pilot is preparing a Klemm KL 107B for an aerobatic training flight. The aircraft is certified in both "Normal" and "Utility" categories, each with different MTOM limits and CG envelopes.

**Goal:** Wants to understand how switching categories affects the loading limits, and to feel confident that the system enforces the correct rules for the selected category.

**Journey:**

| Phase                  | User Action                                                                                                                                | Thoughts / Feelings                                                               | Observable System Reaction                                                                                                                                                                      |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Normal Category**    | Loads the Klemm 107B profile and begins entering the load for a dual flight with instructor in the rear seat. Category is set to "Normal." | "Let me plan this as a normal flight first."                                      | The system displays the Normal category MTOM and CG envelope. All four loading stations (front, rear, baggage, fuel) are available.                                                             |
| **Category Switch**    | Switches the certification category from "Normal" to "Utility."                                                                            | "Today is aerobatics — I need to be in Utility category."                         | The system dynamically updates the MTOM, the CG envelope polygon tightens, and the rear seat loading station is no longer available. The CG Envelope Chart redraws with the Utility boundaries. |
| **Load Impact**        | Notices the rear seat station has disappeared from the loading screen.                                                                     | "Right — no passengers in the back for Utility. It's just me and fuel."           | The system has removed the rear seat station from the available inputs. The existing rear seat weight is zeroed out. The total mass and CG recalculate automatically.                           |
| **Envelope Awareness** | Reviews the updated CG Envelope Chart.                                                                                                     | "The Utility envelope is much tighter. Let me make sure my fuel load still fits." | The system displays the recalculated CG point within the tighter Utility envelope. The pilot can see the difference between the Normal and Utility boundaries.                                  |

**Outcome:** The pilot understands that switching certification category fundamentally changes the aircraft's operational limits. The system enforces category-specific rules automatically — different MTOM, different envelope, and restricted loading stations — preventing the pilot from accidentally planning an aerobatic flight with Normal-category limits.

<!-- @UJ-A-004@ (FROM: @REQ-AD-020@, @REQ-AD-021@, @REQ-AD-022@, @REQ-UI-021@, @REQ-UI-022@, @REQ-FE-006@) -->

## <a name="UJ-A-004"></a>UJ-A-004: Adding a Battery-Electric Aircraft (Pipistrel Velis Electro)

**Persona:** Pilot / Flight-School Instructor

**Context:** A flying school has just bought a Pipistrel Velis Electro (ICAO `PIVE`) for ab-initio training. The instructor wants to add it to AeroDash alongside the school's Tecnam P2008 JC and Klemm KL 107B. The Velis has no fuel tanks and no engine oil — it has a 24.8 kWh battery pack with a 20% reserve floor and is recharged between sorties.

**Goal:** Set up the Velis profile in minutes, without being asked to enter fuel types, burn sequences, or any other combustion concept that does not apply to a battery aircraft.

**Journey:**

| Phase                    | User Action                                                                                                      | Thoughts / Feelings                                              | Observable System Reaction                                                                                                                                                                                                                           |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile Creation**     | Opens the aircraft wizard at `/fleet/new`.                                                                       | "Let's get the Velis in. Hope I don't have to fake a fuel tank." | The wizard opens on step 1 (Identity). A `Powertrain` selector is visible with options `Combustion` (active) and `Electric`.                                                                                                                         |
| **Model Selection**      | Selects `Pipistrel` → `Velis Electro` from the manufacturer / model dropdown.                                    | "Good, it's in the catalogue."                                   | The system auto-fills ICAO `PIVE` and flips the Powertrain selector to `Electric`. A small helper note under the selector states "Selected model is battery-electric — fuel fields are hidden."                                                      |
| **Envelope & Weighing**  | Enters the POH CG envelope polygon and basic empty mass (including the battery pack as fixed BEM).               | "Battery mass is just part of the empty weight. That's fine."    | The system accepts the envelope and weighing report exactly as it does for combustion aircraft — no special treatment at this layer.                                                                                                                 |
| **Load Stations**        | Adds the pilot and passenger load stations.                                                                      | "No fuel tank to add, which is exactly what I want."             | The Load Stations step shows only the standard name / arm / limit / unit controls. The `+ Add Fuel Tank` button is absent. The per-station "This station is a fuel tank" toggle is absent. A short note explains that fuel tanks are not applicable. |
| **Battery Pack**         | Enters usable energy `24.8 kWh`, reserve floor `5.0 kWh`, optional nominal voltage `345 V`, chemistry `LiFePO4`. | "The POH numbers map 1:1. No more pretending."                   | A dedicated Battery Pack step appears between Load Stations and Review — visible only because the powertrain is `Electric`. Inline validation rejects reserve ≥ usable energy.                                                                       |
| **Review & Save**        | Reviews the summary page and saves as Draft.                                                                     | "Looks right. No fuel fields, battery numbers are there."        | The review shows `Powertrain: Electric` and the battery pack nameplate. On save the profile is persisted with `powertrain: 'electric'` and `batteryPack: {…}`. No fuel tank fields are present in the saved document.                                |
| **Mass & Balance Use**   | Switches to the Velis profile and opens Mass & Balance.                                                          | "Let me see if the view adapts."                                 | The "Fuel & Endurance" card is titled `Energy & Endurance`. No fuel type selector, no burn-sequence picker, no fuel-mass CG migration chart is shown.                                                                                                |
| **Combustion Untouched** | Switches back to the school's P2008 JC profile.                                                                  | "And the combustion aircraft should still look the same."        | The P2008 profile shows the fuel-tank toggle, the `+ Add Fuel Tank` button, and the classic Fuel & Endurance card — unchanged from before electric support shipped.                                                                                  |

**Outcome:** The instructor adds the Velis Electro without encountering a single combustion-only concept. The system represents the aircraft on its own terms: battery pack, reserve floor, energy-based endurance. Combustion profiles behave identically to before — no regression, no mixed UI. The shoehorn defect called out in issue #225 is gone.
