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

### REQ-FE-005: Estimated trip arrival mass

When the user enters a valid explicit consumption and trip duration, the system shall calculate estimated arrival mass as validated M&B takeoff mass minus trip fuel burned.

### REQ-FE-006: Electric Endurance Card

While the selected aircraft is electric, the system shall label the Mass & Balance endurance card `Energy & Endurance`.

### REQ-FE-007: Independent sequences

While an aircraft has multiple named burn sequences, the system shall calculate fuel-state progression independently for each sequence.

### REQ-FE-008: Electric fuel controls

While the selected aircraft is electric, the system shall hide fuel-tank rows, burn-sequence selectors and fuel-type controls.

### REQ-FE-009: Trip-fuel landing mass

When direct Trip Fuel mode has explicit finite nonnegative fuel mass in kg and valid current M&B and usable inventory, the system shall calculate estimated arrival mass as takeoff mass minus that trip fuel.

### REQ-FE-010: Explicit manual plan

When using duration-based combustion planning, the system shall require explicit positive finite average consumption in kg/h.

### REQ-FE-011: Explicit durations

When using duration-based combustion planning, the system shall require explicit finite nonnegative trip and user-chosen reserve durations in minutes.

### REQ-FE-012: Usable inventory

When using duration-based combustion planning, the system shall exclude unusable fuel and tanks unavailable in the selected category from the existing tank loads.

### REQ-FE-013: Invalid inventory

If a tank load, fuel unit or fuel type is unsupported or invalid, then the system shall block endurance results.

### REQ-FE-014: Aircraft reset

When the selected aircraft changes, the system shall clear manual fuel planning inputs.

### REQ-FE-015: Session lifetime

When the preparation view is reopened or reloaded, the system shall start manual fuel planning unconfigured.

### REQ-FE-016: Arrival fuel

When displaying a trip arrival estimate, the system shall show usable fuel remaining before reserve budgeting.

### REQ-FE-017: Unavailable arrival estimate

If current M&B loading or fuel inventory is invalid or unavailable, then the system shall block the arrival estimate with a visible reason.

### REQ-FE-018: Impossible trip

If trip fuel exceeds usable fuel, then the system shall block the arrival estimate with a visible reason.

### REQ-FE-019: Explicit planning method

When configuring a manual fuel plan, the system shall require selection of duration-based planning or direct Trip Fuel in kg.

### REQ-FE-020: Method reset

When the planning method changes, the system shall clear manual inputs and invalidate prior results.

### REQ-FE-021: Direct output scope

While direct Trip Fuel mode is selected, the system shall omit duration-based endurance, reserve budgets and WARN-FE-001.

### REQ-FE-022: Invalid direct fuel

If direct Trip Fuel is blank, negative, malformed or nonfinite, then the system shall block the arrival estimate with a visible reason.

Current scope: REQ-FE-002/003 and manual arithmetic are available in Flight Preparation. Consumption is assumed constant; reserve is user chosen without a regulatory default. Zero margin is arithmetic equality, not a safety verdict. REQ-FE-005 estimated trip arrival mass retains reserve and does not assess landing CG, envelope or operational suitability. REQ-FE-009 direct Trip Fuel entry is available without duration, consumption or reserve inputs. Reserve remains aboard and unusable fuel is not subtracted again. Trip-specific CG, burn scheduling and electric endurance remain future work; the existing M&B zero-fuel landing output is separate.
