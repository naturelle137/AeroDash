# AeroDash Software Requirements - Performance (PF)

## Requirements

### REQ-PF-001: Distinct Performance Variables

When calculating performance, the system shall calculate Takeoff Run (TOR).

### REQ-PF-002: Bilinear Interpolation

When the requested mass, pressure altitude and temperature are within the aircraft’s tabulated range, the system shall return the interpolated POH distance defined by the [interpolation contract](../architecture/performance-bilinear-interpolation-contract.md).

### REQ-PF-003: Hierarchical Fallback

When a POH correction exists for wind, surface or slope, the system shall use that correction for that parameter.

### REQ-PF-004: Correction Application Isolation

When applying surface friction or runway slope corrections, the system shall apply them only to TOR and LR.

### REQ-PF-005: Missing Data Estimation

If one takeoff base distance is missing, then the system shall derive it using `TOD = TOR × 1.9` before applying the Operational Safety Factor.

### REQ-PF-006: Operational Required Distance

When calculating performance, the system shall multiply the corrected distance by the selected Operational Safety Factor to obtain Operational Required Distance.

### REQ-PF-007: Safety Margin Calculation

When calculating performance, the system shall report Available Runway minus Operational Required Distance as the absolute safety margin.

### REQ-PF-008: Custom Obstacle Constraints

The system shall allow the pilot to define custom obstacle constraints (Target Height at a specific Distance) to verify climb gradients over off-airport obstacles.

### REQ-PF-009: Unverified Obstacle Notification

While a pilot-defined obstacle is active, the system shall emit a persistent WARNING notification (`WARN-PF-001`) alerting the pilot that unverified obstacle data is in use.

### REQ-PF-010: Extrapolation Limits and Penalties

If a requested condition exceeds a POH axis maximum by more than 10% of that maximum, then the system shall block performance-distance output.

### REQ-PF-011: Performance Benefit Capping

When conditions are better than the POH table minimum, the system shall return no distance shorter than the documented best-case POH value.

### REQ-PF-012: Extrapolation Acknowledgment

While a result uses extrapolated data, the system shall withhold acceptance of that result until explicit pilot acknowledgement.

### REQ-PF-013: Pressure Altitude Formula

When deriving pressure altitude from QNH and field elevation, the system shall use `PA(ft) = 145366.45 × (1 − (P / 1013.25)^0.190284)` with station pressure `P(hPa) = (QNH^0.190284 − 1013.25^0.190284 × 0.0065 / 288 × Elevation(m))^(1/0.190284) + 0.3` per the [pressure-altitude contract](../architecture/pressure-altitude.md).

### REQ-PF-014

Retired ID; reserved for historical references.

### REQ-PF-015: Runway Insufficient Notification

If the Operational Required Distance exceeds the published Available Distance (TORA/LDA), the system shall emit a CRITICAL notification (`CRIT-PF-002`) alerting the pilot that the runway is insufficient for the required distance.

### REQ-PF-016: Low Safety Factor Warning

If the user-selected Operational Safety Factor is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43), then the system shall emit a WARNING notification (`WARN-PF-002`) alerting the pilot that the safety factor is below the recommended minimum.

### REQ-PF-017: Estimated Value Marking

When a performance value is derived using REQ-PF-005 or its landing counterpart, the system shall label it `ESTIMATED (CAA SSL 07)` in the UI.

### REQ-PF-018: Takeoff distance

When calculating performance, the system shall calculate Takeoff Distance to 50 ft (TOD).

### REQ-PF-019: Landing roll

When calculating performance, the system shall calculate Landing Roll (LR).

### REQ-PF-020: Landing distance

When calculating performance, the system shall calculate Landing Distance from 50 ft (LD).

### REQ-PF-021: Missing POH corrections

If the POH has no correction for a parameter, then the system shall use the applicable FSM 3/75 fallback defined in the [factor contract](../architecture/performance-safety-factor-pipeline.md).

### REQ-PF-022: Whole-distance corrections

When applying density-altitude or wind corrections, the system shall apply them to the entire distance.

### REQ-PF-023: Landing estimation

If one landing base distance is missing, then the system shall derive it using `LD = LR × 1.67` before applying the Operational Safety Factor.

### REQ-PF-024: Factor presets

The system shall offer the EASA Standard (takeoff 1.25, landing 1.43), POH/AFM Specific and Short Field (landing 1.15) factor presets.

### REQ-PF-025: Custom factor

The system shall allow a custom Operational Safety Factor from 1.00 through 3.00 inclusive.

### REQ-PF-026: Percentage margin

