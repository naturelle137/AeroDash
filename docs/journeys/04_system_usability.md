# User Journeys - Phase D: System & Usability

Focus: UI resilience and environmental factors.

---

<!-- @UJ-D-001@ (FROM: @REQ-UI-011@, @REQ-UI-008@, @REQ-SYS-001@, @REQ-PF-013@, @REQ-DOC-001@, @REQ-DOC-002@, @REQ-DOC-003@, @REQ-DOC-005@) -->
## <a name="UJ-D-001"></a>UJ-D-001: Cockpit Usability & Stress Test

**Persona:** Pilot (Night Flight)

**Context:** Setting up for a late-night cross-country flight while sitting in a dark cockpit with spotty cellular reception, using an airfield profile downloaded earlier from the external database but not verified against the AIP. The destination airfield elevation is listed as 1,250 ft.

**Goal:** Wants to plan a flight confidently from a dark cockpit with unreliable connectivity, and to feel certain that the printed briefing pack clearly flags any data the pilot hasn't personally verified.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Cockpit Prep** | Activates "Dark Mode." | "Don't want to ruin my night vision with a bright white screen." | The application switches to a high-contrast dark theme. |
| **QNH Entry** | Enters the current QNH of 1008 hPa. | "ATIS said 1008. Let me punch that in." | The system accepts the QNH value and displays the calculated Pressure Altitude for the destination airfield (e.g., 1,250 ft + (1013.25 − 1008) × 30 ≈ 1,408 ft). |
| **QNH Typo** | Accidentally clears the field and enters "800" hPa. | "Oops, wrong number. But let me see what happens." | The system displays a warning: "Input Out of Range." The system still allows the entry after the pilot confirms the value. The Pressure Altitude updates accordingly. |
| **Connection Drop** | Loses cellular signal on the apron. | "Cell service is dead out here. Hopefully the app still works." | The application continues to function fully, using locally stored profiles and airfield data. |
| **Briefing Generation** | Generates a "Digital Briefing Pack" (PDF) for the flight. | "Let me save this to my kneeboard before takeoff." | The system generates the PDF export. |
| **Export Review** | Reviews the generated PDF. Notices the destination airport parameters are marked. | "Ah, I never manually verified the auto-downloaded destination airfield." | The PDF displays the destination airport parameters with an `[UNVERIFIED]` marker and includes a disclaimer about unverified external data. |
| **Notification in Export** | Scrolls through the PDF and notices safety warnings rendered inline. | "The warnings I saw on screen are right here in the document too. Good — if I hand this to an examiner, they'll see the same picture I did." | The PDF renders all active WARNING and CRITICAL notifications within the relevant sections of the document (e.g., the "Draft Profile Active" warning appears at the beginning of the Aircraft section). |

**Outcome:** The pilot comfortably uses the application under adverse conditions — dark cockpit, no connectivity. Typos are caught but pilot authority is preserved. The PA calculation gives the pilot situational awareness about the actual performance environment. The exported PDF clearly flags any externally-sourced data that the pilot hasn't personally verified, and renders all active safety notifications so the paper copy is self-contained.

<!-- @UJ-D-002@ (FROM: @REQ-AP-005@, @REQ-UI-014@, @REQ-UI-015@, @REQ-UI-016@) -->
## <a name="UJ-D-002"></a>UJ-D-002: Unverified Data Verification Flow

**Persona:** Pilot

**Context:** A pilot is preparing a flight to a destination whose airport data was auto-downloaded from the external aviation database. All retrieved parameters (TORA, LDA, elevation, runway heading) are initially flagged as unverified.

**Goal:** Wants to systematically verify the auto-downloaded airport data against the official AIP before generating a final briefing, and to understand why the system insists on verification.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Initial State** | Opens the destination airport data. | "Let me review the auto-downloaded data for my destination." | All auto-populated airport parameters display an `[UNVERIFIED]` marker. The system indicates the data source is external and requires pilot verification. |
| **Manual Cross-Check** | Opens the official AIP and compares the TORA value. Marks the TORA field as verified. | "The AIP says TORA is 1,200 m. The system has 1,200 m. That's correct." | The `[UNVERIFIED]` marker on the TORA field clears. The field is now marked as verified. |
| **Batch Verification** | After individually verifying two more fields, uses "Mark All as Verified" for the remaining parameters. | "I've cross-checked the critical ones. The rest look correct too — let me batch-verify them." | All remaining `[UNVERIFIED]` markers clear. All airport parameters are now verified. |
| **Export Attempt** | Generates a PDF briefing pack. | "Now let me print this for real." | The system generates the export without any `[UNVERIFIED]` markers on the destination airport. No unverified data warning or export block appears. |

**Outcome:** The pilot actively takes responsibility for the accuracy of externally-sourced data. The verification workflow ensures that auto-downloaded values are never silently trusted — the pilot must either verify individually or batch-accept the data before the system treats it as reliable.
