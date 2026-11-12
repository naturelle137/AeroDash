# Raw POH browser evidence

Captured 2026-11-12 with Chromium against the production build. Fictional
**Test / D-TEST** vectors establish UI wiring only, not aviation accuracy.
No test values are bundled as production aircraft support.

## Reproduce

Inside the `web-dev` toolbox, from the repository root:

```bash
pnpm build
CI=1 pnpm test:e2e --project=chromium --retries=0
```

All 40 enabled scenarios passed without retries (11 raw-POH scenarios).
`@wip` scenarios are excluded and are not reported as passing.

The desktop 1440×1000 and phone 390×844 journeys use the visible Fleet file
input, expand all four imported tables, observe Draft blocking, explicitly
sign off, navigate to Performance, select the persisted snapshot, enter
kg/ft/°C and inspect TOR/TOD/LR/LD. They check immediate input/selection
invalidation, blank/nonfinite/nonpositive/out-of-envelope blocking, reload
and exchange download preservation. Separate browser scenarios block missing
and duplicate phases, nonpositive distances, incomplete/duplicate grids,
invalid schemas, nonfinite points and unsupported phases.

Service tests cover each phase's narrower bounds on both sides of every
axis, valid endpoints, invalid grids, expired sign-off and unsupported
profile versions. Persistence integration covers exchange → Draft → sign-off
→ IndexedDB reload → exchange with all tables retained. Component tests
cover stale-result invalidation and storage failure/retry. None of these
synthetic cases validates an applicable real aircraft POH/AFM.

## Screenshots

- [Desktop lookup](raw-poh-1440.png)
- [Phone lookup](raw-poh-390.png)
- [Desktop imported-point review](fleet-review-1440.png)
- [Phone imported-point review](fleet-review-390.png)

The phone's fixed bottom navigation appears at the initial viewport edge in
Playwright's full-page capture. The page scrolls normally; the test checks
that the page has no horizontal overflow and exercises controls by scrolling.
