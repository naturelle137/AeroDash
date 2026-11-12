# AeroDash Software Requirements - Documentation & Export (DOC)

## Requirements

### REQ-DOC-001: PDF Export Function

When the user exports a briefing pack, the system shall include the mass-and-balance results in a compact PDF or print view.

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

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
