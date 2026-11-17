# Persisted lookup fuel unit recovery

Synthetic software evidence only; no operational POH/AFM validation.

The browser seeds one historical profile directly into IndexedDB before loading
Fleet. Every subsequent change uses the real editor: opening shows the explicit
missing-unit option; saving an unrelated datum description and reloading preserves
all raw tank data; M&B stays blocked; selecting `kg`, saving and reloading restores
580 kg / 1170 kg·m / 2.017 m. The same sequence passes online and cached offline at
390×1000 and 1440×1000. No storage mutation is used to perform the correction.

The fixture has BEM 560 kg at 2 m (including 10 kg unusable fuel), total tank load
30 kg, and total-moment knots (0,0), (10,10), (30,60), (50,150). Thus M&B adds
20 kg and 60 − 10 = 50 kg·m. Missing/null/nonstring units, fixed/nonfuel stations,
invalid lookup geometry and unknown fuels have separate schema rejection tests.
Lookup defaults below unusable fuel remain raw during unrelated saves and unit
correction; the existing calculation guard requires deliberate input correction.

## Checks

Commands ran in `web-dev`, Node 24.18.0, Corepack pnpm 10.32.1:

| Command from repository root | Result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | Passed |
| `corepack pnpm lint` | Passed |
| `corepack pnpm test:unit` | 2309 passed |
| `corepack pnpm test:integration` | 221 passed |
| `corepack pnpm build` | Passed, including type check |
| `corepack pnpm --filter frontend test:p1:coverage` | Passed; 99.36% lines, 97.45% branches |
| `corepack pnpm --filter frontend test:mutation --mutate src/core/adapters/aircraft.schema.ts --concurrency 4` | Passed; 80.73%, changed schema only |
| `CI=1 corepack pnpm test:e2e --project=chromium` | 97 passed; unfinished `@wip` scenarios excluded |
| `corepack pnpm --filter frontend exec playwright test --config playwright.offline.config.ts legacy-fuel-unit-recovery lookup-fuel-mb` | 6 passed |

The new schema regression failed against unchanged develop: 1 failed, 126 passed.
An initial browser run exposed the second runtime context schema admission barrier;
that boundary now admits only the recoverable blank shape to raw fuel validation.
A later run completed the workflow but failed its console assertion on the existing
preview-server CSP diagnostic. The final regression retains that exact diagnostic
in raw console evidence and rejects every other console error or page exception.

## Screenshots and console

Each width has four cached-offline viewport screenshots: missing-unit editor,
blocked calculation, corrected unit after reload, and restored calculation.
`390-console.json` and `1440-console.json` contain verbatim console records from the
successful Playwright traces: eight existing meta-CSP `frame-ancestors` diagnostics
per flow. The regression reports no other errors. Full-page captures and traces
remain in the browser test output rather than the repository.

| State | Mobile | Desktop |
| --- | --- | --- |
| Missing unit and source guidance | [390](390-missing-unit-editor-viewport.png) | [1440](1440-missing-unit-editor-viewport.png) |
| Blocked M&B | [390](390-missing-unit-blocks-calculation-viewport.png) | [1440](1440-missing-unit-blocks-calculation-viewport.png) |
| Corrected unit after reload | [390](390-corrected-unit-reloaded-viewport.png) | [1440](1440-corrected-unit-reloaded-viewport.png) |
| Restored synthetic calculation | [390](390-corrected-calculation-viewport.png) | [1440](1440-corrected-calculation-viewport.png) |
