# User Journeys - Phase G: Onboarding & Sync

Focus: Cloud synchronization, collaboration, and offline resilience.

---

## <a name="UJ-G-001"></a>UJ-G-001: New Club Member Onboarding
**Goal:** Verify cloud sync and profile sharing workflows.
* **Actor:** Student Pilot (New User)
* **Scenario:**
    1.  User logs in via OIDC (e.g., Google).
    2.  User receives a "Share-Code" for the club aircraft (e.g., `DA40-CLUB-123`).
    3.  User enters code -> Aircraft Profile imports to "Personal Workspace".
    4.  User cannot edit the Core Data (Read-Only) but can edit Pilot Mass.
* **Traceability:**
    * **Requirements:** [REQ-SC-001](../requirements/cloud_sync_collaboration.md#REQ-SC-001), [REQ-SC-004](../requirements/cloud_sync_collaboration.md#REQ-SC-004), [REQ-SC-006](../requirements/cloud_sync_collaboration.md#REQ-SC-006)

## <a name="UJ-G-002"></a>UJ-G-002: The "Offline" Fallback
**Goal:** Verify system functionality without internet access.
* **Actor:** Pilot (in flight)
* **Scenario:**
    1.  User puts device in Airplane Mode.
    2.  User opens AeroDash.
    3.  Verify: All previously synced aircraft are available.
    4.  User performs a calculation.
    5.  Verify: Calculation succeeds without server request.
* **Traceability:**
    * **Requirements:** [REQ-SYS-001](../requirements/system.md#REQ-SYS-001), [REQ-SC-002](../requirements/cloud_sync_collaboration.md#REQ-SC-002)
