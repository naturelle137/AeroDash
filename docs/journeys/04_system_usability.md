# User Journeys - Phase D: System & Usability

Focus: UI resilience and environmental factors.

---

<!-- @UJ-D-001@ (FROM: @REQ-UI-011@, @REQ-UI-008@, @REQ-SYS-001@, @REQ-PF-013@, @REQ-DOC-001@, @REQ-DOC-002@, @REQ-DOC-003@, @REQ-DOC-005@) -->

## <a name="UJ-D-001"></a>UJ-D-001: Cockpit Usability & Stress Test

**Persona:** Pilot (Night Flight)

**Context:** Setting up for a late-night cross-country flight while sitting in a dark cockpit with spotty cellular reception, using an airfield profile downloaded earlier from the external database but not verified against the AIP. The destination airfield elevation is listed as 1,250 ft.

**Goal:** Wants to plan a flight confidently from a dark cockpit with unreliable connectivity, and to feel certain that the printed briefing pack clearly flags any data the pilot hasn't personally verified.

**Journey:**

| Phase                      | User Action                                                                       | Thoughts / Feelings                                                                                                                          | Observable System Reaction                                                                                                                                                                              |
| :------------------------- | :-------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cockpit Prep**           | Activates "Dark Mode."                                                            | "Don't want to ruin my night vision with a bright white screen."                                                                             | The application switches to a high-contrast dark theme.                                                                                                                                                 |
| **QNH Entry**              | Enters the current QNH of 1008 hPa.                                               | "ATIS said 1008. Let me punch that in."                                                                                                      | The system accepts the QNH value and displays the calculated Pressure Altitude for the destination airfield (e.g., 1,250 ft + (1013.25 − 1008) × 30 ≈ 1,408 ft).                                        |
| **QNH Typo**               | Accidentally clears the field and enters "800" hPa.                               | "Oops, wrong number. But let me see what happens."                                                                                           | The system displays a warning: "Input Out of Range." The system still allows the entry after the pilot confirms the value. The Pressure Altitude updates accordingly.                                   |
| **Connection Drop**        | Loses cellular signal on the apron.                                               | "Cell service is dead out here. Hopefully the app still works."                                                                              | The application continues to function fully, using locally stored profiles and airfield data.                                                                                                           |
| **Briefing Generation**    | Generates a "Digital Briefing Pack" (PDF) for the flight.                         | "Let me save this to my kneeboard before takeoff."                                                                                           | The system generates the PDF export.                                                                                                                                                                    |
| **Export Review**          | Reviews the generated PDF. Notices the destination airport parameters are marked. | "Ah, I never manually verified the auto-downloaded destination airfield."                                                                    | The PDF displays the destination airport parameters with an `[UNVERIFIED]` marker and includes a disclaimer about unverified external data.                                                             |
| **Notification in Export** | Scrolls through the PDF and notices safety warnings rendered inline.              | "The warnings I saw on screen are right here in the document too. Good — if I hand this to an examiner, they'll see the same picture I did." | The PDF renders all active WARNING and CRITICAL notifications within the relevant sections of the document (e.g., the "Draft Profile Active" warning appears at the beginning of the Aircraft section). |

**Outcome:** The pilot comfortably uses the application under adverse conditions — dark cockpit, no connectivity. Typos are caught but pilot authority is preserved. The PA calculation gives the pilot situational awareness about the actual performance environment. The exported PDF clearly flags any externally-sourced data that the pilot hasn't personally verified, and renders all active safety notifications so the paper copy is self-contained.

<!-- @UJ-D-002@ (FROM: @REQ-AP-005@, @REQ-UI-014@, @REQ-UI-015@, @REQ-UI-016@) -->

## <a name="UJ-D-002"></a>UJ-D-002: Unverified Data Verification Flow

**Persona:** Pilot

**Context:** A pilot is preparing a flight to a destination whose airport data was auto-downloaded from the external aviation database. All retrieved parameters (TORA, LDA, elevation, runway heading) are initially flagged as unverified.

**Goal:** Wants to systematically verify the auto-downloaded airport data against the official AIP before generating a final briefing, and to understand why the system insists on verification.

**Journey:**

