# AeroDash Software Requirements - Documentation & Export (DOC)

## Requirements

### REQ-DOC-001: M&B Print Preview

When the user requests an eligible M&B print preview in Flight Preparation, the system shall display a client-only M&B print summary.

### REQ-DOC-002: Unverified Data Marker

The system shall append the text marker `[UNVERIFIED]` to any parameter value in the generated output (PDF/Print) that has the status `Unverified`.

### REQ-DOC-003: Unverified Data Disclaimer

If the calculation contains `Unverified` data, then the system shall include a disclaimer section in the export stating: "Calculation based on unverified external data. Pilot in Command assumes full responsibility."

### REQ-DOC-004: Low Safety Margin Disclaimer

If the calculation uses a user-selected Operational Safety Factor that is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), then the system shall include a disclaimer section in the export stating: "Calculation based on low safety margin. Pilot in Command assumes full responsibility."

### REQ-DOC-005: Notification Rendering in Export

When generating the export, the system shall place every active WARNING or CRITICAL notification in the section identified by its notification context (for example, `MassBalance.CG` at the start of Mass & Balance).

### REQ-DOC-006: Performance briefing

When the user exports a briefing pack, the system shall include the performance results in that output.

### REQ-DOC-007: Print Snapshot Contents

When opening the M&B print preview, the system shall assemble the current aircraft identity, category, UTC generation time, loading units, takeoff and zero-fuel mass/CG, all-usable-fuel-burned endpoint, category limits, notifications and profile provenance into one snapshot.

### REQ-DOC-008: Print Eligibility

While M&B has no successful result, incomplete or invalid inputs, a pending profile selection, loading, ERROR or CRITICAL state, the system shall block M&B printing.

### REQ-DOC-009: Snapshot Invalidation

When aircraft, category, loading, profile status or notifications change, the system shall invalidate an open M&B print snapshot.

### REQ-DOC-010: Native Print Guard

When native browser printing begins, the system shall suppress an ineligible or invalidated M&B snapshot in print media.

### REQ-DOC-011: Profile Markers

Where a profile is draft, unattributed or expired, the system shall mark its M&B parameter values `[UNVERIFIED]` in print output.

### REQ-DOC-012: Endpoint Scope

When displaying M&B print output, the system shall identify the all-usable-fuel-burned endpoint as distinct from trip-specific arrival without a full-flight, landing-suitability or Go/No-Go verdict.

### REQ-DOC-013: Return to Preparation

When the user closes M&B print preview, the system shall retain the current preparation inputs.

### REQ-DOC-014: Offline Print

While the production app and aircraft are cached locally, the system shall support M&B print preview and native browser Print after an offline reload.

The implemented slice is M&B only. Full briefing assembly, downloadable PDF,
Performance export and low-factor export remain future scope. Browser-generated
PDFs in QA are evidence of browser pagination, not a downloadable product feature
or physical printer execution. Preview data is session-only and does not change
profile verification or acknowledge notifications.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