When calculating performance, the system shall report the safety margin as `100 × (Available Runway − Operational Required Distance) / Operational Required Distance` for a positive required distance.

### REQ-PF-027: Extrapolation penalty

If worse conditions exceed a positive POH axis maximum by at most 10%, then the system shall apply a single 20% distance penalty to the clamped boundary distance.

### REQ-PF-028: Nonpositive boundary

If a worse-condition request exceeds a POH axis maximum of zero or less, then the system shall block extrapolation.

### REQ-PF-029: Fixed extrapolation limits

The system shall prevent the user from overriding the 10% extrapolation cap and 20% penalty.

### REQ-PF-030: Extrapolated export

While an extrapolated result is unacknowledged, the system shall prevent its export.

### REQ-PF-031: Reset acknowledgement

When an input change triggers a new extrapolation assessment, the system shall clear the prior acknowledgement.

### REQ-PF-032: Estimated export marker

When an estimated performance value is exported, the system shall label it `ESTIMATED (CAA SSL 07)` in the export.

### REQ-PF-041: Raw table inspection

When the pilot opens Performance, the system shall offer persisted Fleet profiles for raw POH table inspection.

### REQ-PF-042: Complete reviewed source

If a selected profile is Draft, invalid or lacks exactly one complete positive-distance rectangular grid for each of TOR, TOD, LR and LD, then the system shall block raw distance output.

### REQ-PF-043: In-envelope application lookup

If a requested condition lies outside any of the four tables' supported axes, then the raw table inspection service shall block output without clamping or extrapolation.

### REQ-PF-044: Required lookup inputs

If mass in kg, pressure altitude in ft or temperature in °C is empty, nonfinite or unsupported, then the system shall block raw distance output.

### REQ-PF-045: Result invalidation

When a lookup input or the selected profile changes, the system shall immediately clear the prior raw distances.

### REQ-PF-046: Raw distance scope

While raw table distances are displayed, the system shall identify them as uncorrected table values without operational factors or runway assessment.

### REQ-PF-047: Import table review

When a Fleet profile contains performance tables, the system shall offer read-only inspection of every imported point before explicit user verification.

The raw inspection slice does not implement estimation, extrapolation,
correction selection or operational runway comparison. Those requirements remain future scope.
Synthetic Test fixtures establish wiring only; applicable aircraft POH/AFM citations and
independent reference cases are required for aircraft-specific validation.

### REQ-PF-048: Source-unit preservation

When performance tables are imported, the system shall preserve each table's declared source units and numeric source values through export and persistence.

### REQ-PF-049: Original and normalized review

When a Fleet performance table is reviewed, the system shall display its original points alongside normalized kg/ft/°C/m lookup points.

### REQ-PF-050: Invalid source declarations

If a performance unit declaration is unsupported, incomplete or conflicting, then the system shall reject the profile with a visible validation error.

### REQ-PF-051: Legacy performance units

When a performance table has no source-unit declaration, the system shall identify its legacy kg/ft/°C/m contract independently of M&B sourceUnit.

### REQ-PF-052: Source-unit conversion

When computing raw distances from declared source units, the system shall normalize each performance axis independently according to the [source-unit contract](../architecture/performance-source-units.md).

### REQ-PF-053: Source review invalidation

When performance source values, unit declarations or references are edited, the system shall require a new Draft verification before raw distance computation.

### REQ-PF-054: Explicit pressure-altitude method

The system shall require the pilot to choose either direct pressure-altitude entry or derivation from QNH and field elevation before raw distance computation.

### REQ-PF-055: Direct entry preservation

When the pressure-altitude method changes, the system shall retain the direct pressure-altitude entry unchanged.

### REQ-PF-056: Pressure-altitude input domain

If QNH is not a finite hPa value from 850 through 1100 or field elevation is not a finite ft/m value from −1500 through 15000 ft, then the system shall block derivation with a visible reason.

### REQ-PF-057: Derived pressure-altitude display

When pressure altitude is derived, the system shall display the result in ft together with the entered QNH, elevation, units, elevation source and method limits.

### REQ-PF-058: Runway elevation reuse

When the pilot explicitly requests it, the system shall copy the saved manual runway field elevation and unit into the derivation and label that source.

### REQ-PF-059: Copied elevation invalidation

When a saved manual runway is edited or cleared, the system shall remove an unchanged elevation copied from it.

### REQ-PF-060: Pressure-altitude invalidation

When the pressure-altitude method, a source value, a unit or the elevation source changes, the system shall immediately clear the prior raw distances.

### REQ-PF-061: Non-persistent derivation

The system shall not persist pressure-altitude inputs or derived pressure altitude.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
