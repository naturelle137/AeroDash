# AeroDash Software Requirements - Documentation & Export (DOC)

This document defines the documentation & export behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

---

## Requirements

<!-- @REQ-DOC-001@ -->

### REQ-DOC-001: PDF Export Function

**Requirement:** The system shall provide an export function (PDF or optimized print view) that summarizes mass and balance calculation results, and performance calculation results in a compact "Digital Briefing Pack."
**Rationale:** Legal documentation and cockpit accessibility.
**Priority:** P2
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-DOC-002@ (FROM: @H-015@) -->

### REQ-DOC-002: Unverified Data Marker

**Requirement:** The system shall append the text marker `[UNVERIFIED]` to any parameter value in the generated output (PDF/Print) that has the status `Unverified`.
**Rationale:** No accidental use of unverified data.
**Priority:** P1
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-DOC-003@ (FROM: @H-015@) -->

### REQ-DOC-003: Unverified Data Disclaimer

**Requirement:** If the calculation contains `Unverified` data, then the system shall include a disclaimer section in the export stating: "Calculation based on unverified external data. Pilot in Command assumes full responsibility."
**Rationale:** Legal liability transfer.
**Priority:** P2
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-DOC-004@ (FROM: @H-016@) -->

### REQ-DOC-004: Low Safety Margin Disclaimer

**Requirement:** If the calculation uses a user-selected Operational Safety Factor that is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), then the system shall include a disclaimer section in the export stating: "Calculation based on low safety margin. Pilot in Command assumes full responsibility."
**Rationale:** Legal liability transfer.
**Priority:** P2
**Status:** Deferred
**Design Reference:** n/a

<!-- @REQ-DOC-005@ -->

### REQ-DOC-005: Notification Rendering in Export

**Requirement:** When generating the export (PDF/Print), the system shall render all active notifications with severity `WARNING` or `CRITICAL` within the relevant section of the document, using the notification's `context` field to determine placement (e.g., a notification with context `MassBalance.CG` shall appear at the beginning of the Mass & Balance section).
**Rationale:** The exported document must carry the same safety warnings the pilot saw on screen, ensuring the paper copy is self-contained.
**Priority:** P1
**Status:** Deferred
**Design Reference:** [Notification Schema](../architecture/notification_schema.md)

---

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

---
