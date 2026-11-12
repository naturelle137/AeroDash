# AeroDash Software Requirements - Usability & Quality (UQ)

## Requirements

### REQ-UQ-001: Touch-Friendly Controls

The system shall provide touch-friendly input controls (steppers, sliders, or large hit targets) for all numerical data entry fields.

### REQ-UQ-002: Responsive Layout Adaptation

The system shall adapt the layout to ensure all critical flight data (Envelope, Results) is fully visible without horizontal scrolling on viewports with a minimum width of 320px (standard mobile).

### REQ-UQ-003: Decimal Precision Formatting

The system shall display numerical values with decimal places `m=3, cm=1, mm=0, in=2, kg/lb/L/gal=1`.

### REQ-UQ-004: Conservative Rounding Strategy

When displaying a safety-critical mass, the system shall round upward.

### REQ-UQ-005: Active Unit Display

The system shall statically display the active unit of measurement adjacent to every numerical input and output field.

### REQ-UQ-006: Zero-Value Plausibility Check

When a required occupant station has numeric mass zero, the system shall emit WARNING `WARN-UQ-001` identifying the affected station by name.

### REQ-UQ-007: Distance rounding

When displaying a required distance, the system shall round upward.

### REQ-UQ-008: Endurance rounding

When displaying endurance, the system shall round downward.

### REQ-UQ-009: Remaining fuel rounding

When displaying remaining fuel, the system shall round downward.

### REQ-UQ-010: Optional empty occupant

When an explicitly optional occupant station has numeric mass zero, the system shall accept it without an empty-seat warning or confirmation.

### REQ-UQ-011: Default occupancy

While an occupant station omits occupancy, the system shall treat it as required.

### REQ-UQ-012: Invalid empty-seat inputs

If an occupant input is blank, invalid, negative or nonfinite, then the system shall reject it as an empty-seat value.

### REQ-UQ-013: Occupancy editing

When a station’s occupancy is edited, the system shall preserve that choice independently of station kind.

### REQ-UQ-014: Occupancy persistence

When a profile is saved and reloaded, the system shall retain each station’s configured occupancy.

### REQ-UQ-015: Occupancy exchange

When a profile is exported and imported, the system shall retain each station’s configured occupancy.

### REQ-UQ-016: No inferred occupancy

The system shall determine occupancy from the configured value rather than the station label or position.

### REQ-UQ-017: Combined occupant station

While a station represents combined crew/passenger seating, the system shall require only the aggregate occupant mass.

### REQ-UQ-018: Non-occupant zero

When a fuel or baggage/cargo station has mass zero, the system shall not emit the occupant-zero warning.

### REQ-UQ-019: Missing station kind

While a station has no kind, the system shall apply occupant-station plausibility rules.

### REQ-UQ-020: Positive occupant validation

When an occupant station has positive mass, the system shall apply the existing positive-mass input safeguards regardless of occupancy.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)
