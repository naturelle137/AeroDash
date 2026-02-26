# User Journeys - Phase G: Onboarding & Sync

Focus: Cloud synchronization, collaboration, and offline resilience.

---

<!-- @UJ-G-001@ (FROM: @REQ-SC-001@, @REQ-SC-002@, @REQ-SC-003@, @REQ-SC-004@) -->
## <a name="UJ-G-001"></a>UJ-G-001: New Club Member Onboarding (Organization Sync)

**Persona:** Student Pilot (New User)

**Context:** A student pilot has just joined a flying club and needs access to the club's trainer aircraft profiles for flight planning.

**Goal:** Wants to quickly access the club's aircraft profiles after joining, without needing to manually set up every aircraft.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Authentication** | Logs in for the first time using their identity provider (e.g., Google or Apple). | "Just creating my account." | The system provisions a new user profile with a default Personal Workspace. |
| **Club Invitation** | Receives a notification that the Club Admin has added them to the "AeroClub" Organization with the "Member" role. | "The admin said I was added to the system." | The system links the user to the Organization Workspace. |
| **Automatic Sync** | Switches to the "AeroClub" workspace. | "Let's find the trainer." | All club aircraft profiles are automatically visible on the user's device. |
| **Data Protection** | Attempts to edit the empty weight of the club's Cessna 152. | "I wonder if I can change this…" | The system blocks the edit. The profile is read-only based on the user's "Member" role. |
| **Personal Use** | Creates a new Flight Plan using the club aircraft and enters their own pilot mass. | "I'll enter my own weight for balancing." | The system allows the pilot to create their own flight plan using the club aircraft profile without altering the shared data. |

**Outcome:** The student seamlessly inherits access to calibrated, read-only aircraft profiles simply by being added to the club's organization. No manual profile setup, no risk of accidental data corruption.

<!-- @UJ-G-002@ (FROM: @REQ-SC-005@, @REQ-SC-006@) -->
## <a name="UJ-G-002"></a>UJ-G-002: Ad-Hoc Aircraft Sharing (Share-Code)

**Persona:** Independent Aircraft Owner

**Context:** An owner of a Cessna 172 wants to share their customized aircraft profile with a friend who occasionally rents the same tiedown.

**Goal:** Wants to share an aircraft setup with a friend without a complicated process or needing to create a formal organization.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Code Generation** | Selects their Cessna profile and initiates sharing. | "I'll just send him the config." | The system generates a short, unique Share-Code (e.g., `7B9N-Q2X4`). |
| **Transmission** | Sends the code to their friend via text message. | "Sent." | — |
| **Import** | The friend enters the Share-Code into the import dialog. | "Let's load up his plane." | The system retrieves the shared profile and creates a copy in the friend's Personal Workspace. |
| **Independence** | The friend edits the empty weight in their imported copy. | "I'll update the weight based on the latest W&B sheet." | The system saves the change locally. Because it is a cloned copy, the original owner's profile remains unaffected. |

**Outcome:** Two independent pilots efficiently share complex aircraft data using a simple alphanumeric code, without needing a formal organization. Each pilot maintains full independence over their own copy.

<!-- @UJ-G-003@ (FROM: @REQ-SYS-001@) -->
## <a name="UJ-G-003"></a>UJ-G-003: The "Offline" Fallback

**Persona:** Pilot (In Flight / Remote Strip)

**Context:** A pilot lands at a remote farm strip with zero cellular reception and needs to calculate their departure performance.

**Goal:** Wants to plan a departure from a remote strip even with no cellular signal, using profiles and data already on the device.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Signal Loss** | Loses cellular signal (or enables Airplane Mode). | "No bars out here. Hopefully the app still works." | The system transitions silently into offline mode. |
| **App Launch** | Opens the application to access their aircraft profiles. | "Need my aircraft data for the departure calculation." | All previously synced aircraft profiles are available from local storage. |
| **Manual Weather** | Enters weather parameters manually (no METAR available). | "I'll enter the temperature and wind by hand since I can't pull the METAR." | The system accepts manual weather input and proceeds with the calculation using local performance models. |
| **Calculation** | Initiates a takeoff performance calculation. | "Let's see if the strip is long enough." | The calculation completes successfully using locally stored data. No server dependencies, no timeout errors. |

**Outcome:** The pilot maintains total operational independence at remote airstrips, unburdened by cloud-connectivity requirements for critical calculations. All synced profiles and performance models remain fully functional offline.
