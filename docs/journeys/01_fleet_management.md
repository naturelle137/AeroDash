# User Journeys - Phase A: Fleet Management & Setup

Focus: Creating, validating, and managing aircraft profiles.

---

<!-- @UJ-A-001@ (FROM: @REQ-AC-001@, @REQ-AC-005@, @REQ-AD-012@, @REQ-AD-014@) -->
## <a name="UJ-A-001"></a>UJ-A-001: The "Fleet Admin" Workflow (Complex Profile)

**Goal:** Verify that complex aircraft data (variable arms, original units) can be modeled, verified, and locked.

* **Actor:** Fleet Admin / Owner
* **Scenario:**
    1. User creates a new aircraft (e.g., DA40).
    2. User enters MTOM in `lbs` and Fuel Arms as a `Variable Table`.
    3. User attempts to use the profile -> System warns "Draft Profile".
    4. User marks profile as "Verified".
    5. User tries to edit MTOM -> System blocks.

<!-- @UJ-A-002@ (FROM: @REQ-SYS-003@, @REQ-SYS-004@, @REQ-UQ-005@) -->
## <a name="UJ-A-002"></a>UJ-A-002: Unit-Safety Check (Mixed Fleet)

**Goal:** Verify strict enforcement of input labeling and SI normalization.

* **Actor:** Pilot
* **Scenario:**
    1. Load an aircraft defined in `kg`/`Liters`. Enter weights.
    2. Switch to an aircraft defined in `lbs`/`Gal`.
    3. Verify labels switch to `lbs`/`Gal`.
    4. Enter "50" into Fuel. Verify calculation treats it as Gallons.
