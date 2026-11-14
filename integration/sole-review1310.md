# Independent review — PR #531

VERDICT: APPROVE

Reviewed head: `a65fc1af24630cfd81f463e3aedc02cc90f4a3dd` against develop `99ab6642be741d7bb0a58f2cb229d4833ab127f2`. Product source: `9ec6756579f9bebbfc539b73253a134da8276418`; the later commit adds evidence only.

Blocking findings: none.

## Scope and evidence

Read PR description/comments/diff, issue #529, CEO directive 16, current-head contributor instructions, architecture, disclaimer, assumptions and fuel requirements. Read actual job1294 implementation brief and independent-check.json, and job1293 contract, vectors and source-execution.json. Those research outputs were used to understand the contract, never counted as production test coverage. Local1304 output was not used.

P1 calculates `M − F(q) + F(q − b)` by interpolating moments with the same segment helper as legacy M&B. It validates finite ordered unique knots from exactly (0,0), table coverage, input/result SI bounds and arithmetic. Signed and nonmonotonic moments remain valid. P2 retains explicit units/fuel validation and raw negative-axis checks before normalization, counts empty available tanks, requires one current load, arm=null and unusableFuel=0 exactly. Unsupported configurations preserve otherwise valid arrival mass. Legacy fixed-arm/sequence calculation and M&B contribution conventions are preserved; nonzero-u issue #530 remains separate. Store actions recalculate on loading/category/profile changes; planning and print consumers retain existing reset/invalidation paths. No calculation math was added to Vue.

Actual production tests inspected: P1 exact nonlinear zero/intermediate/cross-breakpoint/full/empty/signed vectors and geometry/bounds failures; P2 actual-M&B endpoint equivalence, lb/in, L, USG/gal, IMPgal and ft normalization, stale mass rejection and unsupported configurations; live-store integration for both modes with loading/category/method changes and recovery; print integration retaining profile markers. Existing fixed-arm and sequence tests remain present.

Premerge offline source tests at 390/1440 cover both manual modes, zero/partial/full supported burns, out-of-range correction, missing origin, nonzero-u and multiple available tanks, category/profile/method/reload suppression, print and warnings/profile provenance. Reviewed all four retained fuel/print traces: offline context transitions and SW reload assertions are present, with no browser-action errors; test.trace retries are successful expect.poll polling, not failed terminal tests. Inspected mobile print screenshot, including arrival 530 kg / 1.057 m, warnings and UNVERIFIED markers.

Independently verified all 114 retained evidence hashes. Source manifest SHA256 is `bfb6f32485290a239c750880e7f18bd3e3528dcdd987dc834b85ffc472cfc7aa`; recorded SW SHA256 is `b70f4922f6be2e439833a361144a80e0912902dfa4b873ceea45271ab3113add`. Read actual frozen-install/lint/unit/integration/build/P1/Chromium/offline logs: unit2169, integration170, P1978, Chromium97, offline22 passed. These are inspected implementation-run results, not fresh reviewer reruns. Evidence: job1301/evidence and product docs/testing/evidence/lookup-arrival-cg; durable branch evidence/job-1301-529.

## Integration conditions and ownership

The latest CI snapshot is saved in ci-final.txt. Lint, typecheck, unit, integration, build, security and DoD checks passed; E2E and mutation are still in progress, and aggregate CI Required is not green yet. No failed check observed. APPROVE is a source-review verdict, not a claim that pending CI passed. Owner1302 must obtain green final required checks before merge.

All five commits contain SSH signatures. GitHub reports head verification `verified=false`, reason `no_user`; do not call these GitHub-verified signatures. Live develop protection requires strict up-to-date Lint, Type Check, Unit Tests, Build, E2E Tests and CI Required; required_signatures=false, approval count0. No protection changes or bypasses were made.

Not merged: the job-specific brief expressly reserves merge and issue closure for terminal PLAN1302, and CI is pending. No product files/index/branches/worktrees were modified; preserved work was untouched. No fix or additional review job is required. Actual merged-source production cached-offline 390/1440 rerun and acceptance remain mandatory for1302 before closing #529; premerge evidence does not establish product acceptance.

Implementation owner verified as terminal done job1301 from its PR branch and result, rather than review parent1302 (running PLAN). Record first acceptance yes, rework0 for1301, with escaped defects unknown.
