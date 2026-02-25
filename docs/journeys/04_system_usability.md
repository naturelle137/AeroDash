# User Journeys - Phase D: System & Usability

Focus: UI resilience and environmental factors.

---

<!-- @UJ-D-001@ (FROM: @REQ-UI-011@, @REQ-UI-008@, @REQ-SYS-001@, @REQ-PF-013@, @REQ-DOC-001@, @REQ-DOC-002@) -->
## <a name="UJ-D-001"></a>UJ-D-001: Cockpit Usability & Stress Test

**Persona:** Pilot (Night Flight)

**Context:** Setting up for a late-night cross-country flight while sitting in a dark cockpit with spotty cellular reception, using an airfield profile downloaded earlier from the external database but not verified against the AIP.

**Goal:** Wants to plan a flight confidently from a dark cockpit with unreliable connectivity, and to feel certain that the printed briefing pack clearly flags any data the pilot hasn't personally verified.

* **Journey:**
| Phase | User Action | Thoughts / Feelings | Observable System Reaction |
| :--- | :--- | :--- | :--- |
| **Cockpit Prep** | Activates "Dark Mode." | "Don't want to ruin my night vision with a bright white screen." | The application switches to a high-contrast dark theme. |
| **Data Entry** | Enters "800" hPa as QNH (a typo — the real QNH is 1008). | "Oops, wrong number. But let me see what happens." | The system displays a warning: "Input Out of Range." The system still allows the entry after the pilot confirms the value. |
| **Connection Drop** | Loses cellular signal on the apron. | "Cell service is dead out here. Hopefully the app still works." | The application continues to function fully, using locally stored profiles and airfield data. |
| **Briefing Generation** | Generates a "Digital Briefing Pack" (PDF) for the flight. | "Let me save this to my kneeboard before takeoff." | The system generates the PDF export. |
| **Export Review** | Reviews the generated PDF. Notices the destination airport parameters are marked. | "Ah, I never manually verified the auto-downloaded destination airfield." | The PDF displays the destination airport parameters with an `[UNVERIFIED]` marker and includes a disclaimer about unverified external data. |

**Outcome:** The pilot comfortably uses the application under adverse conditions — dark cockpit, no connectivity. Typos are caught but pilot authority is preserved. The exported PDF clearly flags any externally-sourced data that the pilot hasn't personally verified.
