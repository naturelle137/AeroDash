# User Journeys - Phase G: Onboarding & Sync

Focus: Cloud synchronization, collaboration, and offline resilience.

---

<!-- @UJ-G-001@ (FROM: @REQ-SC-001@, @REQ-SC-003@, @REQ-SC-004@) -->
## <a name="UJ-G-001"></a>UJ-G-001: New Club Member Onboarding (Organization Sync)

**Persona:** Student Pilot (New User)

**Context:** A student pilot has just joined a flying club and needs access to the club’s trainer aircraft profiles for flight planning.

**Goal:** Verify organization-based role-assignment and automatic read-only sync without manual profile sharing.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Authentication** | User logs in via OIDC (Google/Apple) for the first time. | "Just creating my account." | System provisions a new user profile with a default Personal Workspace. |
| **Club Invite** | The Club Admin adds the user's email to the "AeroClub" Organization with the "Member" role. | "The admin said I was added to the system." | System links the user to the Organization Workspace. |
| **Automatic Sync** | User opens the app and switches context to the "AeroClub" workspace. | "Let's find the trainer." | System automatically synchronizes all club aircraft profiles down to the user's device. |
| **Data Integrity Check** | User attempts to edit the empty weight of the club's Cessna 152. | "I wonder if I can change this..." | System blocks the action. The profile is strictly Read-Only based on the "Member" role (`REQ-SC-004`). |
| **Personal Use** | User creates a new Flight Plan using the club aircraft and edits their own "Pilot Mass". | "I'll enter my own weight for balancing." | System allows local data entry for the flight plan without altering the club's shared template. |

**Outcome:** The student seamlessly inherits access to perfectly calibrated, read-only aircraft profiles simply by being added to the club's organization, preventing accidental data corruption.

<!-- @UJ-G-002@ (FROM: @REQ-SC-005@, @REQ-SC-006@) -->
## <a name="UJ-G-002"></a>UJ-G-002: Ad-Hoc Aircraft Sharing (Share-Code)

**Persona:** Independent Aircraft Owner

**Context:** An owner of a Cessna 172 wants to share their highly customized performance profile with a friend who occasionally rents the same tiedown.

**Goal:** Verify secure, peer-to-peer profile transfer using cryptographic share codes.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Code Generation** | Owner selects their Cessna profile in their Personal Workspace and clicks "Share". | "I'll just send him the config." | System generates a short, unique Crockford's Base32 Share-Code (e.g., `7B9N-Q2X4`) and uploads a snapshot to the cloud. |
| **Transmission** | Owner texts the code `7B9N-Q2X4` to their friend. | "Sent." | - |
| **Import Workflow** | Friend enters `7B9N-Q2X4` into the "Import" dialog in their app. | "Let's load up his plane." | System validates the Base32 code, fetches the profile snapshot, and clones it into the friend's Personal Workspace. |
| **Independence** | Friend edits the empty weight in their imported copy. | "I'll update the weight based on the latest W&B sheet he sent me." | System saves the change locally. Because it is a cloned copy, the original owner's profile remains completely unaffected. |

**Outcome:** Two independent pilots efficiently share complex aircraft data without needing to create a formal organization, using robust Crockford's Base32 codes to maintain complete independence of their personal databases.

<!-- @UJ-G-003@ (FROM: @REQ-SYS-001@, @REQ-SC-002@) -->
## <a name="UJ-G-003"></a>UJ-G-003: The "Offline" Fallback

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
