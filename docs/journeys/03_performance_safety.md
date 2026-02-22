# User Journeys - Phase C: Performance & Safety (Edge Cases)

Focus: Testing limits, extrapolation, and overrides.

---

<!-- @UJ-C-001@ (FROM: @REQ-PF-010@, @REQ-PF-012@, @REQ-PF-015@, @REQ-PF-006@) -->
## <a name="UJ-C-001"></a>UJ-C-001: Hot & High + Controlled Extrapolation

**Goal:** Verify handling of "Edge of Envelope" conditions.

* **Actor:** Pilot
* **Scenario:**
    1. Enter conditions slightly above POH limits.
    2. Verify calculation flagged "Extrapolated".
    3. Verify +20% Safety Penalty added.
    4. Enter conditions far above limits -> Calculation blocked.
* **Traceability:**
  * **Requirements:** [REQ-PF-010](../requirements/performance.md#REQ-PF-010), [REQ-PF-012](../requirements/performance.md#REQ-PF-012), [REQ-PF-015](../requirements/performance.md#REQ-PF-015), [REQ-PF-006](../requirements/performance.md#REQ-PF-006)

<!-- @UJ-C-002@ (FROM: @REQ-AP-003@, @REQ-AP-006@, @REQ-PF-008@, @REQ-PF-009@) -->
## <a name="UJ-C-002"></a>UJ-C-002: The "Unknown Airfield" (Manual Override)

**Goal:** Verify PIC authority for data outside system DB.

* **Actor:** Pilot
* **Scenario:**
    1. Search ICAO "ZZZZ" -> Not found.
    2. Manually enter TORA.
    3. Define custom obstacle (Tree).
    4. Verify results flagged "Unverified Data".
* **Traceability:**
  * **Requirements:** [REQ-AP-003](../requirements/airport_database.md#REQ-AP-003), [REQ-AP-006](../requirements/airport_database.md#REQ-AP-006), [REQ-PF-008](../requirements/performance.md#REQ-PF-008), [REQ-PF-009](../requirements/performance.md#REQ-PF-009)