| Phase                  | User Action                                                                                             | Thoughts / Feelings                                                                           | Observable System Reaction                                                                                                                                |
| :--------------------- | :------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Initial State**      | Opens the destination airport data.                                                                     | "Let me review the auto-downloaded data for my destination."                                  | All auto-populated airport parameters display an `[UNVERIFIED]` marker. The system indicates the data source is external and requires pilot verification. |
| **Manual Cross-Check** | Opens the official AIP and compares the TORA value. Marks the TORA field as verified.                   | "The AIP says TORA is 1,200 m. The system has 1,200 m. That's correct."                       | The `[UNVERIFIED]` marker on the TORA field clears. The field is now marked as verified.                                                                  |
| **Batch Verification** | After individually verifying two more fields, uses "Mark All as Verified" for the remaining parameters. | "I've cross-checked the critical ones. The rest look correct too — let me batch-verify them." | All remaining `[UNVERIFIED]` markers clear. All airport parameters are now verified.                                                                      |
| **Export Attempt**     | Generates a PDF briefing pack.                                                                          | "Now let me print this for real."                                                             | The system generates the export without any `[UNVERIFIED]` markers on the destination airport. No unverified data warning or export block appears.        |

**Outcome:** The pilot actively takes responsibility for the accuracy of externally-sourced data. The verification workflow ensures that auto-downloaded values are never silently trusted — the pilot must either verify individually or batch-accept the data before the system treats it as reliable.

<!-- @UJ-D-003@ (FROM: @REQ-SYS-016@, @REQ-SYS-017@, @REQ-SYS-018@) -->

## <a name="UJ-D-003"></a>UJ-D-003: Reporting a Defect, Suggesting a Feature, or Raising a Security Concern

**Persona:** Pilot (non-developer)

**Context:** During flight prep, the pilot notices that the Mass & Balance view displays an unexpected CG value after switching aircraft profiles. Later, on a different session, the pilot has an idea for a feature: showing wind correction directly on the runway diagram. On a third session, the pilot suspects an input field accepts a value that could be used to bypass a safety warning.

**Goal:** Wants to share each finding with the AeroDash team without leaving the app cold-handed, without learning a structured bug-report format from scratch, and without putting potentially-sensitive vulnerability detail into a public issue.

**Journey:**

| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Enter hub** | Opens the contribution hub from the sidebar footer link "Help / contribute". | "Where do I send this? I've never used GitHub." | The `/contribute` view loads with three labelled buttons — *Report a defect*, *Request a feature*, *Report a security vulnerability* — each with a one-sentence description and an info tooltip. |
| **Pick category — defect** | Hovers the `(i)` tooltip on "Report a defect" to confirm it fits, then clicks the button. | "Yes — a wrong number shown by the app. That matches 'defect'." | The view replaces the three-button grid with the guided defect form. The first field, "Title", has the cursor. |
| **Fill the defect form** | Types a short title, fills in the description, reproduction steps, picks "Major" severity, leaves the safety hazard reference blank, and accepts the auto-detected environment string. | "It's basically asking me what happened and how to reproduce it. The environment is already filled in — nice." | Each required field reveals its inline help text above the input. The "Open GitHub to submit" button stays disabled until all required fields are filled. The "Advanced (optional)" disclosure conceals the rarely-needed hazard reference field. |
| **Hand off to GitHub** | Clicks "Open GitHub to submit ↗". | "Let's see what happens." | A new browser tab opens at GitHub's "new issue" page. The bug template is preselected. Title and all body fields are prefilled with what the pilot entered, under per-field headings. The pilot ticks the two GitHub confirmation checkboxes ("checked the backlog", "this is not a security report") and clicks **Submit**. |
| **Return to category — feature (later session)** | Returns to `/contribute`, hovers the tooltip on "Request a feature", clicks the button. | "Wind correction on the runway diagram would be useful." | The guided feature form replaces the category buttons. The DoD field pre-fills with "- [ ] " so the pilot just continues typing. |
| **Pick category — security (third session)** | Clicks "Report a security vulnerability". Reads the explanation. | "This shouldn't be public — good that the app says so." | The view replaces the category grid with a single card explaining that security reports are private, with a primary button "Open the private security form on GitHub ↗". No in-app input fields are shown. The pilot clicks the button and a new tab opens at GitHub's private advisory form. |
| **See contribution promotion** | Notices the "How else can you help?" panel below the buttons. | "Oh — I can also just report what worked badly, or fix a typo in the docs. That sounds doable." | The panel lists four ways to contribute and links to the public issue list and the GitHub repository, each opening in a new tab. |

**Outcome:** The pilot reports the defect with the existing GitHub bug template, prefilled and ready to submit. The feature suggestion lands in the correct GitHub template too. The suspected vulnerability goes through GitHub's private advisory workflow and never touches the public issue tracker. None of the three reports required learning a new format — the app translated plain-language prompts into the structured GitHub fields on handoff.
