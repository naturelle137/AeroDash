# Estimated trip arrival CG

Synthetic software evidence for [the bounded single-tank increment](https://github.com/naturelle137/AeroDash/issues/511), captured on 2026-11-14. This does not validate operational POH/AFM data, landing suitability or the full fuel-burn path/envelope.

## Independent arithmetic

BEM is 560 kg at 2 m and already includes unusable fuel. The tank contains 50 kg including 10 kg unusable at a fixed 1 m arm. Takeoff mass is 600 kg and moment is 1160 kg·m. A 20 kg trip leaves 580 kg, 1140 kg·m, CG 1.9655172413793103 m and 20 kg usable fuel. A duration plan at 10 kg/h for 120 minutes with 30 minutes reserve retains that 5 kg reserve within the remaining fuel; its budget margin is 15 kg.

| Burn | Arrival mass | Arrival moment | Arrival CG |
| :--- | :--- | :--- | :--- |
| 0 kg | 600 kg | 1160 kg·m | 1.9333333333333333 m (takeoff) |
| 20 kg | 580 kg | 1140 kg·m | 1.9655172413793103 m |
| 40 kg | 560 kg | 1120 kg·m | 2 m (all usable burned) |

An aft tank at 3 m instead gives 1240 kg·m takeoff moment and 1180/580 m arrival CG after 20 kg burn. P1 tests also check zero/negative datum-relative geometry, malformed/nonfinite inputs, overdraw and overflow. Adapter tests cover inch/foot normalization and excluded/empty/variable tanks. Real-store integration tests cover invalidation and recovery in both modes.

## Browser evidence

The production service worker controls the page before disconnect. The workflow imports and explicitly verifies synthetic Fleet profiles, enters M&B tank loads, exercises both planning modes, zero/partial/full burn, overdraw, invalid inputs, reserve shortfall, loading/category/aircraft changes, payload reset, method reset, reload and route re-entry. Offline reload is asserted to come from the service worker. Planning fields clear, persisted tank loads remain, and re-entry recomputes results. The fixture deliberately keeps existing M&B critical alerts visible: the arrival result is arithmetic, not a favourable verdict.

| View | 390 px | 1440 px |
| :--- | :--- | :--- |
| Duration, cached offline | [Mobile](duration-offline-390.png) | [Desktop](duration-offline-1440.png) |
| Direct fuel, cached offline | [Mobile](direct-offline-390.png) | [Desktop](direct-offline-1440.png) |
| Empty second available tank, mass retained | [Mobile](multiple-offline-390.png) | [Desktop](multiple-offline-1440.png) |
| Variable-arm tank, mass retained | [Mobile](variable-offline-390.png) | [Desktop](variable-offline-1440.png) |

Screenshots are from the real production browser flow, with the arrival region centered for mobile readability. No horizontal overflow is allowed. The same test attaches online, shortage and control screenshots to its Playwright report. Screenshot hashes are in [SHA256SUMS](SHA256SUMS).

## Verification

Run in the `web-dev` toolbox with locked dependencies. See `frontend/tests/offline-production/fuel-endurance.spec.ts` and the P1/P2 tests beside `trip-arrival.ts` and `arrival-cg.ts`.

| Check | Result |
| :--- | :--- |
| `pnpm lint` | Passed |
| `pnpm test:unit --maxWorkers 2` | 1989 passed |
| `pnpm test:integration --maxWorkers 2` | 138 passed |
| `pnpm build` | Type-check and production build passed |
| `pnpm --filter frontend test:p1:coverage` | 916 passed; all per-file thresholds passed |
| `pnpm --filter frontend test:mutation --concurrency 4 --reporters dots,clear-text,html` | 78.52%, above 70%; `trip-arrival.ts` 100%, no survivors |
| `CI=1 pnpm test:e2e --project=chromium --workers=1` | 97 passed; no current feature has `@wip` |
| `pnpm --filter frontend exec playwright test --config playwright.offline.config.ts` | 4 passed against the built production artifact |

P1 aggregate coverage: 99.28% lines, 97.24% branches, 100% functions. The first offline fixture import was correctly rejected because it supplied both fixed and lookup geometry; the corrected variable-arm fixture uses `arm: null`. A mutation attempt contaminated by concurrent lint was stopped and discarded. The reported clean mutation run completed after correcting the generated `.stryker-tmp` ESLint exclusion; it is the only mutation result used here. Review, required CI and postmerge verification remain separate delivery gates.
