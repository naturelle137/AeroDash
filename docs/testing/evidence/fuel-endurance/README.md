# Fuel endurance UI evidence

Captured and visually inspected on 2026-11-13 from the production build in Chromium,
using persisted synthetic Fleet profiles. These are software arithmetic checks,
not operational POH/AFM validation.

The scenario imports and explicitly verifies two fictional profiles, selects one in
Flight Preparation, enters a 50 kg tank load with 10 kg unusable fuel, then enters
10 kg/h, 120 min trip and 30 min reserve. It asserts 240 min endurance, 20 kg trip,
5 kg reserve and 15 kg remaining. Equality (240 + 0 min) shows zero margin;
240 + 1 min shows a 0.167 kg shortfall and WARN-FE-001. Blank tank/plan inputs
invalidate output. Aircraft changes clear the plan. An actual service-worker
reload while disconnected preserves the tank load but clears planning inputs;
explicit re-entry produces the same arithmetic offline.

| Width | Plan | Shortfall | Cached offline recalculation |
| :--- | :--- | :--- | :--- |
| 390 px | [Plan](390-fuel-plan.png) | [Shortfall](390-fuel-shortfall.png) | [Offline](390-fuel-offline.png) |
| 1440 px | [Plan](1440-fuel-plan.png) | [Shortfall](1440-fuel-shortfall.png) | [Offline](1440-fuel-offline.png) |

Reproduce with `pnpm test:offline`. The fuel scenario lives in
`frontend/tests/offline-production/fuel-endurance.spec.ts`; screenshots and traces
are attached to the Playwright report and the existing CI `offline-workflow-evidence`
artifact. The full offline suite passed 4/4 (both widths). The full Chromium BDD
regression passed 97/97, including Fleet/M&B, electric wizard and raw Performance.
Scenarios marked `@wip` remain excluded.

Local verification: lint, 1,918 unit tests, 120 integration tests, build/typecheck,
isolated P1 coverage (855 tests; 99.26% lines overall, all per-file thresholds met),
and full P1 mutation (78.33%, required floor 70) passed. Core mutation ran before
formatting-only changes to that core; calculation semantics and core tests are identical.
