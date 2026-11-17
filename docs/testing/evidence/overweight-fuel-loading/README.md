# Overweight loading regression evidence

Synthetic software fixtures only; no POH/AFM or physical-device validation.
Tested code revision: `0bf7c2959afaf688063b5c28fdcbeeaed4e8b68b`.
This evidence-only commit does not change tested application or test code.

Both heavy-adult loading steps explicitly enter 6 kg in Fuel Tanks, equal to
unusable fuel. Fuel therefore contributes zero usable mass and moment. The full
load remains 1117 kg above MTOM 1111 kg; reduced baggage gives 1094 kg below MTOM
but above MZFM 1085 kg. Existing assertions, invalid-default coverage and profile,
BEM, source and production validation data are unchanged.

All commands ran on the host through `distrobox enter web-dev --`, in the managed
job worktree. [Exit statuses and screenshot hashes](checks.json) record:

| Check | Result | Exit |
| --- | --- | --- |
| `pnpm lint` | Passed | 0 |
| `pnpm test:unit` | 2275 tests / 109 files | 0 |
| `pnpm test:integration` | 218 tests / 23 files | 0 |
| `pnpm build` | Production build and type-check passed | 0 |
| `CI=1 pnpm test:e2e --project=chromium --grep 'Full passenger and baggage\|Reducing baggage'` | 2/2 | 0 |
| `CI=1 pnpm test:e2e --project=chromium` | 97/97; `@wip` excluded, not passed | 0 |
| Fixed-arm production/offline | 2/2 at 390/1440 | 0 |
| Related production/offline | 8/8 at 390/1440 | 0 |
| Data constants and comment checks | Passed | 0 |
| Overweight scenarios at 390/1440 | 4/4, screenshots inspected | 0 |

Offline command prefix: `pnpm --filter frontend exec playwright test --config
playwright.offline.config.ts`. Specs: `fixed-arm-fuel.spec.ts`,
`lookup-fuel-mb.spec.ts`, `briefing-pack.spec.ts`, `fuel-print.spec.ts`,
`fuel-endurance.spec.ts`. The fixed-arm run retains invalid persisted-default,
raw boundary, equality, correction, open-print invalidation and arrival recovery
coverage. Browser artifacts and complete command logs remain with the HQ job.

The screenshot runner uses the existing generated BDD scenarios and assertions,
with a temporary config setting absolute BDD paths, the frontend server working
directory, 390/1440 by 1000 viewports, screenshots on and traces on. Two preliminary
runner configuration attempts exited 1 before scenario steps (missing server cwd,
then missing BDD registration); the corrected run passed all four scenarios.

| Loading | 390 px | 1440 px |
| --- | --- | --- |
| Full: MTOM and MZFM exceeded | [Mobile](390-full.png) | [Desktop](1440-full.png) |
| Reduced: MZFM exceeded, within MTOM | [Mobile](390-reduced.png) | [Desktop](1440-reduced.png) |

The mobile screenshots show the critical notifications; lower inputs/results
continue below the viewport. Desktop screenshots also show Fuel Tanks 6 kg and
the 1117/1094 kg results. No certification or operational acceptance is claimed.
