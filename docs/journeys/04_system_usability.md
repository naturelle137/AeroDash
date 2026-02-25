# User Journeys - Phase D: System & Usability

Focus: UI resilience and environmental factors.

---

<!-- @UJ-D-001@ (FROM: @REQ-UI-011@, @REQ-UI-008@, @REQ-SYS-001@, @REQ-PF-013@, @REQ-DOC-001@, @REQ-DOC-002@) -->
## <a name="UJ-D-001"></a>UJ-D-001: Cockpit Usability & Stress Test

**Persona:** Pilot (Night Flight)

**Context:** Setting up for a late-night cross-country flight while sitting in a dark cockpit with spotty cellular reception, using an airfield profile downloaded earlier from the external database but not verified.

**Goal:** Verify UI resilience against errors and night ops, ensure the app works in degraded connectivity environments, and properly handles unverified external database data during export.

* **Journey:**
| Phase | User Action | Thoughts | System Interaction |
| :--- | :--- | :--- | :--- |
| **Cockpit Prep** | Activate "Dark Mode". | "Don't want to ruin my night vision with a bright white screen." | Application switches to high-contrast dark theme. |
| **Data Entry** | Enter "800" hPa QNH (Typo) and override. | "Wait, the QNH is 1008, but I'll force 800 just to test the bounds check." | System detects anomalous pressure format and displays an "Input Out of Range" warning but accepts the entry when confirmed. |
| **Connection Drop** | Disconnect Internet (Airplane Mode). | "Cell service is dead out here on the apron." | App shifts seamlessly to Offline Mode, continuing to allow calculations using cached profiles and airfields. |
| **Briefing Generation** | Generate "Digital Briefing Pack" (PDF). | "Let me save this to my kneeboard before takeoff." | System generates a PDF export of the calculated data. |
| **PDF Review** | Examine the PDF. Verify Unverified Data flag on the destination airport. | "Ah, I never manually verified the auto-downloaded destination airfield." | PDF explicitly lists the destination airport parameters with an `[UNVERIFIED]` tag and a disclaimer, while the manual inputs (like the forced QNH) remain untouched by the verification tags. |

**Outcome:** The pilot easily uses the application under adverse physical visibility and connectivity conditions. They are warned about typos but allowed to use Pilot-In-Command authority, while being safely reminded via PDF export about previously downloaded database information that they haven't vetted.
