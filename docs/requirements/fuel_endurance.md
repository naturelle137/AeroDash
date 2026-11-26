# AeroDash Software Requirements - Fuel & Endurance (FE)

## Requirements

### REQ-FE-001: Fuel Density Calculation

When a fuel type is selected, the system shall automatically calculate mass using the specific density of that fuel type: AvGas, MoGas = 0.72 kg/L, Jet A-1, Diesel = 0.84 kg/L.

**Status:** Implemented. Tests: `frontend/src/core/logic/fuel-density.spec.ts`, `frontend/src/modules/fuel-endurance/services/usable-fuel.spec.ts`.

### REQ-FE-002: Endurance Calculation

The system shall calculate maximum flight time (Endurance) based on usable fuel quantity and planned fuel flow rate.

**Status:** Implemented. Tests: `frontend/src/core/logic/fuel-endurance.spec.ts`, `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-003: Endurance Exceedance Warning

If the planned flight time (including reserves) exceeds the calculated maximum flight time (Endurance), then the system shall emit a WARNING notification (`WARN-FE-001`) alerting the pilot about insufficient fuel for the planned mission.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-004: Fuel Burn Sequence

When calculating fuel consumption for a named burn sequence, the system shall drain tanks in the configured order.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`.

### REQ-FE-005: Estimated trip arrival mass

When the user enters a valid explicit consumption and trip duration, the system shall calculate estimated arrival mass as validated M&B takeoff mass minus trip fuel burned.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-006: Electric Endurance Card

While the selected aircraft is electric, the system shall label the Mass & Balance endurance card `Energy & Endurance`.

**Status:** Manual electric energy budget and constant-consumption endurance estimates are available.

### REQ-FE-007: Independent sequences

While an aircraft has multiple named burn sequences, the system shall calculate fuel-state progression independently for each sequence.

**Status:** Implemented. Synthetic integrated and Chromium tests cover independent M&B waypoints and arrival sequence selection: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`, `frontend/tests/offline-production/fuel-sequences.spec.ts`.

### REQ-FE-008: Electric fuel controls

While the selected aircraft is electric, the system shall hide fuel-tank rows, burn-sequence selectors and fuel-type controls.

**Status:** Implemented. Synthetic Chromium coverage checks electric planning and absent fuel controls: `frontend/tests/offline-production/electric-energy.spec.ts`.

### REQ-FE-009: Direct trip arrival mass

When direct Trip Fuel mode has explicit finite nonnegative fuel mass in kg and valid current M&B and usable inventory, the system shall calculate estimated arrival mass as takeoff mass minus that trip fuel.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-010: Explicit manual plan

When using duration-based combustion planning, the system shall require explicit positive finite average consumption in kg/h.

**Status:** Implemented. Tests: `frontend/src/core/logic/fuel-endurance.spec.ts`, `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-011: Explicit durations

When using duration-based combustion planning, the system shall require explicit finite nonnegative trip and user-chosen reserve durations in minutes.

**Status:** Implemented. Tests: `frontend/src/core/logic/fuel-endurance.spec.ts`, `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-012: Usable inventory

When using manual combustion fuel planning, the system shall exclude unusable fuel and tanks unavailable in the selected category from the existing tank loads.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/usable-fuel.spec.ts`, `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-013: Invalid inventory

If a tank load, fuel unit or fuel type is unsupported or invalid, then the system shall block endurance results.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/usable-fuel.spec.ts`.

### REQ-FE-014: Aircraft reset

When the selected aircraft changes, the system shall clear manual fuel planning inputs.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-015: Session lifetime

When the preparation view is reopened or reloaded, the system shall start manual fuel planning unconfigured.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts` (remount starts unconfigured).

### REQ-FE-016: Arrival fuel

When displaying a trip arrival estimate, the system shall show usable fuel remaining before reserve budgeting.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`, `frontend/src/modules/export/fuel-print.int.spec.ts`.

### REQ-FE-017: Unavailable arrival estimate

