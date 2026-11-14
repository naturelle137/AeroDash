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

### REQ-MB-021: Mass-limit difference

While a valid M&B result and a positive category limit exist, the system shall state in kg, from unrounded values, whether takeoff mass is below, exactly at or above MTOM, and likewise zero-fuel mass against MZFM when the category defines one.

### REQ-MB-022: Mass-limit difference rounding

The system shall never display a positive margin larger than, or an excess smaller than, the unrounded difference, and shall show a non-zero sub-0.1 kg difference as such.

### REQ-MB-023: Mass-limit scope statement

The system shall state next to the mass-limit difference that it is an arithmetic comparison with entered profile limits and not a flight-suitability determination.

### REQ-MB-024: Neutral chart label

The system shall describe the chart's success state in its accessible label only as inside the entered envelope for the calculated state.

### REQ-MB-025: Mass-limit label rounding

The system shall display MTOM and MZFM next to the calculated masses in kg with their unit and rounded down, so a displayed limit never exceeds the entered limit.

### REQ-MB-026: Chart coordinate units

The system shall plot the selected category's envelope and the calculated CG points in kg and m (arm graph) or kg·m (moment graph), normalized with the same conversion used for the calculation, and label both axes with these units.

### REQ-MB-027: Source-unit moment normalization

The system shall interpret stored envelope and arm-table moments as the profile source mass unit multiplied by its arm unit (e.g. lb·in for `lb-in`, lb·ft for `lb-ft`) and convert them to kg·m with both the mass and the length factor before calculation, charting and printing.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
