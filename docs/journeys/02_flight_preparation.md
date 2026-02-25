# User Journeys - Phase B: Flight Preparation

Focus: Standard operational workflows for Mass & Balance and Hybrid Performance.

---

<!-- @UJ-B-001@ (FROM: @REQ-MB-008@, @REQ-MB-011@, @REQ-MB-004@, @REQ-UI-010@) -->
## <a name="UJ-B-001"></a>UJ-B-001: M&B with CG Migration (The "Burn-Out" Check)

**Goal:** Verify detection of unsafe CG shifts during flight.

* **Actor:** Pilot
* **Scenario:**
    1. Load aircraft with heavy aft baggage.
    2. Takeoff CG -> **Green**.
    3. Landing CG (Zero Fuel) -> **Red** (Outside Aft Limit).
    4. Verify Envelope Chart shows vector crossing the limit.

<!-- @UJ-B-002@ (FROM: @REQ-PF-003@, @REQ-PF-004@, @REQ-PF-016@) -->
## <a name="UJ-B-002"></a>UJ-B-002: The "Hybrid Engine" Performance Calculation

**Goal:** Verify hierarchical fallback logic (POH priority -> FSM 3/75 fallback).

* **Actor:** Pilot
* **Scenario:**
    1. Select P2008 (POH table available).
    2. Input PA/Temp -> Interpolate Base Distance.
    3. Select "Wet Grass" -> Apply FSM 3/75 factors.
    4. Verify factors applied only to Ground Roll.
    5. Override Safety Factor to 1.0 -> System warns.
