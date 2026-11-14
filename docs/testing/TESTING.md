# Testing AeroDash

Run commands from the repository root with Corepack/pnpm; use the `web-dev` toolbox locally.

| Check | Command | Purpose |
| :--- | :--- | :--- |
| Lint | `pnpm lint` | TypeScript/Vue and Markdown rules |
| Unit | `pnpm test:unit` | Isolated behavior and repository safeguards |
| Integration | `pnpm test:integration` | Module/store interaction with controlled I/O |
| Build | `pnpm build` | Type-check and production bundle |
| Browser | `pnpm test:e2e --project=chromium` | Playwright BDD workflows |
| P1 | `pnpm --filter frontend test:p1` | Framework-free core in Node |
| P1 coverage | `pnpm --filter frontend test:p1:coverage` | Core coverage thresholds |
| Mutation | `pnpm --filter frontend test:mutation` | P1 defect-detection strength |

Playwright starts its server. Use Chromium where Edge is absent. The script excludes `@wip`; excluded scenarios do not count as passed. Inspect the feature files and report executed/passed/excluded scope.

## Meaningful evidence

- P1 numerical tests cover invalid/nonfinite inputs, units, boundary equality, limits and deterministic reference vectors. Preserve independent expected calculations.
- P2/P3 tests exercise real changed behavior; use fixed weather/GPS fixtures and no live aviation services. Use real stores in integration tests.
- Browser tests exercise the actual flow, including warnings, acknowledgement, persistence and recovery at relevant desktop/mobile widths. Keep selectors accessible; avoid forced clicks and arbitrary sleeps.
- Synthetic catalogue/fixture aircraft are algorithm and UI inputs, not validated operational POH data. Keep this distinction in PRs and reports.
- Unit success does not establish an integrated journey. Historical M&B [QA293](../development/mb-qa-293.md) and [optional occupancy evidence](evidence/optional-occupancy/README.md) remain dated evidence, not a current-head test claim.

## Gates

Coverage configuration uses 90% line/branch/function for P1, 80% for P2 and 60% for P3. Check the Vitest configurations for exact inclusion paths. P1 runtime code must remain independent of Vue/Pinia; ESLint enforces the boundary.

Stryker mutates P1 executable code using `vitest.config.p1.ts`; its fail floor is 70. Inspect `frontend/reports/mutation/mutation.html` for survivors. The CI workflow runs it for P1-affecting changes on develop and on main; do not weaken this functional safeguard.

`CI Required` aggregates lint, Markdown, type-check, unit/coverage, integration, build, Chromium E2E, security and the conditionally required mutation job. Unexpected missing, cancelled, failed or skipped mandatory jobs block integration. Security includes CodeQL, audit, OSV and SBOM; report advisory versus blocking results accurately. Functional checks and source/data safeguards remain after removal of trace tooling.

## Cached offline preparation

Run `pnpm test:offline` to build production and run Chromium at 390px and 1440px.
The suite accepts the disclaimer, imports and explicitly verifies a synthetic profile,
saves a manual runway, waits for service-worker control and the Workbox precache,
then disconnects and reloads real routes. It checks persisted Fleet/runway/M&B input,
raw in-envelope lookup, stale-result invalidation and reconnection status. The fuel scenario imports synthetic single/empty-multiple/variable-arm tank profiles, checks both planning modes, arrival mass/CG arithmetic, equality, shortage, payload/category/aircraft resets and invalidation, then recalculates offline after reload with planning inputs cleared. Unsupported CG retains valid arrival mass and a reason.
Screenshots and traces are attached in `frontend/playwright-report/offline/`; CI uploads them
as `offline-workflow-evidence`. These fixtures prove software wiring only, not
POH/AFM accuracy, aviation suitability or guaranteed browser storage retention.
The older offline smoke covers same-document navigation only.
