# AeroDash Software Requirements - Mass & Balance (MB)

## Requirements

### REQ-MB-001: Dynamic Envelope Updates

When a certification category is selected, the system shall apply that category’s MTOM.

### REQ-MB-002: Automatic CG Recalculation

When a load station value changes, the system shall recalculate total mass.

### REQ-MB-003: Synchronous Chart Updates

While calculating mass and balance, the system shall update the CG envelope chart synchronously with user input.

### REQ-MB-004: Out of Envelope Notification

If the calculated CG is outside the defined aircraft envelope, then the system shall emit a CRITICAL notification (`CRIT-MB-001`) alerting the pilot that the CG is out of the approved envelope.

### REQ-MB-005: MTOM Exceedance Notification

If the total mass exceeds MTOM, then the system shall emit a CRITICAL notification (`CRIT-MB-002`) alerting the pilot that the maximum takeoff mass has been exceeded.

### REQ-MB-006: Geometric Node Extraction

When calculating mass and balance, the system shall provide geometric coordinates for the CG envelope.

### REQ-MB-007: Polygon Bounds Verification

When checking mass and CG, the system shall classify the point against the aircraft’s polygonal envelope, including sloped and non-linear boundaries.

### REQ-MB-008: Take-off and Landing CG

When valid loading values are entered, the system shall calculate takeoff CG.

### REQ-MB-009: MZFM Validation

When calculating mass and balance, the system shall calculate zero-fuel mass (ZFM).

### REQ-MB-010: Polygon Definition Output

The system shall output the polygon definition for the CG envelope.

### REQ-MB-011: CG Migration Exceedance

If the CG migration region (trend line for single-sequence aircraft, or burn-down polygon for multi-sequence aircraft) exits the envelope at any point, the system shall emit a CRITICAL notification (`CRIT-MB-003`) alerting the pilot that the CG migration exceeds the approved envelope during fuel burn.

### REQ-MB-012: Variable Moment Calculation

The system shall calculate moments using either fixed arms or variable moment tables for each loading station.

### REQ-MB-013: Category stations

When a certification category is selected, the system shall apply that category’s allowed stations.

### REQ-MB-014: Category envelope

When a certification category is selected, the system shall apply that category’s CG envelope.

### REQ-MB-015: CG recalculation

When a load station value changes, the system shall recalculate CG.

### REQ-MB-016: Load coordinates

When calculating mass and balance, the system shall provide geometric coordinates for the load points.

### REQ-MB-017: Landing CG

When valid loading values are entered, the system shall calculate landing CG.

### REQ-MB-018: Tank-transition CG

While an aircraft has multiple burn sequences, the system shall calculate CG at every tank-transition boundary in each sequence.

### REQ-MB-019: Burn-down region

While an aircraft has multiple burn sequences, the system shall provide a burn-down polygon encompassing every calculated fuel-burn CG position.

### REQ-MB-020: MZFM warning

If ZFM exceeds the aircraft’s specified MZFM, then the system shall emit a CRITICAL notification (`CRIT-MB-004`) identifying the exceedance.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