If current M&B loading or fuel inventory is invalid or unavailable, then the system shall block the arrival estimate with a visible reason.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`, `frontend/src/modules/fuel-endurance/services/usable-fuel.spec.ts`.

### REQ-FE-018: Impossible trip

If trip fuel exceeds usable fuel, then the system shall block the arrival estimate with a visible reason.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-019: Explicit planning method

When configuring a manual fuel plan, the system shall require selection of duration-based planning or direct Trip Fuel in kg.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-020: Method reset

When the planning method changes, the system shall clear manual inputs and invalidate prior results.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-021: Direct output scope

While direct Trip Fuel mode is selected, the system shall omit duration-based endurance, reserve budgets and WARN-FE-001.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-022: Invalid direct fuel

If direct Trip Fuel is blank, negative, malformed or nonfinite, then the system shall block the arrival estimate with a visible reason.

Current scope: REQ-FE-002/003 and manual arithmetic are available in Flight Preparation. Consumption is assumed constant; reserve is user chosen without a regulatory default. Zero margin is arithmetic equality, not a safety verdict. REQ-FE-005 estimated trip arrival mass retains reserve and does not assess landing or operational suitability. REQ-FE-009 direct Trip Fuel entry is available without duration, consumption or reserve inputs. Reserve remains aboard and unusable fuel is not subtracted again. Fixed-arm trip arrival CG supports one tank or an explicitly selected complete named multi-tank sequence, including empty available tanks. Variable-arm trip CG supports one lookup tank using total-load moment differences (REQ-MB-031 and REQ-FE-034) and explicit sequences mixing fixed-arm and lookup tanks, including nonzero unusable fuel that is never burned (REQ-FE-037). Supported fixed-arm and lookup-tank trip burn paths are assessed against the current envelope through tank switches and lookup knots. Electric endurance uses explicit available energy and average power; the existing M&B zero-fuel landing output is separate.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-023: Fixed-arm trip arrival CG

When either manual planning mode has valid current M&B, valid usable inventory and exactly one category-available tank with an explicit finite fixed arm and no lookup table, the system shall calculate estimated arrival CG as (takeoff moment minus trip fuel multiplied by tank arm) divided by arrival mass in SI.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`, `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-024: Unsupported arrival CG

If the configuration does not support trip arrival CG, then the system shall show a reason without suppressing otherwise valid arrival mass.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`, `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-025: Current arrival CG

When aircraft, category, loading, method or planning inputs change, the system shall invalidate or recompute estimated arrival CG from current inputs.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-026: Arrival CG presentation

When displaying estimated arrival CG, the system shall label its unit in metres.

**Status:** Implemented. Tests: `frontend/tests/offline-production/fuel-endurance.spec.ts` (Playwright, outside the unit gate; no unit test asserts the metre label).

### REQ-FE-027: Arrival assessment boundary

When displaying estimated trip arrival, the system shall distinguish it from the separate all-usable-fuel-burned M&B endpoint.

**Status:** Approved. The arrival estimate is tested to leave the full-burn endpoint unchanged (`frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`); the on-screen distinction wording is not asserted.

### REQ-FE-028: Explicit arrival sequence

While multiple fuel tanks are category-available, the system shall require an explicit named burn sequence selection for trip arrival CG.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-029: Complete arrival sequence

If a selected multi-tank sequence does not cover every category-available tank exactly once with distinct finite positive integer order values, then the system shall suppress trip arrival CG with a visible reason.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`, `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-030: Excluded sequence references

If a selected multi-tank sequence includes a category-excluded tank, then the system shall suppress trip arrival CG with a visible reason.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`.

### REQ-FE-031: Ordered arrival moment

When a valid multi-tank sequence has category-available tanks that each have either a finite fixed arm or a lookup table, the system shall calculate trip arrival moment by subtracting the moment of the usable fuel burned from each tank in sequence order from takeoff moment in SI, using mass × arm for fixed-arm tanks and F(before) − F(after) for lookup tanks.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`.

### REQ-FE-032: Sequence context reset

When the aircraft profile or certification category changes, the system shall clear the arrival sequence selection.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-033: Sequence session reset

When the preparation view opens or the planning method changes, the system shall leave the arrival sequence unselected.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`.

### REQ-FE-034: Single lookup-tank arrival moment

When either manual planning mode has valid current M&B and exactly one category-available tank with a lookup table, no fixed arm, the system shall calculate trip arrival moment as takeoff moment minus the table moment at the takeoff tank load plus the table moment at the remaining tank load, in SI.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`, `frontend/src/modules/fuel-endurance/components/FuelEnduranceCard.int.spec.ts`, `frontend/src/core/logic/fuel-lookup-total-moment.spec.ts`.

### REQ-FE-035: Lookup geometry validation

If the lookup table has fewer than two finite points, quantities that are not strictly ascending, a first point other than zero quantity and zero moment, or does not cover the current tank load, then the system shall suppress trip arrival CG with a visible reason without clamping, sorting or extrapolating.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`.

### REQ-FE-036: Unsupported lookup configurations

If a category-available lookup tank also declares a fixed arm, then the system shall suppress trip arrival CG with a visible reason.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`.

### REQ-FE-037: Mixed-geometry sequence validation

If a multi-tank sequence with a lookup tank (with any unusable fuel) lacks a complete selected sequence, or a lookup tank fails REQ-FE-035 or cannot supply its burn, then the system shall suppress trip arrival CG with a visible reason without clamping, sorting or extrapolating.

**Status:** Implemented. Tests: `frontend/src/modules/fuel-endurance/services/arrival-cg.spec.ts`.

### REQ-FE-038: Manual electric energy budget

While a valid electric battery profile is selected, the system shall calculate estimated trip energy and reserve margin from explicit available energy, average power and trip duration.

### REQ-FE-039: Electric reserve warning

If estimated remaining energy is below the profile reserve floor, the system shall display a warning.

### REQ-FE-040: Invalid electric budget

If an electric budget input is missing or invalid, the system shall suppress the estimated budget.

### REQ-FE-041: Electric time to depletion

While a valid battery profile, available energy and positive average consumption are provided, the system shall show estimated time to depletion without requiring trip duration.

### REQ-FE-042: Electric time above reserve

While electric endurance is available, the system shall show estimated time above the profile reserve floor, clamped to zero.

### REQ-FE-043: Electric endurance briefing

While electric endurance is available, the briefing shall show the current estimates.

### REQ-FE-044: Trip burn path assessment

When a valid trip and supported envelope are available, the system shall assess the continuous path through tank switches and lookup-table knots against the envelope.

### REQ-FE-045: Unavailable trip burn path

If trip path assessment is unsupported or inputs are invalid, the system shall display an unavailable result with a reason.

### REQ-FE-046: Trip burn path briefing

When displaying the current fuel briefing, the system shall include the trip burn path result and its limitations.

### REQ-FE-047: Pilot-added electric reserve

When a valid electric trip and an explicit finite nonnegative pilot-added reserve duration are provided, the system shall show its estimated energy, remaining energy after trip and reserve, and difference to the profile reserve floor.

### REQ-FE-048: Invalid added electric reserve

If the pilot-added reserve duration is missing or invalid, the system shall suppress the added reserve budget without suppressing valid trip-only estimates.

### REQ-FE-049: Added electric reserve briefing

When displaying the electric briefing, the system shall include the current added reserve budget or its unavailability reason and its limitations.
