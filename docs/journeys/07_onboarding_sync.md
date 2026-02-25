# User Journeys - Phase G: Onboarding & Sync

Focus: Cloud synchronization, collaboration, and offline resilience.

---

<!-- @UJ-G-001@ (FROM: @REQ-SC-001@, @REQ-SC-004@, @REQ-SC-006@) -->
## <a name="UJ-G-001"></a>UJ-G-001: New Club Member Onboarding

**Persona:** Student Pilot (New User)

**Context:** A student pilot has just joined the aero club and needs the precise performance configuration for the club’s trainer.

**Goal:** Verify cloud sync and secure profile sharing workflows without data corruption risks.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Authentication** | User logs in via OIDC (Google/Apple). | "Just creating my account." | System provisions a new user profile. |
| **Receiving Profile** | User receives a "Share-Code" for the club aircraft (e.g., `DA40-CLUB-123`). | "The CFI gave me this code." | - |
| **Import Workflow** | User enters code into the "Import" dialog. | "Let's load up the trainer." | Aircraft Profile is fetched and imported into the user's "Personal Workspace". |
| **Data Integrity Check** | User attempts to edit the empty weight of the imported profile. | "I wonder if I can change this..." | System blocks the action immediately. The Core Data remains Read-Only to preserve the club's trusted baseline. |
| **Personal Use** | User edits their own "Pilot Mass" in the profile. | "I'll enter my own weight for balancing." | System allows local override of non-core data, saving the user's mass without affecting the club's shared template. |

**Outcome:** The student rapidly accesses a complex, perfectly calibrated aircraft profile, while the Club Administrator is mathematically guaranteed that the student cannot accidentally break the baseline data for the rest of the fleet.

<!-- @UJ-G-002@ (FROM: @REQ-SYS-001@, @REQ-SC-002@) -->
## <a name="UJ-G-002"></a>UJ-G-002: The "Offline" Fallback

**Persona:** Pilot (In Flight / Remote Strip)

**Context:** A pilot lands at a remote farm strip with zero cellular reception and needs to calculate their departure performance.

**Goal:** Verify system functionality and data availability without internet access.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Disconnect** | User puts device in Airplane Mode or loses signal. | "No bars out here. Hopefully the app still works." | System transitions silently into "Offline Mode". |
| **App Launch** | User opens AeroDash. | "Need my aircraft profiles." | Verified profiles are pulled from local storage constraints seamlessly. |
| **Verification** | Verify all previously synced aircraft are visible. | "Phew, all my planes are here." | Local cache successfully provides read access. |
| **Calculation** | User performs a takeoff performance calculation entering manual weather parameters. | "Let's enter the temperature manually since I can't pull the METAR." | System uses local mathematical models to crunch the numbers. |
| **Success** | Verify the calculation succeeds. | "Got my numbers. Ready for departure." | Calculation completes perfectly without generating any server-side dependencies or timeout errors. |

**Outcome:** The pilot maintains total operational independence and safety at remote airstrips, unburdened by cloud-connectivity requirements for critical math functions.
