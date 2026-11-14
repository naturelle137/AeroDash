# Optional current fuel print evidence

Synthetic software vectors only; no operational POH/AFM validation. Application
source: `38bae59d8ff094fe77c1559da7c3437ece9235da`, based on fresh develop
`b23f1101a106524e869d6627dd6ffc9968683fb6`. The browser test in this change
produced these files from the built app after a service-worker offline reload.
The later screenshot-only correction captures the fixed preview at viewport size
instead of capturing preparation content outside that viewport.

## Results

- Frozen install, lint, 2,009 unit tests, 160 integration tests, build/typecheck,
  933 isolated P1 tests and 97 Chromium scenarios passed in `web-dev`.
- Complete production offline suite: eight cases passed at 390/1440 px, including
  existing M&B-only and fuel regression coverage. The new fuel-print scenario
  passed again at both widths after the screenshot correction.
- Both manual modes, explicit opt-in, unconfigured/malformed/impossible inclusion,
  reserve shortfall, reserve-only shortfall, zero margin, unsupported variable-arm
  CG, absent/invalid/valid named sequences, input/method/sequence changes,
  cancellation, reset and reload were exercised.
- Real `window.print()` emitted `beforeprint`; input dispatch followed by native
  printing in the same JavaScript turn suppressed the stale snapshot. PDF text
  checks found no previous identity or arrival result in the one-page guard.
- Combined long-warning PDFs have four nonempty A4 pages with repeated table
  headers. Rendered duration/direct/long-reason pages at both widths were visually
  checked for clipping, missing rows, blank pages and readable warnings/disclaimers.

## Selected artifacts

| Artifact | Purpose |
| :--- | :--- |
| [Mobile preview](duration-390-screen.png) / [fuel section](duration-390-fuel-screen.png) | Actual 390 px viewport |
| [Desktop preview](duration-1440-screen.png) / [fuel section](duration-1440-fuel-screen.png) | Actual 1440 px viewport |
| [Mobile duration PDF](duration-390.pdf) / [desktop duration PDF](duration-1440.pdf) | Reserve-only shortfall and four-page pagination |
| [Direct PDF](offline-direct.pdf) | No duration, endurance or reserve budget rows |
| [Unsupported sequence PDF](invalid-sequence-long-reason.pdf) | Valid mass with actual long CG reason |
| [Guard PDF](stale-blocked.pdf) | One page, no old plan |
| [Duration last page](duration-last-page.png) / [unsupported last page](unsupported-last-page.png) | Rendered PDF warnings, reason and scope limits |
| [Pagination hashes](pagination.json) / [selected hashes](SHA256SUMS) | Exact output identities |

## Commands

Run from the managed worktree with `distrobox enter web-dev --`:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build
pnpm --filter frontend test:p1
CI=1 pnpm test:e2e --project=chromium
pnpm --filter frontend exec playwright test --config playwright.offline.config.ts
```

The fuel-only screenshot rerun selects `fuel-print.spec.ts` with the same offline
config. Job #1102 retains command logs, source SHA-256s, all print-media captures,
PDFs, traces and the independent text/pagination checker in its evidence directory.
Browser-generated PDFs are internal QA evidence, not a product download feature,
physical printer test, full briefing pack or suitability assessment. Sole fresh
review, protected integration and fresh merged-head acceptance remain with the
terminal owner; these artifacts do not establish those later results.
