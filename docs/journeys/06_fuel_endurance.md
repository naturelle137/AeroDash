# User Journeys - Phase F: Fuel & Endurance

Focus: Fuel management, endurance calculations, and complex mass & balance interactions.

---

<!-- @UJ-F-001@ (FROM: @REQ-FE-002@, @REQ-FE-003@, @REQ-FE-005@) -->
## <a name="UJ-F-001"></a>UJ-F-001: The "Long Haul" (Endurance Check)

**Goal:** Verify fuel endurance logic and reserve calculations.

* **Actor:** Pilot
* **Scenario:**
    1. User enters usable fuel quantity (e.g., 40 USG).
    2. User enters planned fuel flow (e.g., 10 USG/h).
    3. System calculates Endurance (4.0h).
    4. User plans a flight of 3h 45m.
    5. Verify: **Warning** "Insufficient Fuel" (Reserves violated).
    6. User reduces flight time to 3h 00m -> Warning clears.

<!-- @UJ-F-002@ (FROM: @REQ-FE-001@, @REQ-MB-002@) -->
## <a name="UJ-F-002"></a>UJ-F-002: Fuel Type Density Mix-up

**Goal:** Verify correct mass calculation based on fuel type density.

* **Actor:** Pilot
* **Scenario:**
    1. User selects Fuel Type "AvGas" (0.72 kg/L).
    2. User enters 100 Liters -> Mass = 72 kg.
    3. User changes Fuel Type to "Jet A-1" (0.84 kg/L).
    4. Verify: Mass updates to 84 kg automatically.
    5. Verify: CG position shifts according to new mass.
