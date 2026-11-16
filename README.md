# Lookup fuel regression evidence

Tested product head: `ce20edf4a2b511e4cf79f4b8c1aeca3a389fea46`.
Base and unchanged RED production: `4c86e451c0cd3007a6135ad7e0e4f0e155180c40`.
All commands ran in existing `web-dev` toolbox at job-1624 worktree.

- RED: `pnpm --filter frontend exec vitest run --config vitest.config.int.ts src/modules/mass-balance/stores/__tests__/lookup-fuel.int.spec.ts`: 26 passed, 2 failed on missing WARN-MB-005. Production store unchanged; test commit `a5287d8` (tree-identical signed replay of `0c4b9b1`).
- GREEN same command: 28 passed. Invalid raw lookup never calls the real adapter; separate valid cases retain real-adapter arithmetic.
- `pnpm lint && pnpm test:unit`: passed; 108 files, 2263 unit tests.
- `pnpm test:integration`: passed; 22 files, 208 tests.
- `pnpm --filter frontend type-check`: passed.
- `pnpm build`: passed.
- `pnpm --filter frontend exec playwright test --config playwright.offline.config.ts tests/offline-production/lookup-fuel-mb.spec.ts --output /var/home/critter/lokal/dev/agent-hq/var/jobs/1624/browser`: 2/2 passed, Chromium390/1440, production cached offline flow. Existing proof covers lookup fail-closed, correction, units, chart, print, fuel and offline behavior. Independent station-warning coexistence is integration-tested, not asserted by this browser spec.

Screenshots show default-below-unusable validation and recovered cached-offline print at both widths. All54 browser files, including traces, remain in HQ job1624/browser; four representative screenshots attached here. Synthetic software evidence only; no operational POH validation, independent review, CI completion or integrated acceptance claimed. Issue534 stays open.

Unit/lint/full integration/type-check were run on the identical product tree before signature replay. Targeted GREEN, build and both browser widths were rerun at final ce20edf head. GitHub verifies both product signatures. See [PR560](https://github.com/naturelle137/AeroDash/pull/560).

The full-page print screenshot includes the underlying page below the viewport-height dialog; it proves text assertions, not full print-layout acceptance. Validation-message screenshots were visually inspected at both widths.
