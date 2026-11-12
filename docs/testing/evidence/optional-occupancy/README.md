# Optional occupancy UI evidence

Executed in the `web-dev` toolbox on 2026-11-12, implementation tree from
`6c17a0a0950f0aa37dfba0073d0e8ba612f46d25`. The additional session-restoration
test and documentation do not change this UI. Fixtures copy the bundled MVP
catalogue as synthetic Draft profiles; these are not validated POH/AFM data.

| Check | Result |
| :--- | :--- |
| `pnpm lint` | Passed, including structural traceability |
| `pnpm test:unit` | 1808 passed |
| `pnpm test:integration` | 102 passed, including session restoration |
| `pnpm build` | Passed, including type-check |
| `pnpm --filter frontend test:p1:coverage` | 674 passed; per-file 90% gate passed |
| `CI=true pnpm test:e2e --project=chromium` | 27 passed |
| `pnpm --filter frontend comment:check` | No new violations |

Chromium scenarios `E2E-B-012` exercise actual persisted fleet data through the
context schema, store and calculator at desktop (1280×900) and mobile (390×900)
viewports. Full-page screenshots were visually inspected:

- Solo: [desktop](solo-desktop.png), [mobile](solo-mobile.png). Positive required
  front aggregate, untouched optional rear at zero, empty baggage; only the
  Draft Profile Active notice remains. No missing-mass blocker.
- Required aggregate at zero: [desktop](required-zero-desktop.png),
  [mobile](required-zero-mobile.png). WARN-UQ-001 identifies Front Seats only.

The same scenarios clear the optional input, assert validation errors, then enter
explicit zero and assert recovery. Integration tests additionally reject negative,
NaN, Infinity, missing, overflowing and invalid text through input/store paths.

The initial browser run exposed missing occupancy forwarding in the runtime
context schema; corrected before the successful complete rerun. Screenshots
capture existing sticky navigation and preset rendering; preset filtering remains
separate work. Full report and command logs are retained in HQ job 355 evidence.
No merge, independent final approval or CI success is claimed by these local checks.
