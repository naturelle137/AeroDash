# AeroDash Software Requirements - Fuel & Endurance (FE)

## Requirements

### REQ-FE-001: Fuel Density Calculation

When a fuel type is selected, the system shall automatically calculate mass using the specific density of that fuel type: AvGas, MoGas = 0.72 kg/L, Jet A-1, Diesel = 0.84 kg/L.

### REQ-FE-002: Endurance Calculation

The system shall calculate maximum flight time (Endurance) based on usable fuel quantity and planned fuel flow rate.

### REQ-FE-003: Endurance Exceedance Warning

If the planned flight time (including reserves) exceeds the calculated maximum flight time (Endurance), then the system shall emit a WARNING notification (`WARN-FE-001`) alerting the pilot about insufficient fuel for the planned mission.

### REQ-FE-004: Fuel Burn Sequence

When calculating fuel consumption for a named burn sequence, the system shall drain tanks in the configured order.

### REQ-FE-005: Landing Mass Estimation

When the user enters Planned Flight Time, the system shall calculate estimated landing mass from the corresponding fuel burn.

### REQ-FE-006: Electric Endurance Card

While the selected aircraft is electric, the system shall label the Mass & Balance endurance card `Energy & Endurance`.

### REQ-FE-007: Independent sequences

While an aircraft has multiple named burn sequences, the system shall calculate fuel-state progression independently for each sequence.

### REQ-FE-008: Electric fuel controls

While the selected aircraft is electric, the system shall hide fuel-tank rows, burn-sequence selectors and fuel-type controls.

### REQ-FE-009: Trip-fuel landing mass

When the user enters Trip Fuel, the system shall calculate estimated landing mass from that fuel burn.
