# User Journeys - Phase D: System & Usability

Focus: UI resilience and environmental factors.

---

## <a name="UJ-D-001"></a>UJ-D-001: Cockpit Usability & Stress Test

**Goal:** Verify UI resilience against errors and night ops.

* **Actor:** Pilot (Night Flight)
* **Scenario:**
    1. Activate "Dark Mode".
    2. Enter "800" QNH (Typo). Verify Warning but allow override.
    3. Disconnect Internet. Verify Offline Mode.
    4. Generate "Digital Briefing Pack" (PDF). Verify Unverified Data flag.
* **Traceability:**
  * **Requirements:** [REQ-UI-011](../requirements/user_interface.md#REQ-UI-011), [REQ-UI-008](../requirements/user_interface.md#REQ-UI-008), [REQ-SYS-001](../requirements/system.md#REQ-SYS-001), [REQ-PF-013](../requirements/performance.md#REQ-PF-013), [REQ-DOC-001](../requirements/documentation_export.md#REQ-DOC-001), [REQ-DOC-002](../requirements/documentation_export.md#REQ-DOC-002)
