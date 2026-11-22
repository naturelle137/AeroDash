# AeroDash Software Requirements - Documentation & Export (DOC)

## Requirements

### REQ-DOC-001: Briefing Pack Preview

When the user requests an eligible Briefing Pack preview in Flight Preparation, the system shall display a client-only current Flight Preparation briefing pack.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`.

### REQ-DOC-002: Unverified Data Marker

The system shall append the text marker `[UNVERIFIED]` to any parameter value in the generated output (PDF/Print) that has the status `Unverified`.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`, `frontend/src/modules/export/briefing-pdf.int.spec.ts`.

### REQ-DOC-003: Unverified Data Disclaimer

If the calculation contains `Unverified` data, then the system shall include a disclaimer section in the export stating: "Calculation based on unverified external data. Pilot in Command assumes full responsibility."

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`.

### REQ-DOC-004: Low Safety Margin Disclaimer

If the calculation uses a user-selected Operational Safety Factor that is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), then the system shall include a disclaimer section in the export stating: "Calculation based on low safety margin. Pilot in Command assumes full responsibility."

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`.

### REQ-DOC-005: Notification Rendering in Export

When generating the export, the system shall highlight each affected available value with its precise active warning or computed-exceedance notification.

**Status:** Implemented. Synthetic preview and PDF integration tests cover M&B limits, station and fuel warnings, condition and safety-factor warnings, wind limits, obstacles, extrapolation and electric-energy warnings, including unavailable values and snapshot invalidation. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`, `frontend/src/modules/export/briefing-pdf.int.spec.ts`, `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-006: Performance briefing

When the user exports a briefing pack, the system shall include the performance results in that output.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`, `frontend/src/modules/export/briefing-pdf.int.spec.ts`.

### REQ-DOC-007: Print Snapshot Contents

When opening the M&B print preview, the system shall assemble the current aircraft identity, category, UTC generation time, loading units, takeoff and zero-fuel mass/CG, all-usable-fuel-burned endpoint, category limits, notifications, load chart, fuel and current Performance presentation into one snapshot.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`, `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-008: Print Eligibility

While M&B has no successful current result, incomplete or invalid inputs, a pending profile selection, loading or a hard computation error, the system shall block M&B printing.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`. Partly superseded by REQ-DOC-028.

### REQ-DOC-009: Snapshot Invalidation

When aircraft, category, loading, profile status, notifications, fuel, runway, Performance conditions or unit preferences change, the system shall invalidate an open M&B print snapshot.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`, `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-010: Native Print Guard

When native browser printing begins, the system shall suppress an ineligible or invalidated M&B snapshot in print media.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`, `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-011: Profile Markers

Where a profile is draft, unattributed or expired, the system shall mark its M&B parameter values `[UNVERIFIED]` in print output.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`.

### REQ-DOC-012: Endpoint Scope

When displaying M&B print output, the system shall identify the all-usable-fuel-burned endpoint as distinct from trip-specific arrival without a full-flight, landing-suitability or Go/No-Go verdict.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`, `frontend/tests/offline-production/briefing-pack.spec.ts` (Playwright, outside the unit gate).

### REQ-DOC-013: Return to Preparation

When the user closes M&B print preview, the system shall retain the current preparation inputs.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`, `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-014: Offline Print

While the production app and aircraft are cached locally, the system shall support M&B print preview and native browser Print after an offline reload.

Preview data is session-only. Browser-generated PDFs in QA demonstrate browser pagination, not physical printer execution.

**Status:** Implemented. Tests: `frontend/tests/offline-production/mb-print.spec.ts`, `frontend/tests/offline-production/briefing-pack.spec.ts` (Playwright against the production build, outside the unit gate; no physical printer).

### REQ-DOC-015: Persistent action

While Flight Preparation is mounted, the system shall keep a Briefing Pack action visible above mobile navigation with safe-area and content clearance.

**Status:** Implemented. Tests: `frontend/tests/offline-production/briefing-pack.spec.ts` (Playwright, outside the unit gate).

### REQ-DOC-016: Current fuel output

When opening the briefing pack, the system shall include the current fuel inventory and configured mode-specific planning presentation.

**Status:** Implemented. Tests: `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-017: Unavailable fuel results

If a fuel plan is unconfigured or invalid, then the system shall show its current reason without successful trip-arrival or endurance results.

**Status:** Implemented. Tests: `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-018: Fuel warnings

While a duration plan has a possible trip, the system shall retain active budget warnings including reserve-only shortfall and zero margin in combined print output.

**Status:** Implemented. Tests: `frontend/src/modules/export/fuel-print.int.spec.ts`, `frontend/tests/offline-production/fuel-print.spec.ts` (Playwright, outside the unit gate).

### REQ-DOC-019: Unsupported printed arrival CG

If arrival CG is unsupported, then the system shall retain valid printed arrival mass with the current unsupported-CG reason.

**Status:** Approved. Printed arrival CG is covered for supported lookup-tank cases (`frontend/src/modules/export/fuel-print.int.spec.ts`); the printed unsupported-CG reason is not asserted.

