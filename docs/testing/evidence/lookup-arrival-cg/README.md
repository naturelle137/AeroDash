# Single lookup-tank trip arrival CG (zero unusable fuel)

Synthetic software evidence for the bounded [#529](https://github.com/naturelle137/AeroDash/issues/529) pilot, captured on 2026-11-14 from source commit `9ec6756579f9bebbfc539b73253a134da8276418` (tree `6cc6f3806559d6b2938615392afed19b2f0415f0`). This does not validate POH/AFM data, landing suitability or the full fuel-burn path/envelope. Nonzero unusable fuel remains unsupported pending [#530](https://github.com/naturelle137/AeroDash/issues/530).

## Independent arithmetic

BEM 560 kg at 2 m (1120 kg·m). One tank, `arm: null`, unusable fuel 0, total-moment table (kg, kg·m) (0,0), (10,10), (30,60), (50,150); load 50 kg. Takeoff 610 kg, 1270 kg·m. Arrival moment = 1270 − [F(50) − F(50 − b)].

| Burn | Arrival mass | Arrival moment | Arrival CG |
| :--- | :--- | :--- | :--- |
| 0 kg | 610 kg | 1270 kg·m | 2.082 m (takeoff) |
| 10 kg | 600 kg | 1225 kg·m | 2.042 m |
| 30 kg | 580 kg | 1155 kg·m | 1.991 m |
| 50 kg | 560 kg | 1120 kg·m | 2 m (all usable burned) |

The print fixture (BEM 500 kg at 1 m) gives 530 kg and (650 − 90) / 530 = 1.057 m after 20 kg.

## Browser evidence

`frontend/tests/offline-production/fuel-endurance.spec.ts` and `fuel-print.spec.ts` run against the built production artifact at 390 and 1440 px. The service worker controls the page and the network is offline. The flows cover both planning modes, zero/partial/full burn, a load beyond the table with recovery, category/method/aircraft resets, offline reload, and unsupported cases: missing table origin (`D-BADT`), a second available tank (`D-LOOK2`) and nonzero unusable fuel (`D-VARY`). Arrival mass stays visible whenever CG is unsupported. The M&B `CG Out of Envelope` alert and `[UNVERIFIED]` print markers stay visible.

| View | 390 px | 1440 px |
| :--- | :--- | :--- |
| Duration, 10 kg burn | [Mobile](lookup-duration-partial-offline-390.png) | [Desktop](lookup-duration-partial-offline-1440.png) |
| Direct, 30 kg burn | [Mobile](lookup-direct-partial-offline-390.png) | [Desktop](lookup-direct-partial-offline-1440.png) |
| Load beyond table, mass retained | [Mobile](lookup-out-of-range-offline-390.png) | [Desktop](lookup-out-of-range-offline-1440.png) |
| Nonzero unusable fuel unsupported | [Mobile](D-VARY-lookup-unsupported-offline-390.png) | [Desktop](D-VARY-lookup-unsupported-offline-1440.png) |
| Two available tanks unsupported | [Mobile](D-LOOK2-lookup-unsupported-offline-390.png) | [Desktop](D-LOOK2-lookup-unsupported-offline-1440.png) |
| Print fuel section | [Mobile](print-direct-390.png) | [Desktop](print-direct-1440.png) |

Playwright traces, all screenshots, gate logs and the `dist` manifest are on branch [`evidence/job-1301-529`](https://github.com/naturelle137/AeroDash/tree/evidence/job-1301-529). Screenshot hashes are in [SHA256SUMS](SHA256SUMS).

## Verification at the source commit

| Check | Result |
| :--- | :--- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm lint` | Passed |
| `pnpm test:unit` | 2169 passed |
| `pnpm test:integration` | 170 passed |
| `pnpm build` | Type-check and production build passed |
| `pnpm --filter frontend test:p1:coverage` | 978 passed; 98.89% statements, 97.41% branches |
| `CI=1 pnpm test:e2e --project=chromium --workers=1` | 97 passed |
| `pnpm --filter frontend exec playwright test --config playwright.offline.config.ts` | 22 passed |

Independent review, required CI and merged-source cached-offline acceptance remain separate delivery gates.