### REQ-DOC-020: Current fuel snapshot

When fuel method, raw inputs or sequence change, the system shall synchronously invalidate an open combined print snapshot.

**Status:** Implemented. Tests: `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-021: Fuel print markers

Where profile data is unverified, the system shall mark affected fuel and arrival values [UNVERIFIED] in print output.

**Status:** Implemented. Tests: `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-022: Combined offline print

While the production app and aircraft are cached locally, the system shall support explicit re-entry and automatic inclusion of a manual fuel plan after an offline reload.

**Status:** Implemented. Tests: `frontend/tests/offline-production/fuel-print.spec.ts` (Playwright against the production build, outside the unit gate).

### REQ-DOC-023: Current runway and Performance

When opening the briefing pack, the system shall include the shared current runway and Performance input, result and unavailable-reason presentation.

**Status:** Approved. Runway and Performance presentation is tested (`frontend/src/modules/export/mb-print.int.spec.ts`); the printed unavailable-reason presentation is not asserted.

### REQ-DOC-024: Printed chart

When printing the briefing pack, the system shall preserve the normalized loading chart's severity color, hatching, readable axes, units and endpoint legend.

**Status:** Implemented. Tests: `frontend/tests/offline-production/mb-print.spec.ts`, `frontend/tests/offline-production/briefing-pack.spec.ts` (Playwright, outside the unit gate; no unit test).

### REQ-DOC-025: Limits beside results

When displaying M&B calculations in the pack, the system shall place applicable named mass limits beside their respective values.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`.

### REQ-DOC-026: Empty notification section

While no M&B notifications exist, the system shall omit the M&B notification section.

**Status:** Implemented. Tests: `frontend/tests/offline-production/briefing-pack.spec.ts` (Playwright, outside the unit gate; no unit test).

### REQ-DOC-027: Removed source section

When displaying the briefing pack, the system shall omit the separate profile/source-status and category-limits chapters.

**Status:** Implemented. Tests: `frontend/tests/offline-production/mb-print.spec.ts`, `frontend/tests/offline-production/briefing-pack.spec.ts` (Playwright, outside the unit gate; no unit test).

### REQ-DOC-028: Computed exceedance export

While current M&B values contain only advisory warnings or valid computed limit exceedances, the system shall permit their warned export.

This supersedes the former severity-only print restriction in REQ-DOC-008; system/adapter failures remain blocked.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`.

### REQ-DOC-029: Unavailable action

While no eligible current Briefing Pack can be generated, the system shall disable its action with a grey appearance.

**Status:** Implemented. Tests: `frontend/tests/offline-production/briefing-pack.spec.ts` (Playwright, outside the unit gate; no unit test).

### REQ-DOC-030: Action presentation

The system shall present the Briefing Pack action using the homepage Start Flight Preparation CTA style.

**Status:** Approved. Visual parity with the homepage CTA is asserted only for the disabled state in `frontend/tests/offline-production/briefing-pack.spec.ts`.

### REQ-DOC-031: Action help

The system shall omit helper text and tooltips associated with the Briefing Pack action.

**Status:** Implemented. Tests: `frontend/tests/offline-production/briefing-pack.spec.ts`, `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-DOC-032: Internal warning identifiers

When displaying or printing the briefing pack, the system shall omit internal warning identifiers from presented warning text.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`. The fuel section still prints its WARN-FE identifier (`frontend/src/modules/export/fuel-print.int.spec.ts`), a gap against this requirement.

### REQ-DOC-033: PDF download

When the user requests a PDF download of an eligible current Briefing Pack preview, the system shall generate a PDF file on the device containing the text, markers, warnings and disclaimers of the current print snapshot.

**Status:** Implemented. Tests: `frontend/src/modules/export/briefing-pdf.int.spec.ts`, `frontend/tests/offline-production/briefing-pack.spec.ts`.

### REQ-DOC-034: PDF download gating

If the print snapshot is invalidated or the CRIT-UI-001 acknowledgment is outstanding, the system shall not generate a PDF file.

**Status:** Implemented. Tests: `frontend/src/modules/export/briefing-pdf.int.spec.ts`, `frontend/src/modules/export/mb-print.int.spec.ts`.

### REQ-DOC-035: Offline PDF download

While the production app and aircraft are cached locally, the system shall support the PDF download after an offline reload.

**Status:** Implemented. Tests: `frontend/tests/offline-production/briefing-pack.spec.ts` (Playwright against the production build, outside the unit gate).

### REQ-DOC-036: PDF chart fallback

If the loading envelope chart cannot be rendered into the PDF, the system shall state the omission in the PDF text.

**Status:** Implemented. Tests: `frontend/src/modules/export/briefing-pdf.int.spec.ts`.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

### REQ-DOC-037: Instructor notes in pack

While instructor notes exist for the selected aircraft, the system shall list them, with anchor, self-declared author and text, in a section of the Briefing Pack separate from system notifications.

**Status:** Implemented. Tests: `frontend/src/modules/export/mb-print.int.spec.ts`.
